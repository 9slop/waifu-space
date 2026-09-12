import { json } from '@solidjs/router';
import { verifySessionToken, getSessionTokenFromRequest } from '../../../lib/server/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';
import { COSMETIC_CATALOG, AFFECTION_MILESTONES } from '../../../lib/store';
import { MAX_COINS } from '../../../lib/economy';
import { EVENT_TYPES, RECURRENCE_RULES, isHexColor } from '../../../lib/validation';
import { sanitizeOccurrenceOverride, type CalendarOccurrenceOverride } from '../../../lib/validate';
import { checkRateLimit } from '../../../lib/server/rate-limit';

const itemRarity = (itemId: string): string =>
  COSMETIC_CATALOG.find(c => c.id === itemId)?.rarity || 'common';

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * ARCHITECTURAL NOTE: 401 responses on /api/sync/progress
 * 401 Unauthorized is INTENTIONAL when an unauthenticated request is received,
 * because progress synchronization is an authenticated-only endpoint.
 *
 * The previous issue with unexpected 401s was caused by:
 * 1. Clients attempting to sync progress using fake guest tokens (e.g. 'ws_guest_token')
 *    or mock demo tokens (e.g. 'ws_demo_token') which lack valid cryptographic signatures.
 * 2. Stale or expired session tokens where the client did not handle 401 by clearing the
 *    session and prompting for login.
 *
 * Resolution:
 * - Guest accounts are completely removed;
 * - The client only syncs when authenticated with a cryptographically verified token;
 * - On 401, the client immediately invalidates the stale session and redirects to login.
 */

// Sync progress to cloud database
export async function POST(event: { request: Request }) {
  const token = getSessionTokenFromRequest(event.request);
  const session = verifySessionToken(token);

  if (!session) {
    return json({ success: false, error: 'Unauthorized session' }, { status: 401 });
  }

  // Rate limit sync pushes (defense in depth against sync-loop flood from a
  // misbehaving or hijacked client). The client debounces naturally, so the
  // normal push rate is well under this ceiling.
  const rateCheck = checkRateLimit(`sync_${session.userId}`, 60, 60_000);
  if (!rateCheck.allowed) {
    return json(
      { success: false, error: 'Too many sync requests. Please wait a moment and try again.' },
      { status: 429 }
    );
  }

  try {
    const payload = await event.request.json();

    // Security Audit: Reject any request attempting to submit client-defined reward or progression values
    // Covers top-level, nested objects, tasks/calendar items, and milestone reward tampering.
    const hasClientRewards =
      payload.coins !== undefined ||
      payload.currentCoins !== undefined ||
      payload.rpg?.coins !== undefined ||
      payload.rpg?.defenseHighWave !== undefined ||
      payload.defenseHighWave !== undefined ||
      payload.unlockedOutfits !== undefined ||
      payload.rpg?.unlockedOutfits !== undefined ||
      payload.unlockedAccessories !== undefined ||
      payload.rpg?.unlockedAccessories !== undefined ||
      payload.unlockedHairstyles !== undefined ||
      payload.rpg?.unlockedHairstyles !== undefined ||
      payload.unlockedAvatarFrames !== undefined ||
      payload.rpg?.unlockedAvatarFrames !== undefined ||
      payload.bondExp !== undefined ||
      payload.waifu?.bondExp !== undefined ||
      payload.bondLevel !== undefined ||
      payload.waifu?.bondLevel !== undefined ||
      payload.xp !== undefined ||
      payload.exp !== undefined ||
      payload.reward !== undefined ||
      payload.rewards !== undefined ||
      payload.trust !== undefined ||
      (Array.isArray(payload.calendar) && payload.calendar.some((e: any) =>
        e && (e.xp !== undefined || e.coins !== undefined || e.reward !== undefined || e.bondExp !== undefined)
      )) ||
      (Array.isArray(payload.tasks) && payload.tasks.some((t: any) =>
        t && (t.xp !== undefined || t.coins !== undefined || t.reward !== undefined || t.bondExp !== undefined)
      )) ||
      (payload.milestoneRewards !== undefined || payload.rpg?.milestoneRewards !== undefined);

    if (hasClientRewards) {
      return json(
        { success: false, error: 'Client-defined reward, balance, and progression values are strictly forbidden.' },
        { status: 400 }
      );
    }

    const { waifu, settings, showcaseItems } = payload;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient()!;

      // Fetch existing bond level to securely validate any claimed milestones
      const { data: existing } = await supabase
        .from('user_progress')
        .select('bond_level, claimed_milestones')
        .eq('user_id', session.userId)
        .single();
      const dbBondLevel = existing?.bond_level ?? 1;

      const rawMilestones = payload.rpg?.claimedAffectionMilestones ?? payload.claimedMilestones;
      const incomingMilestones = Array.isArray(rawMilestones)
        ? rawMilestones
            .filter((m: unknown) => typeof m === 'number' && Number.isInteger(m) && m >= 0 && m <= dbBondLevel)
            .slice(0, 200)
        : existing?.claimed_milestones || [];

      // Server is authoritative for coins, bond, and defense wave. Only update cosmetic appearances, settings, and verified milestones.
      await supabase.from('user_progress').upsert({
        user_id: session.userId,
        waifu_name: typeof waifu?.name === 'string' ? waifu.name.slice(0, 40) : 'Akari',
        waifu_personality: typeof waifu?.personality === 'string' ? waifu.personality.slice(0, 40) : 'tsundere',
        worn_outfit: typeof waifu?.appearance?.outfit === 'string' ? waifu.appearance.outfit : 'seifuku',
        worn_accessory: typeof waifu?.appearance?.accessory === 'string' ? waifu.appearance.accessory : 'none',
        worn_hairstyle: typeof waifu?.appearance?.hairstyle === 'string' ? waifu.appearance.hairstyle : 'twintails',
        worn_avatar_frame: typeof waifu?.appearance?.avatarFrame === 'string' ? waifu.appearance.avatarFrame : 'none',
        appearance_data: waifu?.appearance && typeof waifu.appearance === 'object' ? waifu.appearance : {},
        settings_data: settings && typeof settings === 'object' ? settings : {},
        claimed_milestones: incomingMilestones,
        updated_at: new Date().toISOString()
      });

      // Grant unlocked milestone cosmetics to user_inventory so they are permanent across devices/reloads
      if (incomingMilestones.length > 0) {
        const cosmeticInserts: Array<{ user_id: string; item_id: string; category: string; rarity: string }> = [];
        for (const level of incomingMilestones) {
          const ms = AFFECTION_MILESTONES.find(m => m.level === level);
          if (ms && ms.rewardType === 'cosmetic' && typeof ms.rewardValue === 'string') {
            const item = COSMETIC_CATALOG.find(c => c.id === ms.rewardValue);
            if (item) {
              cosmeticInserts.push({
                user_id: session.userId,
                item_id: item.id,
                category: item.category,
                rarity: item.rarity
              });
            }
          }
        }
        if (cosmeticInserts.length > 0) {
          await supabase.from('user_inventory').upsert(cosmeticInserts, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
        }
      }

      // Update showcase slots from validated inventory items
      const rawShowcase = Array.isArray(showcaseItems) ? showcaseItems : Array.isArray(payload.rpg?.showcaseItems) ? payload.rpg.showcaseItems : null;
      if (Array.isArray(rawShowcase)) {
        await supabase.from('user_showcase').delete().eq('user_id', session.userId);
        const validIds = new Set(COSMETIC_CATALOG.map(c => c.id));
        const inserts = rawShowcase.slice(0, 6)
          .filter((itemId: unknown) => typeof itemId === 'string' && validIds.has(itemId))
          .map((itemId: string, slotIndex: number) => ({
            user_id: session.userId,
            slot_index: slotIndex,
            item_id: itemId
          }));
        if (inserts.length > 0) {
          await supabase.from('user_showcase').insert(inserts);
        }
      }

      // Sync calendar events/tasks. The client's calendar list is private and
      // authoritative on push. This runs through the sync_calendar_items RPC,
      // which upserts incoming rows and deletes absent rows inside ONE
      // transaction — so a partial/malformed push can never leave the user's
      // calendar half-wiped. Setting calendar_synced_at marks the cloud list
      // as authoritative (even when empty after a full delete).
      if (Array.isArray(payload.calendar)) {
        const nowIso = new Date().toISOString();
        const rows = payload.calendar
          .filter(
            (e: any) =>
              e && typeof e.title === 'string' && e.title.trim() !== '' &&
              typeof e.start === 'string' && !Number.isNaN(new Date(e.start).getTime())
          )
          .slice(0, 5000)
          .map((e: any) => {
            const start = new Date(e.start).toISOString();
            const end = e.end && !Number.isNaN(new Date(e.end).getTime()) ? new Date(e.end).toISOString() : start;
            return {
              item_id: typeof e.id === 'string' && e.id.trim() ? e.id.slice(0, 100) : `${session.userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
              title: e.title.trim().slice(0, 200),
              start_at: start,
              end_at: end,
              all_day: e.allDay === true,
              type: (EVENT_TYPES as readonly string[]).includes(e.type) ? e.type : 'event',
              completed: e.completed === true,
              rewarded: e._rewarded === true,
              color: isHexColor(e.color) ? e.color : '#ff6584',
              description: typeof e.description === 'string' ? e.description.slice(0, 2000) : '',
              location: typeof e.location === 'string' ? e.location.slice(0, 500) : '',
              recurrence: (RECURRENCE_RULES as readonly string[]).includes(e.recurrence) ? e.recurrence : 'none'
            };
          });

        const { error: syncCalErr } = await supabase.rpc('sync_calendar_items', {
          p_user_id: session.userId,
          p_items: rows,
          p_updated_at: nowIso
        });
        if (syncCalErr) {
          throw new Error(`Calendar sync failed: ${syncCalErr.message}`);
        }

        await supabase.from('user_progress').upsert({
          user_id: session.userId,
          calendar_synced_at: nowIso
        });
      }

      // Persist occurrence overrides (per-occurrence edits / deletions for
      // repeating events). The client sends the full current overrides list;
      // we store it as a clamped JSONB blob on the user_progress row.
      if (Array.isArray(payload.calendarOverrides)) {
        const rawOverrides: unknown[] = Array.isArray(payload.calendarOverrides) ? payload.calendarOverrides : [];
      const sanitizedOverrides: CalendarOccurrenceOverride[] = rawOverrides
        .map(o => sanitizeOccurrenceOverride(o))
        .filter((o): o is CalendarOccurrenceOverride => o !== null)
        .slice(0, 2000);

        await supabase.from('user_progress').upsert({
          user_id: session.userId,
          calendar_overrides: sanitizedOverrides
        });
      }
    }

    return json({ success: true, syncedAt: new Date().toISOString() });
  } catch (err: any) {
    return json({ success: false, error: err.message || 'Sync failed' }, { status: 500 });
  }
}

// Fetch progress from cloud database with optional scope support (?scope=all|profile|calendar|rpg)
export async function GET(event: { request: Request }) {
  const token = getSessionTokenFromRequest(event.request);
  const session = verifySessionToken(token);

  if (!session) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(event.request.url);
  const scope = url.searchParams.get('scope') || 'all';

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient()!;

    let progress: any = null;
    let showcaseItems: string[] = [];
    let inventory: any[] = [];
    let calendarItems: any[] = [];
    let calendarOverrides: any[] = [];

    if (scope === 'calendar') {
      const [{ data: cal }, { data: p }] = await Promise.all([
        supabase.from('calendar_items').select('*').eq('user_id', session.userId).order('start_at'),
        supabase.from('user_progress').select('calendar_overrides, calendar_synced_at').eq('user_id', session.userId).maybeSingle()
      ]);
      calendarItems = (cal || []).map((r: any) => ({
        id: r.item_id,
        title: r.title,
        start: r.start_at,
        end: r.end_at,
        allDay: r.all_day,
        type: r.type,
        completed: r.completed,
        _rewarded: r.rewarded === true,
        color: r.color,
        description: r.description || undefined,
        location: r.location || undefined,
        recurrence: r.recurrence
      }));
      calendarOverrides = p?.calendar_overrides ?? [];

      return json({
        success: true,
        progress: null,
        showcaseItems: [],
        inventory: [],
        calendarItems,
        calendarOverrides,
        calendarSyncedAt: p?.calendar_synced_at ?? null
      });
    }

    if (scope === 'rpg') {
      const [{ data: p }, { data: inv }, { data: sc }] = await Promise.all([
        supabase.from('user_progress').select('coins, bond_level, bond_exp, claimed_milestones, defense_high_wave, defense_victories, goblins_defeated').eq('user_id', session.userId).maybeSingle(),
        supabase.from('user_inventory').select('item_id, category, rarity').eq('user_id', session.userId),
        supabase.from('user_showcase').select('item_id').eq('user_id', session.userId).order('slot_index')
      ]);

      return json({
        success: true,
        progress: p || null,
        showcaseItems: sc ? sc.map((s: any) => s.item_id) : [],
        inventory: inv || [],
        calendarItems: [],
        calendarOverrides: []
      });
    }

    // Default: 'all' or 'profile'
    const [progressRes, showcaseRes, inventoryRes, calendarRes] = await Promise.all([
      supabase.from('user_progress').select('*').eq('user_id', session.userId).maybeSingle(),
      supabase.from('user_showcase').select('*').eq('user_id', session.userId).order('slot_index'),
      supabase.from('user_inventory').select('item_id, category, rarity').eq('user_id', session.userId),
      scope === 'profile'
        ? Promise.resolve({ data: [] })
        : supabase.from('calendar_items').select('*').eq('user_id', session.userId).order('start_at')
    ]);

    progress = progressRes.data;
    showcaseItems = showcaseRes.data ? showcaseRes.data.map((s: any) => s.item_id) : [];
    inventory = inventoryRes.data || [];
    calendarItems = (calendarRes.data || []).map((r: any) => ({
      id: r.item_id,
      title: r.title,
      start: r.start_at,
      end: r.end_at,
      allDay: r.all_day,
      type: r.type,
      completed: r.completed,
      _rewarded: r.rewarded === true,
      color: r.color,
      description: r.description || undefined,
      location: r.location || undefined,
      recurrence: r.recurrence
    }));
    calendarOverrides = progress?.calendar_overrides ?? [];

    return json({
      success: true,
      progress,
      showcaseItems,
      inventory,
      calendarItems,
      calendarOverrides
    });
  }

  return json({ success: true, progress: null, showcaseItems: [], inventory: [], calendarItems: [], calendarOverrides: [] });
}

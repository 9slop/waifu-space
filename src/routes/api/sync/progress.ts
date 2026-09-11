import { json } from '@solidjs/router';
import { verifySessionToken } from '../../../lib/server/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';
import { COSMETIC_CATALOG } from '../../../lib/store';
import { MAX_COINS } from '../../../lib/economy';

const itemRarity = (itemId: string): string =>
  COSMETIC_CATALOG.find(c => c.id === itemId)?.rarity || 'common';

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Sync progress to cloud database
export async function POST(event: { request: Request }) {
  const authHeader = event.request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(token);

  if (!session) {
    return json({ success: false, error: 'Unauthorized session' }, { status: 401 });
  }

  try {
    const payload = await event.request.json();
    const { waifu, rpg, settings } = payload;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient()!;

      // Fetch current server-side progress so we can reconcile monotonic fields
      const { data: existing } = await supabase
        .from('user_progress').select('coins, defense_high_wave, bond_level').eq('user_id', session.userId).single();

      const incomingCoins = clampInt(rpg?.coins, 0, MAX_COINS, 0);
      const existingCoins = clampInt(existing?.coins, 0, MAX_COINS, 0);
      // Coins are increase-only: a stale client cannot roll back the server balance.
      const dbCoins = Math.min(MAX_COINS, Math.max(existingCoins, incomingCoins));

      const incomingHighWave = clampInt(rpg?.defenseHighWave, 0, 200, 0);
      const existingHighWave = clampInt(existing?.defense_high_wave, 0, 200, 0);
      const dbHighWave = Math.max(existingHighWave, incomingHighWave);

      const incomingBondLevel = clampInt(waifu?.bondLevel, 1, 99999, 1);
      const dbBondLevel = incomingBondLevel;
      const incomingBondExp = clampInt(waifu?.bondExp, 0, Number.MAX_SAFE_INTEGER, 0);

      // Only accept claimed milestones that the current bond level actually grants
      const incomingMilestones = Array.isArray(rpg?.claimedAffectionMilestones)
        ? rpg.claimedAffectionMilestones
            .filter((m: unknown) => typeof m === 'number' && Number.isInteger(m) && m >= 0 && m <= dbBondLevel)
            .slice(0, 200)
        : [];

      await supabase.from('user_progress').upsert({
        user_id: session.userId,
        coins: dbCoins,
        bond_exp: incomingBondExp,
        bond_level: dbBondLevel,
        waifu_name: typeof waifu?.name === 'string' ? waifu.name.slice(0, 40) : 'Akari',
        waifu_personality: typeof waifu?.personality === 'string' ? waifu.personality.slice(0, 40) : 'tsundere',
        worn_outfit: typeof waifu?.appearance?.outfit === 'string' ? waifu.appearance.outfit : 'seifuku',
        worn_accessory: typeof waifu?.appearance?.accessory === 'string' ? waifu.appearance.accessory : 'none',
        worn_hairstyle: typeof waifu?.appearance?.hairstyle === 'string' ? waifu.appearance.hairstyle : 'twintails',
        appearance_data: waifu?.appearance && typeof waifu.appearance === 'object' ? waifu.appearance : {},
        settings_data: settings && typeof settings === 'object' ? settings : {},
        claimed_milestones: incomingMilestones,
        defense_high_wave: dbHighWave,
        defense_victories: clampInt(rpg?.defenseStats?.totalVictories, 0, 1000000, 0),
        goblins_defeated: clampInt(rpg?.defenseStats?.goblinsDefeated, 0, 1000000, 0),
        updated_at: new Date().toISOString()
      });

      // Update showcase slots
      if (Array.isArray(rpg?.showcaseItems)) {
        await supabase.from('user_showcase').delete().eq('user_id', session.userId);
        const validIds = new Set(COSMETIC_CATALOG.map(c => c.id));
        const inserts = rpg.showcaseItems.slice(0, 6)
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

      // Update inventory (all unlocked cosmetics) - only accept catalog-valid ids
      const validCatalog = new Set(COSMETIC_CATALOG.map(c => c.id));
      const unlockedOutfits: string[] = Array.isArray(rpg?.unlockedOutfits) ? rpg.unlockedOutfits.filter((id: unknown) => typeof id === 'string' && validCatalog.has(id)) : [];
      const unlockedAccessories: string[] = Array.isArray(rpg?.unlockedAccessories) ? rpg.unlockedAccessories.filter((id: unknown) => typeof id === 'string' && validCatalog.has(id)) : [];
      const unlockedHairstyles: string[] = Array.isArray(rpg?.unlockedHairstyles) ? rpg.unlockedHairstyles.filter((id: unknown) => typeof id === 'string' && validCatalog.has(id)) : [];

      const allUnlocked = [
        ...unlockedOutfits.filter(id => id !== 'none').map(id => ({ item_id: id, category: 'outfit' })),
        ...unlockedAccessories.filter(id => id !== 'none').map(id => ({ item_id: id, category: 'accessory' })),
        ...unlockedHairstyles.filter(id => id !== 'none').map(id => ({ item_id: id, category: 'hairstyle' }))
      ];

      if (allUnlocked.length > 0) {
        await supabase.from('user_inventory').delete().eq('user_id', session.userId);
        await supabase.from('user_inventory').insert(
          allUnlocked.map(entry => ({
            user_id: session.userId,
            item_id: entry.item_id,
            category: entry.category,
            rarity: itemRarity(entry.item_id)
          }))
        );
      }
    }

    return json({ success: true, syncedAt: new Date().toISOString() });
  } catch (err: any) {
    return json({ success: false, error: err.message || 'Sync failed' }, { status: 500 });
  }
}

// Fetch progress from cloud database
export async function GET(event: { request: Request }) {
  const authHeader = event.request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(token);

  if (!session) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient()!;
    const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', session.userId).single();
    const { data: showcase } = await supabase.from('user_showcase').select('*').eq('user_id', session.userId).order('slot_index');
    const { data: inventory } = await supabase.from('user_inventory').select('item_id, category, rarity').eq('user_id', session.userId);

    return json({
      success: true,
      progress,
      showcaseItems: showcase ? showcase.map((s: any) => s.item_id) : [],
      inventory: inventory || []
    });
  }

  return json({ success: true, progress: null, showcaseItems: [] });
}

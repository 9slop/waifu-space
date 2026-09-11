import { json } from '@solidjs/router';
import { checkRateLimit } from '../../../lib/server/rate-limit';
import { verifySessionToken } from '../../../lib/server/auth';
import { rollLootboxServer } from '../../../lib/server/game-logic';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';
import { COSMETIC_CATALOG } from '../../../lib/store';

export async function POST(event: { request: Request }) {
  const authHeader = event.request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(token);

  if (!session) {
    return json({ success: false, error: 'Unauthorized: You must be logged in to roll gacha.' }, { status: 401 });
  }

  const rateLimitKey = `gacha_${session.userId}`;
  const limit = checkRateLimit(rateLimitKey, 20, 60_000);
  if (!limit.allowed) {
    return json({ success: false, error: 'Rate limit exceeded. Please wait before opening more chests.' }, { status: 429 });
  }

  try {
    const body = await event.request.json();

    // Security Audit: Reject any request that attempts to supply client-defined reward or balance values
    if (
      body.currentCoins !== undefined ||
      body.coins !== undefined ||
      body.unlockedItemIds !== undefined ||
      body.reward !== undefined ||
      body.xp !== undefined ||
      body.item !== undefined
    ) {
      return json(
        { success: false, error: 'Client-defined reward, balance, or inventory values are forbidden.' },
        { status: 400 }
      );
    }

    const { boxType } = body;

    if (boxType !== 'standard' && boxType !== 'royal') {
      return json({ success: false, error: 'Invalid chest type' }, { status: 400 });
    }

    // Server-authoritative transactional path when Supabase is available
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient()!;

      const { data: progress, error: progressErr } = await supabase
        .from('user_progress').select('coins').eq('user_id', session.userId).single();
      if (progressErr && progressErr.code !== 'PGRST116') {
        return json({ success: false, error: 'Failed to fetch user balance' }, { status: 500 });
      }

      const { data: inventory, error: invErr } = await supabase
        .from('user_inventory').select('item_id').eq('user_id', session.userId);
      if (invErr) {
        return json({ success: false, error: 'Failed to fetch user inventory' }, { status: 500 });
      }

      const dbCoins = typeof progress?.coins === 'number' ? progress.coins : 0;
      const unlockedIds = (inventory ?? []).map((r: any) => r.item_id);

      const rollResult = rollLootboxServer(boxType, dbCoins, unlockedIds);
      if (!rollResult.success) {
        return json({ success: false, error: rollResult.error }, { status: 400 });
      }

      const originalCoins = dbCoins;

      // Update coin balance first
      let coinErr: any = null;
      if (progress) {
        const { error } = await supabase
          .from('user_progress')
          .update({
            coins: rollResult.newCoins!,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', session.userId);
        coinErr = error;
      } else {
        const { error } = await supabase
          .from('user_progress')
          .insert({
            user_id: session.userId,
            coins: rollResult.newCoins!,
            bond_exp: 0,
            bond_level: 1,
            waifu_name: 'Akari',
            waifu_personality: 'tsundere',
            worn_outfit: 'seifuku',
            worn_accessory: 'none',
            worn_hairstyle: 'twintails',
            appearance_data: {},
            settings_data: {},
            claimed_milestones: [],
            updated_at: new Date().toISOString()
          });
        coinErr = error;
      }

      if (coinErr) {
        return json({ success: false, error: 'Failed to update coin balance' }, { status: 500 });
      }

      // If granting a new item, insert it. If this fails, rollback the coin update!
      if (rollResult.result && !rollResult.isDuplicate) {
        const item = rollResult.result.item;
        const catalogEntry = COSMETIC_CATALOG.find(c => c.id === item.id);
        const { error: insertErr } = await supabase.from('user_inventory').insert({
          user_id: session.userId,
          item_id: item.id,
          category: catalogEntry?.category ?? 'outfit',
          rarity: item.rarity
        });

        if (insertErr) {
          // Transaction rollback: restore coins so user is not debited when item grant fails
          await supabase
            .from('user_progress')
            .update({
              coins: originalCoins,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', session.userId);
          return json({ success: false, error: 'Failed to grant item to inventory' }, { status: 500 });
        }
      }

      // Audit log (best-effort)
      try {
        await supabase.from('action_logs').insert({
          user_id: session.userId,
          action_type: 'lootbox_open',
          details: {
            box_type: boxType,
            item_id: rollResult.result?.item.id,
            is_duplicate: rollResult.isDuplicate,
            new_coins: rollResult.newCoins
          }
        });
      } catch {
        // ignore log error
      }

      return json({
        success: true,
        result: rollResult.result,
        newCoins: rollResult.newCoins,
        isDuplicate: rollResult.isDuplicate
      });
    }

    // In-memory fallback for local development / testing without Supabase
    const rollResult = rollLootboxServer(boxType, 1000, []);
    if (!rollResult.success) {
      return json({ success: false, error: rollResult.error }, { status: 400 });
    }

    return json({
      success: true,
      result: rollResult.result,
      newCoins: rollResult.newCoins,
      isDuplicate: rollResult.isDuplicate
    });
  } catch (err: any) {
    return json({ success: false, error: err.message || 'Error processing server lootbox roll' }, { status: 500 });
  }
}

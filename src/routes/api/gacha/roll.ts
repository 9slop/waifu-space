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

  const rateLimitKey = session ? `gacha_${session.userId}` : 'gacha_anon';
  const limit = checkRateLimit(rateLimitKey, 20, 60_000);
  if (!limit.allowed) {
    return json({ success: false, error: 'Rate limit exceeded. Please wait before opening more chests.' }, { status: 429 });
  }

  try {
    const { boxType } = await event.request.json();

    if (boxType !== 'standard' && boxType !== 'royal') {
      return json({ success: false, error: 'Invalid chest type' }, { status: 400 });
    }

    // Server-authoritative path when Supabase is available
    if (isSupabaseConfigured() && session) {
      const supabase = getSupabaseServerClient()!;

      const { data: progress } = await supabase
        .from('user_progress').select('coins').eq('user_id', session.userId).single();
      const { data: inventory } = await supabase
        .from('user_inventory').select('item_id').eq('user_id', session.userId);

      const dbCoins = typeof progress?.coins === 'number' ? progress.coins : 0;
      const unlockedIds = (inventory ?? []).map((r: any) => r.item_id);

      const rollResult = rollLootboxServer(boxType, dbCoins, unlockedIds);
      if (!rollResult.success) {
        return json({ success: false, error: rollResult.error }, { status: 400 });
      }

      // Persist: update coin balance
      await supabase.from('user_progress').upsert({
        user_id: session.userId,
        coins: rollResult.newCoins!,
        updated_at: new Date().toISOString()
      });

      // Insert newly unlocked item (duplicates are not inserted; only coin compensation is granted)
      if (rollResult.result && !rollResult.isDuplicate) {
        const item = rollResult.result.item;
        const catalogEntry = COSMETIC_CATALOG.find(c => c.id === item.id);
        await supabase.from('user_inventory').insert({
          user_id: session.userId,
          item_id: item.id,
          category: catalogEntry?.category ?? 'outfit',
          rarity: item.rarity
        });
      }

      // Audit log
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

      return json({
        success: true,
        result: rollResult.result,
        newCoins: rollResult.newCoins,
        isDuplicate: rollResult.isDuplicate
      });
    }

    // Demo / offline fallback: client supplies coins and unlocked list
    const body = await event.request.json();
    const rollResult = rollLootboxServer(
      boxType,
      typeof body.currentCoins === 'number' ? body.currentCoins : 0,
      Array.isArray(body.unlockedItemIds) ? body.unlockedItemIds : []
    );

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

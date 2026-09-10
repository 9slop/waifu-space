import { json } from '@solidjs/router';
import { verifySessionToken } from '../../../lib/server/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';
import { COSMETIC_CATALOG } from '../../../lib/store';

const itemRarity = (itemId: string): string =>
  COSMETIC_CATALOG.find(c => c.id === itemId)?.rarity || 'common';

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
      await supabase.from('user_progress').upsert({
        user_id: session.userId,
        coins: rpg?.coins ?? 0,
        bond_exp: waifu?.bondExp ?? 0,
        bond_level: waifu?.bondLevel ?? 1,
        waifu_name: waifu?.name || 'Akari',
        waifu_personality: waifu?.personality || 'tsundere',
        worn_outfit: waifu?.appearance?.outfit || 'seifuku',
        worn_accessory: waifu?.appearance?.accessory || 'none',
        worn_hairstyle: waifu?.appearance?.hairstyle || 'twintails',
        appearance_data: waifu?.appearance || {},
        settings_data: settings || {},
        claimed_milestones: rpg?.claimedAffectionMilestones || [],
        defense_high_wave: rpg?.defenseHighWave || 0,
        defense_victories: rpg?.defenseStats?.totalVictories || 0,
        goblins_defeated: rpg?.defenseStats?.goblinsDefeated || 0,
        updated_at: new Date().toISOString()
      });

      // Update showcase slots
      if (Array.isArray(rpg?.showcaseItems)) {
        await supabase.from('user_showcase').delete().eq('user_id', session.userId);
        const inserts = rpg.showcaseItems.slice(0, 6).map((itemId: string, slotIndex: number) => ({
          user_id: session.userId,
          slot_index: slotIndex,
          item_id: itemId
        }));
        if (inserts.length > 0) {
          await supabase.from('user_showcase').insert(inserts);
        }
      }

      // Update inventory (all unlocked cosmetics)
      const unlockedOutfits: string[] = Array.isArray(rpg?.unlockedOutfits) ? rpg.unlockedOutfits : [];
      const unlockedAccessories: string[] = Array.isArray(rpg?.unlockedAccessories) ? rpg.unlockedAccessories : [];
      const unlockedHairstyles: string[] = Array.isArray(rpg?.unlockedHairstyles) ? rpg.unlockedHairstyles : [];

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

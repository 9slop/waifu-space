import { json } from '@solidjs/router';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../lib/server/supabase';

export async function GET(event: { request: Request }) {
  const url = new URL(event.request.url);
  const targetUsername = url.searchParams.get('user') || url.searchParams.get('username');

  if (!targetUsername || !targetUsername.trim()) {
    return json({ success: false, error: 'Username is required' }, { status: 400 });
  }

  const cleanName = targetUsername.trim();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient()!;

    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, created_at')
      .ilike('username', cleanName)
      .maybeSingle();

    if (profileErr || !userProfile) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const [progressRes, showcaseRes, inventoryRes] = await Promise.all([
      supabase.from('user_progress').select('*').eq('user_id', userProfile.id).maybeSingle(),
      supabase.from('user_showcase').select('slot_index, item_id').eq('user_id', userProfile.id).order('slot_index'),
      supabase.from('user_inventory').select('item_id').eq('user_id', userProfile.id)
    ]);

    const progress = progressRes.data;
    const showcase = showcaseRes.data || [];
    const inventory = inventoryRes.data || [];

    return json({
      success: true,
      profile: {
        id: userProfile.id,
        username: userProfile.username,
        avatarUrl: userProfile.avatar_url || '',
        bio: userProfile.bio || '',
        createdAt: userProfile.created_at,
        stats: {
          coins: Number(progress?.coins || 0),
          defenseHighWave: progress?.defense_high_wave || 0,
          goblinsDefeated: progress?.goblins_defeated || 0,
          totalVictories: progress?.defense_victories || 0,
          bondLevel: progress?.bond_level || 1,
          cosmeticsUnlocked: inventory.length
        },
        waifu: {
          name: progress?.waifu_name || 'Akari',
          personality: progress?.waifu_personality || 'tsundere',
          appearance: progress?.appearance_data || {
            outfit: progress?.worn_outfit || 'seifuku',
            accessory: progress?.worn_accessory || 'ribbon',
            hairstyle: progress?.worn_hairstyle || 'twintails'
          }
        },
        showcaseItems: showcase.map(s => s.item_id)
      }
    });
  }

  // Fallback demo user profiles
  if (cleanName.toLowerCase() === 'senpaicommander' || cleanName.toLowerCase() === 'demo') {
    return json({
      success: true,
      profile: {
        id: 'demo_user',
        username: cleanName,
        avatarUrl: '',
        bio: 'Commander of WaifuSpace! Defense expert.',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        stats: {
          coins: 1500,
          defenseHighWave: 25,
          goblinsDefeated: 340,
          totalVictories: 8,
          bondLevel: 9,
          cosmeticsUnlocked: 12
        },
        waifu: {
          name: 'Akari',
          personality: 'tsundere',
          appearance: {
            outfit: 'kimono',
            accessory: 'flower_pin',
            hairstyle: 'twintails',
            hairColor: '#ff7597',
            eyeColor: '#4f86f7',
            skinTone: '#fff1eb'
          }
        },
        showcaseItems: ['kimono', 'flower_pin']
      }
    });
  }

  return json({ success: false, error: 'User not found' }, { status: 404 });
}

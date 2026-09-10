import { json } from '@solidjs/router';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../lib/server/supabase';

export async function GET(event: { request: Request }) {
  const url = new URL(event.request.url);
  const sort = url.searchParams.get('sort') || 'wave';

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient()!;
    let query = supabase.from('leaderboard_view').select('*').limit(20);

    if (sort === 'bond') {
      query = query.order('bond_level', { ascending: false });
    } else if (sort === 'goblins') {
      query = query.order('goblins_defeated', { ascending: false });
    } else {
      query = query.order('defense_high_wave', { ascending: false });
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      const entries = data.map((d: any, i: number) => ({
        rank: i + 1,
        username: d.username,
        avatarUrl: d.avatar_url || '',
        defenseHighWave: d.defense_high_wave || 0,
        bondLevel: d.bond_level || 1,
        coins: Number(d.coins || 0),
        goblinsDefeated: d.goblins_defeated || 0
      }));
      return json({ success: true, entries });
    }
  }

  // Fallback demo global board
  const base = [
    { rank: 1, username: 'SakuraEmpress', avatarUrl: '', defenseHighWave: 45, bondLevel: 25, coins: 14500, goblinsDefeated: 620 },
    { rank: 2, username: 'ShadowBlade99', avatarUrl: '', defenseHighWave: 38, bondLevel: 19, coins: 9800, goblinsDefeated: 480 },
    { rank: 3, username: 'AkariDevotee', avatarUrl: '', defenseHighWave: 32, bondLevel: 22, coins: 7200, goblinsDefeated: 390 },
    { rank: 4, username: 'LunaMage', avatarUrl: '', defenseHighWave: 27, bondLevel: 14, coins: 4100, goblinsDefeated: 310 },
    { rank: 5, username: 'OtakuSupreme', avatarUrl: '', defenseHighWave: 22, bondLevel: 12, coins: 3300, goblinsDefeated: 240 }
  ];

  if (sort === 'bond') {
    base.sort((a, b) => b.bondLevel - a.bondLevel);
  } else if (sort === 'goblins') {
    base.sort((a, b) => b.goblinsDefeated - a.goblinsDefeated);
  } else {
    base.sort((a, b) => b.defenseHighWave - a.defenseHighWave);
  }

  base.forEach((e, i) => (e.rank = i + 1));
  return json({ success: true, entries: base });
}

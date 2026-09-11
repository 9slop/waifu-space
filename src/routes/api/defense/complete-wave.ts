import { json } from '@solidjs/router';
import { checkRateLimit } from '../../../lib/server/rate-limit';
import { verifySessionToken } from '../../../lib/server/auth';
import { completeDefenseWave } from '../../../lib/server/defense-session';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';
import { computeBondProgression, MAX_COINS } from '../../../lib/economy';

export async function POST(event: { request: Request }) {
  const authHeader = event.request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(token);

  if (!session) {
    return json({ verified: false, error: 'Unauthorized: You must be signed in to submit waves.' }, { status: 401 });
  }

  const rateLimitKey = `def_${session.userId}`;
  const limit = checkRateLimit(rateLimitKey, 15, 60_000);
  if (!limit.allowed) {
    return json({ verified: false, error: 'Too many wave submissions. Slow down.' }, { status: 429 });
  }

  try {
    const body = await event.request.json();

    // Security Audit: Reject any request containing client-defined reward values
    if (
      body.coins !== undefined ||
      body.currentCoins !== undefined ||
      body.coinsReward !== undefined ||
      body.exp !== undefined ||
      body.expReward !== undefined ||
      body.reward !== undefined ||
      body.goblinsDefeated !== undefined ||
      body.silver !== undefined ||
      body.trust !== undefined
    ) {
      return json({ verified: false, error: 'Client-defined reward values are strictly forbidden.' }, { status: 400 });
    }

    const userId = session.userId;
    const spendDeltas = Array.isArray(body.spends) ? body.spends : [];

    const result = completeDefenseWave(
      userId,
      typeof body.wave === 'number' ? body.wave : 0,
      typeof body.durationMs === 'number' ? body.durationMs : 0,
      spendDeltas
    );

    if (!result.verified) {
      return json({ verified: false, error: result.error }, { status: 400 });
    }

    // Server-authoritative persistence when Supabase + a session are available.
    // Coins / exp / defense stats are all derived server-side from the verified
    // wave, so a client cannot mint currency or stats from the console.
    if (isSupabaseConfigured() && session) {
      const supabase = getSupabaseServerClient()!;

      const { data: progress } = await supabase
        .from('user_progress')
        .select('coins, bond_exp, bond_level, defense_high_wave, defense_victories, goblins_defeated')
        .eq('user_id', session.userId)
        .single();

      const prevCoins = typeof progress?.coins === 'number' ? progress.coins : 0;
      const prevExp = typeof progress?.bond_exp === 'number' ? progress.bond_exp : 0;
      const prevLevel = typeof progress?.bond_level === 'number' ? progress.bond_level : 1;
      const prevHighWave = typeof progress?.defense_high_wave === 'number' ? progress.defense_high_wave : 0;
      const prevVictories = typeof progress?.defense_victories === 'number' ? progress.defense_victories : 0;
      const prevGoblins = typeof progress?.goblins_defeated === 'number' ? progress.goblins_defeated : 0;

      const newCoins = Math.min(MAX_COINS, prevCoins + result.coinsReward);
      const { bondExp, bondLevel } = computeBondProgression(prevExp, prevLevel, result.expReward);

      await supabase.from('user_progress').upsert({
        user_id: session.userId,
        coins: newCoins,
        bond_exp: bondExp,
        bond_level: bondLevel,
        defense_high_wave: Math.max(prevHighWave, result.nextWave - 1),
        defense_victories: prevVictories + 1,
        goblins_defeated: prevGoblins + result.goblinsDefeated,
        updated_at: new Date().toISOString()
      });

      await supabase.from('action_logs').insert({
        user_id: session.userId,
        action_type: 'defense_wave_clear',
        details: {
          wave: result.nextWave - 1,
          has_boss: result.hasBoss,
          coins_reward: result.coinsReward,
          exp_reward: result.expReward,
          silver_earned: result.silverEarned,
          silver_balance: result.silver,
          goblins_defeated: result.goblinsDefeated
        }
      });
    }

    return json({
      verified: true,
      coinsReward: result.coinsReward,
      expReward: result.expReward,
      silverEarned: result.silverEarned,
      silver: result.silver,
      goblinsDefeated: result.goblinsDefeated,
      nextWave: result.nextWave,
      hasBoss: result.hasBoss
    });
  } catch (err: any) {
    return json({ verified: false, error: err.message || 'Error completing defense wave' }, { status: 500 });
  }
}
import { getSessionTokenFromRequest, verifySessionToken } from '../../../lib/server/auth';
import { isSupabaseConfigured, getSupabaseServerClient } from '../../../lib/server/supabase';
import { clampNumber } from '../../../lib/validation';

export async function POST({ request }: { request: Request }) {
  try {
    let token = getSessionTokenFromRequest(request);
    if (!token) {
      const authHeader = request.headers.get('Authorization') || '';
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    const payload = token ? verifySessionToken(token) : null;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const durationSeconds = clampNumber(Number(body.durationSeconds) || 0, 1, 86400);
    const rawKills = clampNumber(Number(body.kills) || 0, 0, 1000);
    const deaths = clampNumber(Number(body.deaths) || 0, 0, 1000);
    const rawHeadshots = clampNumber(Number(body.headshots) || 0, 0, rawKills);
    const rawStreak = clampNumber(Number(body.bestStreak) || 0, 0, rawKills);
    const damageDealt = clampNumber(Number(body.damageDealt) || 0, 0, 100000);

    // Anti-tampering check: max plausible kills per second (1.5 kills/sec)
    const maxPlausibleKills = Math.max(10, Math.ceil(durationSeconds * 1.5));
    const kills = Math.min(rawKills, maxPlausibleKills);
    const headshots = Math.min(rawHeadshots, kills);
    const bestStreak = Math.min(rawStreak, kills);

    // Compute rewards
    const coinsEarned = kills * 8 + (bestStreak >= 5 ? 25 : 0);
    const expEarned = kills * 15 + headshots * 10 + (bestStreak >= 5 ? 50 : 0);

    let newCoins = coinsEarned;
    let newBondExp = expEarned;

    const userId = payload?.userId || (payload as any)?.sub;

    if (userId && isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        // Fetch current progress
        const { data: progress } = await supabase
          .from('user_progress')
          .select('coins, bond_exp, settings_data')
          .eq('user_id', userId)
          .single();

        const curCoins = Number(progress?.coins) || 0;
        const curExp = Number(progress?.bond_exp) || 0;
        newCoins = curCoins + coinsEarned;
        newBondExp = curExp + expEarned;

        const curSettings = (progress?.settings_data as Record<string, any>) || {};
        const curStrike = curSettings.waifuStrike || {
          kills: 0,
          deaths: 0,
          headshots: 0,
          bestStreak: 0,
          matches: 0
        };

        const updatedStrike = {
          kills: (curStrike.kills || 0) + kills,
          deaths: (curStrike.deaths || 0) + deaths,
          headshots: (curStrike.headshots || 0) + headshots,
          bestStreak: Math.max(curStrike.bestStreak || 0, bestStreak),
          matches: (curStrike.matches || 0) + 1
        };

        await supabase
          .from('user_progress')
          .update({
            coins: newCoins,
            bond_exp: newBondExp,
            settings_data: {
              ...curSettings,
              waifuStrike: updatedStrike
            }
          })
          .eq('user_id', userId);

        // Audit log
        await supabase.from('action_logs').insert({
          user_id: userId,
          action_type: 'strike_match_complete',
          details: {
            kills,
            deaths,
            headshots,
            bestStreak,
            damageDealt,
            durationSeconds,
            coinsEarned,
            expEarned
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        authenticated: Boolean(userId),
        kills,
        headshots,
        bestStreak,
        coinsEarned,
        expEarned,
        newCoins,
        newBondExp
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

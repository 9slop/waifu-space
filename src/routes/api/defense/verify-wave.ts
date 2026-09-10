import { json } from '@solidjs/router';
import { checkRateLimit } from '../../../lib/server/rate-limit';
import { verifySessionToken } from '../../../lib/server/auth';
import { verifyDefenseWaveServer } from '../../../lib/server/game-logic';

export async function POST(event: { request: Request }) {
  const authHeader = event.request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(token);

  const rateLimitKey = session ? `def_${session.userId}` : 'def_anon';
  const limit = checkRateLimit(rateLimitKey, 15, 60_000);
  if (!limit.allowed) {
    return json({ verified: false, error: 'Too many wave submissions. Slow down.' }, { status: 429 });
  }

  try {
    const { wave, durationMs } = await event.request.json();

    const verification = verifyDefenseWaveServer(
      typeof wave === 'number' ? wave : 1,
      typeof durationMs === 'number' ? durationMs : 5000
    );

    if (!verification.verified) {
      return json({ verified: false, error: verification.error }, { status: 400 });
    }

    return json({
      verified: true,
      coinsReward: verification.coinsReward,
      expReward: verification.expReward
    });
  } catch (err: any) {
    return json({ verified: false, error: err.message || 'Error verifying defense wave' }, { status: 500 });
  }
}

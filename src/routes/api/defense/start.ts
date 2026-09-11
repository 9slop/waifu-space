import { json } from '@solidjs/router';
import { checkRateLimit } from '../../../lib/server/rate-limit';
import { verifySessionToken } from '../../../lib/server/auth';
import { startDefenseSession } from '../../../lib/server/defense-session';
import { SILVER_STARTER } from '../../../lib/defense-balance';

export async function POST(event: { request: Request }) {
  const authHeader = event.request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(token);

  if (!session) {
    return json({ success: false, error: 'Unauthorized: You must be signed in to play.' }, { status: 401 });
  }

  const rateLimitKey = `def_start_${session.userId}`;
  const limit = checkRateLimit(rateLimitKey, 10, 60_000);
  if (!limit.allowed) {
    return json({ success: false, error: 'Too many game restarts. Slow down.' }, { status: 429 });
  }

  try {
    // A new game always starts a fresh server-side session, resetting silver.
    const userId = session.userId;
    const activeSession = startDefenseSession(userId);

    return json({
      success: true,
      silver: activeSession.silver,
      silverStarter: SILVER_STARTER,
      wave: activeSession.wave,
      gameId: activeSession.gameId
    });
  } catch (err: any) {
    return json({ success: false, error: err.message || 'Error starting defense game' }, { status: 500 });
  }
}
import { json } from '@solidjs/router';
import { checkRateLimit } from '../../../lib/server/rate-limit';
import { verifySessionToken } from '../../../lib/server/auth';
import { rollLootboxServer } from '../../../lib/server/game-logic';

export async function POST(event: { request: Request }) {
  const authHeader = event.request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(token);

  // Rate limiting per user / IP
  const rateLimitKey = session ? `gacha_${session.userId}` : 'gacha_anon';
  const limit = checkRateLimit(rateLimitKey, 20, 60_000);
  if (!limit.allowed) {
    return json({ success: false, error: 'Rate limit exceeded. Please wait before opening more chests.' }, { status: 429 });
  }

  try {
    const { boxType, currentCoins, unlockedItemIds } = await event.request.json();

    if (boxType !== 'standard' && boxType !== 'royal') {
      return json({ success: false, error: 'Invalid chest type' }, { status: 400 });
    }

    const rollResult = rollLootboxServer(
      boxType,
      typeof currentCoins === 'number' ? currentCoins : 0,
      Array.isArray(unlockedItemIds) ? unlockedItemIds : []
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

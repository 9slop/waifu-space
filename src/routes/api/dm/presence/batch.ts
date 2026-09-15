import { json } from '@solidjs/router';
import { resolveDmContext, isUuidLike } from '../../../../lib/server/dm-context';
import type { UserPresence, PresenceStatus } from '../../../../lib/dm/types';

export async function GET(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const url = new URL(event.request.url);
  const rawIds = (url.searchParams.get('userIds') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(isUuidLike)
    .slice(0, 100);

  if (rawIds.length === 0) {
    return json({ success: true, presence: {} });
  }

  const { data, error } = await ctx.supabase.rpc('get_user_presence_batch', {
    p_user_ids: rawIds
  });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  const presence: Record<string, UserPresence> = {};
  if (data && typeof data === 'object') {
    for (const [uid, value] of Object.entries(data as Record<string, any>)) {
      presence[uid] = {
        userId: value.userId,
        status: value.status as PresenceStatus,
        customStatus: value.customStatus ?? null,
        lastSeenAt: value.lastSeenAt
      };
    }
  }

  return json({ success: true, presence });
}
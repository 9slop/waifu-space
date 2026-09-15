import { json } from '@solidjs/router';
import { resolveDmContext } from '../../../../lib/server/dm-context';
import type { CallSession } from '../../../../lib/dm/types';

/**
 * Recovery path for the lossy realtime call-offer channel: returns the newest
 * ringing/active call (from `get_pending_call_for_user`) the current user is a
 * party to, or null. The client polls this so a missed broadcast or a refresh
 * never hides an in-progress call.
 */
export async function GET(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.supabase.rpc('get_pending_call_for_user', {
    p_user_id: ctx.session.userId
  });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return json({ success: true, call: null });
  }

  const c = data as any;
  const call: CallSession = {
    id: c.id,
    conversationId: c.conversationId,
    callerId: c.callerId,
    calleeId: c.calleeId,
    callType: c.callType,
    status: c.status,
    startedAt: c.startedAt,
    answeredAt: c.answeredAt ?? null,
    endedAt: c.endedAt ?? null,
    createdAt: c.createdAt
  };

  return json({ success: true, call });
}
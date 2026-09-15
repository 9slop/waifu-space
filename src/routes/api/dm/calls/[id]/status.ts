import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse } from '../../../../../lib/server/dm-context';
import type { CallSession, CallStatus } from '../../../../../lib/dm/types';

const VALID_STATUSES: CallStatus[] = ['ringing', 'active', 'ended', 'declined', 'missed', 'canceled', 'busy'];

export async function POST(event: { request: Request; params: Record<string, string> }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const callId = event.params.id;
  if (!callId) return badRequestResponse('call id is required');

  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const status = body?.status as CallStatus | undefined;
  if (!status || !VALID_STATUSES.includes(status)) {
    return badRequestResponse('Invalid call status');
  }

  const { data, error } = await ctx.supabase.rpc('update_call_session', {
    p_user_id: ctx.session.userId,
    p_call_id: callId,
    p_status: status
  });

  if (error) {
    if (error.message.includes('not a participant')) {
      return json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return json({ success: false, error: error.message }, { status: 500 });
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

  const systemMessage = c.systemMessage ?? null;
  if (systemMessage) {
    systemMessage.conversationId = call.conversationId;
    systemMessage.senderId = systemMessage.senderId ?? call.callerId;
  }

  return json({ success: true, call, systemMessage });
}
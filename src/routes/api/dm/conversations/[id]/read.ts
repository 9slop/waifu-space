import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse } from '../../../../../lib/server/dm-context';

export async function POST(event: { request: Request; params: Record<string, string> }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const conversationId = event.params.id;
  if (!conversationId) return badRequestResponse('conversation id is required');

  const { error } = await ctx.supabase.rpc('mark_dm_conversation_read', {
    p_user_id: ctx.session.userId,
    p_conversation_id: conversationId
  });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  return json({ success: true, unreadCount: 0 });
}
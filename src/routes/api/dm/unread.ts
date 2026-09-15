import { json } from '@solidjs/router';
import { resolveDmContext } from '../../../lib/server/dm-context';

export async function GET(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.supabase.rpc('count_dm_unread', {
    p_user_id: ctx.session.userId
  });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  return json({ success: true, totalUnread: Number(data ?? 0) });
}
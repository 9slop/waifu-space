import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse, sanitizeSearchQuery } from '../../../lib/server/dm-context';
import type { DmUserLite, PresenceStatus } from '../../../lib/dm/types';

export async function GET(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const url = new URL(event.request.url);
  const query = sanitizeSearchQuery(url.searchParams.get('q'));

  if (!query || query.length < 2) {
    return badRequestResponse('Search query must be at least 2 characters');
  }

  const { data: profiles, error } = await ctx.supabase
    .from('profiles')
    .select('id, username, avatar_url, bio')
    .ilike('username', `%${query}%`)
    .neq('id', ctx.session.userId)
    .limit(12);

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  const ids = (profiles ?? []).map((p: any) => p.id);
  const presenceMap: Record<string, any> = {};
  if (ids.length > 0) {
    const { data: presence } = await ctx.supabase.rpc('get_user_presence_batch', { p_user_ids: ids });
    if (presence && typeof presence === 'object') {
      for (const [uid, value] of Object.entries(presence as Record<string, any>)) {
        presenceMap[uid] = value;
      }
    }
  }

  const users: DmUserLite[] = (profiles ?? []).map((p: any) => ({
    id: p.id,
    username: p.username,
    avatarUrl: p.avatar_url ?? '',
    bio: p.bio ?? '',
    presenceStatus: (presenceMap[p.id]?.status as PresenceStatus) ?? 'offline',
    customStatus: presenceMap[p.id]?.customStatus ?? null
  }));

  return json({ success: true, users });
}
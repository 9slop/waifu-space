import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse, isUuidLike } from '../../../lib/server/dm-context';
import type { DmConversationSummary } from '../../../lib/dm/types';

export async function GET(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.supabase.rpc('get_dm_conversations', {
    p_user_id: ctx.session.userId
  });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  const conversations = (Array.isArray(data) ? data : []).map((c: any): DmConversationSummary => ({
    id: c.id,
    type: 'dm',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastReadAt: c.lastReadAt ?? null,
    unreadCount: Number(c.unreadCount ?? 0),
    lastMessage: c.lastMessage ?? null,
    otherUser: {
      id: c.otherUser?.id,
      username: c.otherUser?.username ?? 'unknown',
      avatarUrl: c.otherUser?.avatarUrl ?? '',
      bio: c.otherUser?.bio ?? '',
      presenceStatus: c.otherUser?.presenceStatus ?? 'offline',
      customStatus: c.otherUser?.customStatus ?? null
    }
  }));

  return json({ success: true, conversations });
}

export async function POST(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const otherUserId = body?.userId;
  if (!isUuidLike(otherUserId)) {
    return badRequestResponse('userId must be a valid user id');
  }

  const { data, error } = await ctx.supabase.rpc('get_or_create_dm_conversation', {
    p_user_id: ctx.session.userId,
    p_other_user_id: otherUserId
  });

  if (error) {
    if (error.message.includes('does not exist')) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (error.message.includes('cannot DM yourself')) {
      return badRequestResponse('Cannot start a conversation with yourself');
    }
    return json({ success: false, error: error.message }, { status: 500 });
  }

  const c = data as any;
  const conversation: DmConversationSummary = {
    id: c.id,
    type: 'dm',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastReadAt: c.lastReadAt ?? null,
    unreadCount: Number(c.unreadCount ?? 0),
    lastMessage: c.lastMessage ?? null,
    otherUser: {
      id: c.otherUser?.id,
      username: c.otherUser?.username ?? 'unknown',
      avatarUrl: c.otherUser?.avatarUrl ?? '',
      bio: c.otherUser?.bio ?? '',
      presenceStatus: c.otherUser?.presenceStatus ?? 'offline',
      customStatus: c.otherUser?.customStatus ?? null
    }
  };

  return json({ success: true, conversation }, { status: 201 });
}
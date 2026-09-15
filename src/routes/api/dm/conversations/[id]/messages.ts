import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse } from '../../../../../lib/server/dm-context';
import type { DmMessage, DmReaction, MessageType } from '../../../../../lib/dm/types';

const MAX_MESSAGE_LENGTH = 4000;
const VALID_MESSAGE_TYPES: MessageType[] = ['text', 'gif', 'image', 'video'];

function toMessageType(raw: any): MessageType {
  if (raw === 'gif' || raw === 'image' || raw === 'video' || raw === 'system') return raw;
  return 'text';
}

function parseReactions(raw: any): DmReaction[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => ({
    emoji: String(r?.emoji ?? ''),
    count: Number(r?.count ?? (Array.isArray(r?.userIds) ? r.userIds.length : 0)),
    userIds: Array.isArray(r?.userIds) ? r.userIds.map(String) : []
  }));
}

function toMessage(m: any): DmMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.content ?? '',
    messageType: toMessageType(m.messageType),
    mediaUrl: m.mediaUrl ?? null,
    createdAt: m.createdAt,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
    replyToId: m.replyToId ?? null,
    reactions: parseReactions(m.reactions)
  };
}

export async function GET(event: { request: Request; params: Record<string, string> }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const conversationId = event.params.id;
  if (!conversationId) return badRequestResponse('conversation id is required');

  const url = new URL(event.request.url);
  const before = url.searchParams.get('before') || undefined;
  const rawLimit = Number(url.searchParams.get('limit') || 50);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;

  const { data, error } = await ctx.supabase.rpc('get_dm_messages', {
    p_user_id: ctx.session.userId,
    p_conversation_id: conversationId,
    p_before: before || null,
    p_limit: limit
  });

  if (error) {
    if (error.message.includes('not a participant')) {
      return json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return json({ success: false, error: error.message }, { status: 500 });
  }

  const messages: DmMessage[] = (Array.isArray(data) ? data : []).map(toMessage);

  return json({ success: true, messages });
}

export async function POST(event: { request: Request; params: Record<string, string> }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const conversationId = event.params.id;
  if (!conversationId) return badRequestResponse('conversation id is required');

  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const rawType = body?.messageType;
  const messageType: MessageType = VALID_MESSAGE_TYPES.includes(rawType) ? rawType : 'text';
  const content = typeof body?.content === 'string' ? body.content.slice(0, MAX_MESSAGE_LENGTH) : '';
  const mediaUrl = typeof body?.mediaUrl === 'string' ? body.mediaUrl.slice(0, 2048) : null;
  const replyToId = typeof body?.replyToId === 'string' && body.replyToId.length <= 64 ? body.replyToId : null;

  if (messageType === 'text' && content.trim() === '') {
    return badRequestResponse('Message cannot be empty');
  }
  if (messageType !== 'text' && !mediaUrl) {
    return badRequestResponse(`${messageType} messages require a media URL`);
  }
  if (mediaUrl && !/^https?:\/\//i.test(mediaUrl) && mediaUrl.length <= 2048) {
    return badRequestResponse('mediaUrl must be an absolute http(s) URL');
  }

  const { data, error } = await ctx.supabase.rpc('send_dm_message', {
    p_user_id: ctx.session.userId,
    p_conversation_id: conversationId,
    p_content: messageType === 'text' ? content : '',
    p_message_type: messageType,
    p_media_url: mediaUrl,
    p_reply_to_id: replyToId
  });

  if (error) {
    if (error.message.includes('not a participant')) {
      return json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return json({ success: false, error: error.message }, { status: 500 });
  }

  const m = data as any;
  const message = toMessage(m);

  return json({ success: true, message }, { status: 201 });
}

export async function PATCH(event: { request: Request; params: Record<string, string> }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const messageId = typeof body?.messageId === 'string' ? body.messageId : null;
  if (!messageId) return badRequestResponse('message id is required');

  const content = typeof body?.content === 'string' ? body.content.slice(0, MAX_MESSAGE_LENGTH) : '';
  if (content.trim() === '') return badRequestResponse('Message cannot be empty');

  const { data, error } = await ctx.supabase.rpc('update_dm_message', {
    p_user_id: ctx.session.userId,
    p_message_id: messageId,
    p_content: content
  });

  if (error) {
    if (error.message.includes('only the sender')) {
      return json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return json({ success: false, error: error.message }, { status: 500 });
  }

  return json({ success: true, message: toMessage(data as any) });
}

export async function DELETE(event: { request: Request; params: Record<string, string> }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const messageId = typeof body?.messageId === 'string' ? body.messageId : null;
  if (!messageId) return badRequestResponse('message id is required');

  const { error } = await ctx.supabase.rpc('delete_dm_message', {
    p_user_id: ctx.session.userId,
    p_message_id: messageId
  });

  if (error) {
    if (error.message.includes('only the sender')) {
      return json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return json({ success: false, error: error.message }, { status: 500 });
  }

  return json({ success: true });
}
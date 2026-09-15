import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse } from '../../../lib/server/dm-context';
import { isSingleEmoji } from '../../../lib/dm/emoji';
import type { DmReaction } from '../../../lib/dm/types';

function parseReactions(raw: any): DmReaction[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => ({
    emoji: String(r?.emoji ?? ''),
    count: Number(r?.count ?? (Array.isArray(r?.userIds) ? r.userIds.length : 0)),
    userIds: Array.isArray(r?.userIds) ? r.userIds.map(String) : []
  }));
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

  const messageId = typeof body?.messageId === 'string' ? body.messageId : '';
  const emoji = typeof body?.emoji === 'string' ? body.emoji : '';

  if (!messageId) return badRequestResponse('messageId is required');
  if (!isSingleEmoji(emoji)) return badRequestResponse('emoji must be a single emoji');

  const { data, error } = await ctx.supabase.rpc('toggle_message_reaction', {
    p_user_id: ctx.session.userId,
    p_message_id: messageId,
    p_emoji: emoji
  });

  if (error) {
    if (error.message.includes('not a participant')) {
      return json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (error.message.includes('too many distinct reactions')) {
      return json({ success: false, error: error.message }, { status: 422 });
    }
    return json({ success: false, error: error.message }, { status: 500 });
  }

  const d = data as any;
  return json({
    success: true,
    messageId,
    emoji,
    action: d?.action === 'remove' ? 'remove' : 'add',
    reactions: parseReactions(d?.reactions)
  });
}
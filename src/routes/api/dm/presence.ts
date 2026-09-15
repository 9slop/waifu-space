import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse } from '../../../lib/server/dm-context';
import type { PresenceStatus, UserPresence } from '../../../lib/dm/types';

const VALID_STATUSES: PresenceStatus[] = ['online', 'idle', 'dnd', 'invisible', 'offline'];

function toPresence(row: any): UserPresence {
  return {
    userId: row.userId,
    status: row.status as PresenceStatus,
    customStatus: row.customStatus ?? null,
    lastSeenAt: row.lastSeenAt
  };
}

export async function GET(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.supabase.rpc('get_own_presence', {
    p_user_id: ctx.session.userId
  });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return json({ success: true, presence: { userId: ctx.session.userId, status: 'offline', customStatus: null, lastSeenAt: new Date().toISOString() } });
  }

  return json({ success: true, presence: toPresence(data) });
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

  const status = body?.status as PresenceStatus | undefined;
  if (!status || !VALID_STATUSES.includes(status)) {
    return badRequestResponse('Invalid presence status');
  }

  const customStatus =
    typeof body?.customStatus === 'string' ? body.customStatus.trim().slice(0, 128) || null : null;

  const { data, error } = await ctx.supabase.rpc('upsert_user_presence', {
    p_user_id: ctx.session.userId,
    p_status: status,
    p_custom_status: customStatus,
    p_last_seen: null
  });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  return json({ success: true, presence: toPresence(data) });
}
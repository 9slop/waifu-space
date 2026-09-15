import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  state: {
    configured: true,
    client: null as any | null,
    db: {
      profiles: [] as any[],
      user_progress: [] as any[],
      conversations: [] as any[],
      conversation_participants: [] as any[],
      messages: [] as any[],
      user_presence: [] as any[],
      call_sessions: [] as any[]
    }
  }
}));

vi.mock('../../src/lib/server/supabase', () => ({
  isSupabaseConfigured: () => mocks.state.configured,
  getSupabaseServerClient: () => mocks.state.client
}));

import { GET as conversationsGET, POST as conversationsPOST } from '../../src/routes/api/dm/conversations';
import { GET as messagesGET, POST as messagesPOST, PATCH as messagesPATCH, DELETE as messagesDELETE } from '../../src/routes/api/dm/conversations/[id]/messages';
import { POST as markReadPOST } from '../../src/routes/api/dm/conversations/[id]/read';
import { GET as searchGET } from '../../src/routes/api/dm/search';
import { GET as unreadGET } from '../../src/routes/api/dm/unread';
import { GET as presenceGET, POST as presencePOST } from '../../src/routes/api/dm/presence';
import { GET as presenceBatchGET } from '../../src/routes/api/dm/presence/batch';
import { createSessionToken } from '../../src/lib/server/auth';

export { mocks };

let seq = 100;

export function nowIso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

export function nextId(prefix = 'id'): string {
  seq += 1;
  return `${prefix}_${seq}`;
}

export function addProfile(id: string, username: string, extra: any = {}) {
  mocks.state.db.profiles.push({ id, username, avatar_url: '', bio: 'bio from ' + username, ...extra });
  mocks.state.db.user_progress.push({
    user_id: id,
    coins: 0,
    bond_level: 1,
    waifu_personality: 'tsundere',
    appearance_data: {},
    ...(extra.progress || {})
  });
}

export function ticket(): string {
  return createSessionToken({ id: 'caller_a', username: 'callerA', email: 'a@test.dev' });
}

export function freshTicket(id: string, username: string): string {
  return createSessionToken({ id, username, email: `${username}@test.dev` });
}

function buildFakeDmClient() {
  const db = mocks.state.db;

  const participant = (cId: string, uId: string) => ({
    conversation_id: cId,
    user_id: uId,
    joined_at: nowIso(),
    last_read_at: nowIso()
  });

  const profileOf = (id: string) => db.profiles.find(p => p.id === id);
  const presenceOf = (id: string) => db.user_presence.find(p => p.user_id === id);
  const memberIdsOf = (cId: string) =>
    db.conversation_participants.filter(cp => cp.conversation_id === cId).map(cp => cp.user_id);
  const convBetween = (a: string, b: string) =>
    db.conversations.find(c => {
      const ids = memberIdsOf(c.id);
      return ids.includes(a) && ids.includes(b) && ids.length === 2;
    });

  const summaryOf = (cId: string, viewerId: string) => {
    const c = db.conversations.find(x => x.id === cId)!;
    const mine = db.conversation_participants.find(cp => cp.conversation_id === cId && cp.user_id === viewerId)!;
    const otherId = memberIdsOf(cId).find(u => u !== viewerId)!;
    const prof = profileOf(otherId)!;
    const msgs = db.messages.filter(m => m.conversation_id === cId);
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter(
      m => m.sender_id !== viewerId && new Date(m.created_at) > new Date(mine.last_read_at)
    ).length;
    return {
      id: c.id,
      type: c.type,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      lastReadAt: mine.last_read_at,
      unreadCount: unread,
      lastMessage: last
        ? {
            id: last.id,
            conversationId: cId,
            senderId: last.sender_id,
            content: last.content,
            messageType: last.message_type,
            mediaUrl: last.media_url,
            createdAt: last.created_at
          }
        : null,
      otherUser: {
        id: prof.id,
        username: prof.username,
        avatarUrl: prof.avatar_url,
        bio: prof.bio,
        presenceStatus: presenceOf(otherId)?.status ?? 'offline',
        customStatus: presenceOf(otherId)?.custom_status ?? null
      }
    };
  };

  const rpc: Record<string, any> = {
    get_user_presence_batch: ({ p_user_ids }: any) => {
      const map: Record<string, any> = {};
      for (const id of p_user_ids || []) {
        const row = presenceOf(id);
        if (row) map[id] = { userId: id, status: row.status, customStatus: row.custom_status, lastSeenAt: row.last_seen_at };
      }
      return { data: map, error: null };
    },

    get_dm_conversations: ({ p_user_id }: any) => {
      const convs = db.conversation_participants
        .filter(cp => cp.user_id === p_user_id)
        .map(cp => cp.conversation_id)
        .map(cId => summaryOf(cId, p_user_id));
      convs.sort((a, b) => ((b.lastMessage?.createdAt || b.updatedAt) as string).localeCompare(a.lastMessage?.createdAt || a.updatedAt));
      return { data: convs, error: null };
    },

    get_or_create_dm_conversation: ({ p_user_id, p_other_user_id }: any) => {
      if (p_user_id === p_other_user_id) return { data: null, error: { message: 'cannot DM yourself' } };
      if (!profileOf(p_other_user_id)) return { data: null, error: { message: 'recipient does not exist' } };
      let conv = convBetween(p_user_id, p_other_user_id);
      if (!conv) {
        const id = nextId('conv');
        conv = { id, type: 'dm', created_at: nowIso(), updated_at: nowIso() };
        db.conversations.push(conv);
        db.conversation_participants.push(participant(id, p_user_id));
        db.conversation_participants.push(participant(id, p_other_user_id));
      }
      return { data: summaryOf(conv.id, p_user_id), error: null };
    },

    send_dm_message: ({ p_user_id, p_conversation_id, p_content, p_message_type, p_media_url }: any) => {
      if (!memberIdsOf(p_conversation_id).includes(p_user_id)) {
        return { data: null, error: { message: 'not a participant of this conversation' } };
      }
      const msg = {
        id: nextId('msg'),
        conversation_id: p_conversation_id,
        sender_id: p_user_id,
        content: p_content,
        message_type: p_message_type,
        media_url: p_media_url,
        created_at: nowIso()
      };
      db.messages.push(msg);
      const c = db.conversations.find(x => x.id === p_conversation_id);
      if (c) c.updated_at = msg.created_at;
      return {
        data: {
          id: msg.id,
          conversationId: p_conversation_id,
          senderId: p_user_id,
          content: p_content,
          messageType: p_message_type,
          mediaUrl: p_media_url,
          createdAt: msg.created_at
        },
        error: null
      };
    },

    mark_dm_conversation_read: ({ p_user_id, p_conversation_id }: any) => {
      const row = db.conversation_participants.find(
        cp => cp.conversation_id === p_conversation_id && cp.user_id === p_user_id
      );
      if (row) row.last_read_at = nowIso();
      return { data: null, error: null };
    },

    get_dm_messages: ({ p_user_id, p_conversation_id, p_before, p_limit }: any) => {
      if (!memberIdsOf(p_conversation_id).includes(p_user_id)) {
        return { data: null, error: { message: 'not a participant of this conversation' } };
      }
      let msgs = db.messages.filter(m => m.conversation_id === p_conversation_id);
      if (p_before) msgs = msgs.filter(m => new Date(m.created_at) < new Date(p_before));
      msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      msgs = msgs.slice(0, p_limit ?? 50);
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return {
        data: msgs.map(m => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          content: m.content,
          messageType: m.message_type,
          mediaUrl: m.media_url,
          createdAt: m.created_at
        })),
        error: null
      };
    },

    update_dm_message: ({ p_user_id, p_message_id, p_content }: any) => {
      const msg = db.messages.find(m => m.id === p_message_id);
      if (!msg) return { data: null, error: { message: 'message not found' } };
      if (msg.sender_id !== p_user_id) return { data: null, error: { message: 'only the sender can edit this message' } };
      if (msg.message_type !== 'text') return { data: null, error: { message: 'only text messages can be edited' } };
      msg.content = p_content;
      msg.edited_at = nowIso();
      return {
        data: {
          id: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          content: msg.content,
          messageType: msg.message_type,
          mediaUrl: msg.media_url,
          createdAt: msg.created_at,
          editedAt: msg.edited_at,
          deletedAt: msg.deleted_at ?? null,
          replyToId: null
        },
        error: null
      };
    },

    delete_dm_message: ({ p_user_id, p_message_id }: any) => {
      const msg = db.messages.find(m => m.id === p_message_id);
      if (!msg) return { data: null, error: { message: 'message not found' } };
      if (msg.sender_id !== p_user_id) return { data: null, error: { message: 'only the sender can delete this message' } };
      msg.deleted_at = nowIso();
      msg.content = '';
      return { data: null, error: null };
    },

    count_dm_unread: ({ p_user_id }: any) => {
      let total = 0;
      for (const cp of db.conversation_participants.filter(x => x.user_id === p_user_id)) {
        total += db.messages.filter(
          m => m.conversation_id === cp.conversation_id && m.sender_id !== p_user_id && new Date(m.created_at) > new Date(cp.last_read_at)
        ).length;
      }
      return { data: total, error: null };
    },

    upsert_user_presence: ({ p_user_id, p_status, p_custom_status, p_last_seen }: any) => {
      const row = presenceOf(p_user_id);
      const fresh = {
        user_id: p_user_id,
        status: p_status,
        custom_status: p_custom_status ?? null,
        last_seen_at: p_last_seen ?? nowIso()
      };
      if (row) Object.assign(row, fresh);
      else db.user_presence.push(fresh);
      return {
        data: { userId: p_user_id, status: fresh.status, customStatus: fresh.custom_status, lastSeenAt: fresh.last_seen_at },
        error: null
      };
    }
  };

  return {
    auth: {},
    storage: {},
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`table ${table} not mocked here`);
      const filters: Array<(row: any) => boolean> = [];
      const q: any = {
        select() {
          return q;
        },
        ilike(col: string, val: any) {
          filters.push((row: any) => row && String(row[col] ?? '').toLowerCase().includes(String(val).replace(/^%|%$/g, '').toLowerCase()));
          return q;
        },
        neq(col: string, val: any) {
          filters.push((row: any) => row && row[col] !== val);
          return q;
        },
        limit(n: number) {
          const rows = (db.profiles || []).filter(r => filters.every(f => f(r))).slice(0, n);
          return Promise.resolve({ data: rows, error: null });
        }
      };
      return q;
    },
    rpc: vi.fn(async (fn: string, params: any) => {
      const handler = rpc[fn];
      if (!handler) return { data: null, error: { message: `Unknown RPC: ${fn}` } };
      return handler(params);
    })
  } as unknown as SupabaseClient;
}

export function req(url: string, init?: RequestInit): { request: Request; params: Record<string, string> } {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 2] ?? '';
  return { request: new Request(url, init), params: { id } };
}

function seedWorld() {
  const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  addProfile(A, 'alice');
  addProfile(B, 'bob_test');
  const conv = { id: nextId('conv'), type: 'dm', created_at: nowIso(), updated_at: nowIso() };
  mocks.state.db.conversations.push(conv);
  mocks.state.db.conversation_participants.push(
    { conversation_id: conv.id, user_id: A, joined_at: nowIso(), last_read_at: nowIso(-100000) },
    { conversation_id: conv.id, user_id: B, joined_at: nowIso(), last_read_at: nowIso(-100000) }
  );
  for (let i = 0; i < 3; i++) {
    mocks.state.db.messages.push({
      id: nextId('msg'),
      conversation_id: conv.id,
      sender_id: i % 2 === 0 ? B : A,
      content: `msg ${i}`,
      message_type: 'text',
      media_url: null,
      created_at: nowIso(i * 1000 - 60000)
    });
  }
  return { A, B, conv };
}

describe('DM API routes (Supabase-backed)', () => {
  beforeEach(() => {
    mocks.state.configured = true;
    for (const key of Object.keys(mocks.state.db)) mocks.state.db[key] = [];
    mocks.state.client = buildFakeDmClient();
  });

  it('rejects unauthenticated list with 401', async () => {
    const res = await conversationsGET(req('http://localhost/api/dm/conversations'));
    expect(res.status).toBe(401);
  });

  it('lists conversations with unread counts and the other participant', async () => {
    const { A } = seedWorld();
    const res = await conversationsGET(req('http://localhost/api/dm/conversations', { headers: { Authorization: `Bearer ${freshTicket(A, 'alice')}` } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.conversations).toHaveLength(1);
    const conv = body.conversations[0];
    expect(conv.otherUser.username).toBe('bob_test');
    expect(conv.unreadCount).toBe(2); // A sent 1 (i even), B sent 2
    expect(conv.lastMessage.content).toBe('msg 2');
  });

  it('creates a new DM conversation with another user (201)', async () => {
    const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    addProfile(A, 'alice');
    addProfile('cccccccc-cccc-cccc-cccc-cccccccccccc', 'charlie');
    const res = await conversationsPOST(
      req('http://localhost/api/dm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(A, 'alice')}` },
        body: JSON.stringify({ userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' })
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.conversation.otherUser.username).toBe('charlie');
    expect(mocks.state.db.conversations).toHaveLength(1);
    expect(mocks.state.db.conversation_participants).toHaveLength(2);
  });

  it('returns 404 when creating a DM with a missing user', async () => {
    const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    addProfile(A, 'alice');
    const res = await conversationsPOST(
      req('http://localhost/api/dm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(A, 'alice')}` },
        body: JSON.stringify({ userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd' })
      })
    );
    expect(res.status).toBe(404);
  });

  it('sends a text message and persists it as the sender', async () => {
    const { A, B, conv } = seedWorld();
    const res = await messagesPOST(
      req(`http://localhost/api/dm/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(A, 'alice')}` },
        body: JSON.stringify({ content: 'hi bob' })
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatchObject({ content: 'hi bob', senderId: A, conversationId: conv.id, messageType: 'text' });
    expect(mocks.state.db.messages.some(m => m.content === 'hi bob' && m.sender_id === A)).toBe(true);
    expect(mocks.state.db.messages.some(m => m.conversation_id !== conv.id)).toBe(false);
  });

  it('delivers a message to an offline recipient, queuing it as unread (no silent loss)', async () => {
    const { A, B, conv } = seedWorld();
    // Recipient is explicitly offline in the stored presence table.
    mocks.state.db.user_presence.push({ user_id: B, status: 'offline', custom_status: null, last_seen_at: nowIso() });

    const bobToken = freshTicket(B, 'bob_test');
    const before = await unreadGET(req('http://localhost/api/dm/unread', { headers: { Authorization: `Bearer ${bobToken}` } }));
    expect((await before.json()).totalUnread).toBe(1); // seed message from alice

    const res = await messagesPOST(
      req(`http://localhost/api/dm/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(A, 'alice')}` },
        body: JSON.stringify({ content: 'ping while offline' })
      })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).success).toBe(true);

    // The row is persisted regardless of the recipient's presence.
    expect(mocks.state.db.messages.some(m => m.content === 'ping while offline' && m.sender_id === A)).toBe(true);

    // Unread is derived from messages after last_read_at, so the offline
    // recipient's count increments automatically and duplicates nothing.
    const after = await unreadGET(req('http://localhost/api/dm/unread', { headers: { Authorization: `Bearer ${bobToken}` } }));
    expect((await after.json()).totalUnread).toBe(2);

    const convsRes = await conversationsGET(req('http://localhost/api/dm/conversations', { headers: { Authorization: `Bearer ${bobToken}` } }));
    const convs = (await convsRes.json()).conversations;
    expect(convs).toHaveLength(1);
    expect(convs[0].unreadCount).toBe(2);
    expect(convs[0].lastMessage.content).toBe('ping while offline');

    // The offline recipient can read it back once back online.
    const msgsRes = await messagesGET(req(`http://localhost/api/dm/conversations/${conv.id}/messages`, { headers: { Authorization: `Bearer ${bobToken}` } }));
    expect((await msgsRes.json()).messages.some(m => m.content === 'ping while offline')).toBe(true);
  });

  it('allows GIF messages with a media URL', async () => {
    const { A, conv } = seedWorld();
    const res = await messagesPOST(
      req(`http://localhost/api/dm/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(A, 'alice')}` },
        body: JSON.stringify({ messageType: 'gif', mediaUrl: 'https://media.tenor.com/abc.gif' })
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message.messageType).toBe('gif');
    expect(body.message.mediaUrl).toBe('https://media.tenor.com/abc.gif');
  });

  it('rejects an empty text message', async () => {
    const { A, conv } = seedWorld();
    const res = await messagesPOST(
      req(`http://localhost/api/dm/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(A, 'alice')}` },
        body: JSON.stringify({ content: '   ' })
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects sending to a conversation you are not part of (403)', async () => {
    addProfile('ffffffff-ffff-ffff-ffff-ffffffffffff', 'dave');
    const stranger = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const { A, conv } = seedWorld();
    const res = await messagesPOST(
      req(`http://localhost/api/dm/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(stranger, 'dave')}` },
        body: JSON.stringify({ content: 'jelly' })
      })
    );
    // ensure stranger is a valid token but not participant
    expect(res.status).toBe(403);
    expect(mocks.state.db.messages.filter(m => m.conversation_id === conv.id)).toHaveLength(3);
    expect(A).toBeTruthy();
  });

  it('pages messages newest-first then returns them ascending', async () => {
    const { A, conv } = seedWorld();
    const res = await messagesGET(req(`http://localhost/api/dm/conversations/${conv.id}/messages?limit=2`, { headers: { Authorization: `Bearer ${freshTicket(A, 'alice')}` } }));
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].createdAt <= body.messages[1].createdAt).toBe(true);
  });

  it('marks a conversation read and resets unread', async () => {
    const { A, conv } = seedWorld();
    const token = freshTicket(A, 'alice');
    const before = await conversationsGET(req('http://localhost/api/dm/conversations', { headers: { Authorization: `Bearer ${token}` } }));
    expect((await before.json()).conversations[0].unreadCount).toBe(2);

    await markReadPOST(req(`http://localhost/api/dm/conversations/${conv.id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }));

    const afterRes = await unreadGET(req('http://localhost/api/dm/unread', { headers: { Authorization: `Bearer ${token}` } }));
    const after = await afterRes.json();
    expect(after.totalUnread).toBe(0);
  });

  it('searches users by username, excluding self and joining presence', async () => {
    const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    addProfile(A, 'alice');
    addProfile('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bob_test');
    mocks.state.db.user_presence.push({ user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', status: 'online', custom_status: 'gaming', last_seen_at: nowIso() });

    const res = await searchGET(req('http://localhost/api/dm/search?q=bob', { headers: { Authorization: `Bearer ${freshTicket(A, 'alice')}` } }));
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0]).toMatchObject({ username: 'bob_test', presenceStatus: 'online', customStatus: 'gaming' });
  });

  it('rejects short search queries', async () => {
    const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    addProfile(A, 'alice');
    const res = await searchGET(req('http://localhost/api/dm/search?q=a', { headers: { Authorization: `Bearer ${freshTicket(A, 'alice')}` } }));
    expect(res.status).toBe(400);
  });

  it('edits an owned text message in place via PATCH (no new message)', async () => {
    const { A, conv } = seedWorld();
    const target = mocks.state.db.messages.find(m => m.sender_id === A)!;
    const before = mocks.state.db.messages.length;
    const res = await messagesPATCH(
      req(`http://localhost/api/dm/conversations/${conv.id}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(A, 'alice')}` },
        body: JSON.stringify({ messageId: target.id, content: 'edited text' })
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatchObject({ id: target.id, content: 'edited text', editedAt: expect.any(String) });
    expect(mocks.state.db.messages).toHaveLength(before);
    expect(mocks.state.db.messages.find(m => m.id === target.id)!.content).toBe('edited text');
  });

  it('rejects editing a message owned by someone else (403)', async () => {
    const { A, B, conv } = seedWorld();
    const target = mocks.state.db.messages.find(m => m.sender_id === A)!;
    const res = await messagesPATCH(
      req(`http://localhost/api/dm/conversations/${conv.id}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(B, 'bob_test')}` },
        body: JSON.stringify({ messageId: target.id, content: 'nope' })
      })
    );
    expect(res.status).toBe(403);
  });

  it('soft-deletes an owned message via DELETE (row survives, body wiped)', async () => {
    const { A, conv } = seedWorld();
    const target = mocks.state.db.messages.find(m => m.sender_id === A)!;
    const before = mocks.state.db.messages.length;
    const res = await messagesDELETE(
      req(`http://localhost/api/dm/conversations/${conv.id}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshTicket(A, 'alice')}` },
        body: JSON.stringify({ messageId: target.id })
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mocks.state.db.messages).toHaveLength(before);
    const row = mocks.state.db.messages.find(m => m.id === target.id)!;
    expect(row.deleted_at).toBeTruthy();
    expect(row.content).toBe('');
  });

  it('returns 503 when Supabase is not configured', async () => {
    const { A } = seedWorld();
    mocks.state.configured = false;
    const res = await conversationsGET(req('http://localhost/api/dm/conversations', { headers: { Authorization: `Bearer ${freshTicket(A, 'alice')}` } }));
    expect(res.status).toBe(503);
  });
});
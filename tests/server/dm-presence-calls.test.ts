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

import { GET as presenceGET, POST as presencePOST } from '../../src/routes/api/dm/presence';
import { GET as presenceBatchGET } from '../../src/routes/api/dm/presence/batch';
import { POST as callsPOST } from '../../src/routes/api/dm/calls';
import { GET as pendingCallGET } from '../../src/routes/api/dm/calls/pending';
import { POST as callStatusPOST } from '../../src/routes/api/dm/calls/[id]/status';
import { GET as userProfileGET } from '../../src/routes/api/dm/users/[id]/profile';
import { createSessionToken } from '../../src/lib/server/auth';

let seq = 1;
const nowIso = (offset = 0) => new Date(Date.now() + offset).toISOString();
const nextId = (p: string) => `${p}_${++seq}`;

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CONV = '11111111-1111-1111-1111-111188888888';

function seed() {
  mocks.state.db.profiles.push({ id: A, username: 'alice', avatar_url: '', bio: 'hi' });
  mocks.state.db.profiles.push({ id: B, username: 'bob', avatar_url: '', bio: 'yo' });
  mocks.state.db.user_progress.push({
    user_id: A, coins: 1200, bond_level: 7, waifu_name: 'Hime', waifu_personality: 'yandere',
    worn_outfit: 'kimono', worn_accessory: 'flower_pin', worn_hairstyle: 'twintails', worn_avatar_frame: 'frame_royal',
    appearance_data: { hairColor: '#111111', eyeColor: '#222222', skinTone: '#333333' },
    defense_high_wave: 12, defense_victories: 3, goblins_defeated: 42
  });
  mocks.state.db.conversations.push({ id: CONV, type: 'dm', created_at: nowIso(), updated_at: nowIso() });
  mocks.state.db.conversation_participants.push(
    { conversation_id: CONV, user_id: A, joined_at: nowIso(), last_read_at: nowIso() },
    { conversation_id: CONV, user_id: B, joined_at: nowIso(), last_read_at: nowIso() }
  );
}

function buildFakeClient() {
  const db = mocks.state.db;
  const profileOf = (id: string) => db.profiles.find(p => p.id === id);
  const memberIds = (cId: string) => db.conversation_participants.filter(cp => cp.conversation_id === cId).map(cp => cp.user_id);

  const rpc: Record<string, any> = {
    get_user_presence_batch: ({ p_user_ids }: any) => {
      const map: Record<string, any> = {};
      for (const id of p_user_ids || []) {
        const row = db.user_presence.find(p => p.user_id === id);
        if (row) map[id] = { userId: id, status: row.status, customStatus: row.custom_status, lastSeenAt: row.last_seen_at };
      }
      return { data: map, error: null };
    },
    get_own_presence: ({ p_user_id }: any) => {
      const row = db.user_presence.find(p => p.user_id === p_user_id);
      if (!row) return { data: null, error: null };
      return {
        data: { userId: p_user_id, status: row.status, customStatus: row.custom_status, lastSeenAt: row.last_seen_at },
        error: null
      };
    },
    upsert_user_presence: ({ p_user_id, p_status, p_custom_status, p_last_seen }: any) => {
      const row = db.user_presence.find(p => p.user_id === p_user_id);
      const fresh = { user_id: p_user_id, status: p_status, custom_status: p_custom_status ?? null, last_seen_at: p_last_seen ?? nowIso() };
      if (row) Object.assign(row, fresh);
      else db.user_presence.push(fresh);
      return { data: { userId: p_user_id, status: fresh.status, customStatus: fresh.custom_status, lastSeenAt: fresh.last_seen_at }, error: null };
    },
    create_call_session: ({ p_user_id, p_conversation_id, p_callee_id, p_call_type }: any) => {
      if (p_user_id === p_callee_id) return { data: null, error: { message: 'cannot call yourself' } };
      const members = memberIds(p_conversation_id);
      if (!members.includes(p_user_id) || !members.includes(p_callee_id)) {
        return { data: null, error: { message: 'both users must be part of the conversation' } };
      }
      // Mirrors the live RPC: a ringing/active call in the same conversation
      // involving either side is returned as a `joined` join instead of a new call.
      const existing = db.call_sessions.find(
        c =>
          c.conversation_id === p_conversation_id &&
          (c.status === 'ringing' || c.status === 'active') &&
          (c.caller_id === p_user_id || c.callee_id === p_user_id || c.callee_id === p_callee_id)
      );
      if (existing) {
        return {
          data: {
            id: existing.id, conversationId: existing.conversation_id, callerId: existing.caller_id,
            calleeId: existing.callee_id, callType: existing.call_type, status: existing.status,
            startedAt: existing.started_at, answeredAt: existing.answered_at, endedAt: existing.ended_at,
            createdAt: existing.created_at, joined: true
          },
          error: null
        };
      }
      const call = {
        id: nextId('call'), conversation_id: p_conversation_id, caller_id: p_user_id, callee_id: p_callee_id,
        call_type: p_call_type, status: 'ringing', started_at: nowIso(), answered_at: null, ended_at: null, created_at: nowIso()
      };
      db.call_sessions.push(call);
      return {
        data: {
          id: call.id, conversationId: call.conversation_id, callerId: call.caller_id, calleeId: call.callee_id,
          callType: call.call_type, status: call.status, startedAt: call.started_at, answeredAt: null, endedAt: null, createdAt: call.created_at
        },
        error: null
      };
    },
    get_pending_call_for_user: ({ p_user_id }: any) => {
      const pending = db.call_sessions
        .filter(c =>
          (c.status === 'ringing' || c.status === 'active') &&
          (c.caller_id === p_user_id || c.callee_id === p_user_id)
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .pop();
      if (!pending) return { data: null, error: null };
      return {
        data: {
          id: pending.id, conversationId: pending.conversation_id, callerId: pending.caller_id,
          calleeId: pending.callee_id, callType: pending.call_type, status: pending.status,
          startedAt: pending.started_at, answeredAt: pending.answered_at, endedAt: pending.ended_at,
          createdAt: pending.created_at
        },
        error: null
      };
    },
    update_call_session: ({ p_user_id, p_call_id, p_status }: any) => {
      const call = db.call_sessions.find(c => c.id === p_call_id);
      if (!call) return { data: null, error: { message: 'call not found' } };
      if (!memberIds(call.conversation_id).includes(p_user_id)) {
        return { data: null, error: { message: 'not a participant of this call' } };
      }
      call.status = p_status;
      if (p_status === 'active') call.answered_at = nowIso();
      if (['ended', 'declined', 'missed', 'canceled', 'busy'].includes(p_status)) call.ended_at = nowIso();
      return {
        data: {
          id: call.id, conversationId: call.conversation_id, callerId: call.caller_id, calleeId: call.callee_id,
          callType: call.call_type, status: call.status, startedAt: call.started_at, answeredAt: call.answered_at, endedAt: call.ended_at, createdAt: call.created_at
        },
        error: null
      };
    },
    get_user_profile_public: ({ p_user_id }: any) => {
      const prof = profileOf(p_user_id);
      if (!prof) return { data: null, error: null };
      const up = db.user_progress.find(x => x.user_id === p_user_id);
      return {
        data: {
          id: prof.id, username: prof.username, avatarUrl: prof.avatar_url, bio: prof.bio, createdAt: prof.created_at ?? nowIso(),
          stats: { coins: up?.coins ?? 0, bondLevel: up?.bond_level ?? 1, defenseHighWave: up?.defense_high_wave ?? 0, totalVictories: up?.defense_victories ?? 0, goblinsDefeated: up?.goblins_defeated ?? 0 },
          waifu: {
            name: up?.waifu_name ?? 'Akari', personality: up?.waifu_personality ?? 'tsundere',
            appearance: {
              outfit: up?.worn_outfit ?? 'seifuku', accessory: up?.worn_accessory ?? 'ribbon',
              hairstyle: up?.worn_hairstyle ?? 'twintails', avatarFrame: up?.worn_avatar_frame ?? 'none',
              hairColor: up?.appearance_data?.hairColor ?? '#ff7597', eyeColor: up?.appearance_data?.eyeColor ?? '#4f86f7',
              skinTone: up?.appearance_data?.skinTone ?? '#fff1eb', avatarMode: up?.appearance_data?.avatarMode ?? 'svg'
            }
          }
        },
        error: null
      };
    }
  };

  return {
    auth: {},
    storage: {},
    from: () => {
      throw new Error('table API not mocked here');
    },
    rpc: vi.fn(async (fn: string, params: any) => {
      const handler = rpc[fn];
      if (!handler) return { data: null, error: { message: `Unknown RPC: ${fn}` } };
      return handler(params);
    })
  } as unknown as SupabaseClient;
}

const ticket = (id: string, username: string) => createSessionToken({ id, username, email: `${username}@t.dev` });
const req = (url: string, init?: RequestInit) => {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 2] ?? '';
  return { request: new Request(url, init), params: { id } };
};

describe('DM presence AP', () => {
  beforeEach(() => {
    mocks.state.configured = true;
    for (const key of Object.keys(mocks.state.db)) mocks.state.db[key] = [];
    mocks.state.client = buildFakeClient();
    seed();
  });

  it('sets presence via POST and persists custom status', async () => {
    const res = await presencePOST(
      req('http://localhost/api/dm/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ status: 'dnd', customStatus: 'coding' })
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.presence).toMatchObject({ status: 'dnd', customStatus: 'coding' });
    expect(mocks.state.db.user_presence.find(p => p.user_id === A)?.custom_status).toBe('coding');
  });

  it('rejects invalid presence statuses', async () => {
    const res = await presencePOST(
      req('http://localhost/api/dm/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ status: 'super-awake' })
      })
    );
    expect(res.status).toBe(400);
  });

  it('returns offline default for a user with no stored presence', async () => {
    const res = await presenceGET(req('http://localhost/api/dm/presence', { headers: { Authorization: `Bearer ${ticket(A, 'alice')}` } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.presence.status).toBe('offline');
  });

  it('returns the raw stored status for the caller even when the last-seen stamp is stale', async () => {
    mocks.state.db.user_presence.push({ user_id: A, status: 'dnd', custom_status: 'coding', last_seen_at: nowIso(-30 * 60 * 1000) });
    const res = await presenceGET(req('http://localhost/api/dm/presence', { headers: { Authorization: `Bearer ${ticket(A, 'alice')}` } }));
    const body = await res.json();
    expect(body.presence).toMatchObject({ userId: A, status: 'dnd', customStatus: 'coding' });
  });

  it('batch-fetches presence for many users', async () => {
    const res = await presenceBatchGET(req(`http://localhost/api/dm/presence/batch?userIds=${A},${B}`, { headers: { Authorization: `Bearer ${ticket(A, 'alice')}` } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Object.keys(body.presence)).toHaveLength(0);
  });
});

describe('DM call routes', () => {
  beforeEach(() => {
    mocks.state.configured = true;
    for (const key of Object.keys(mocks.state.db)) mocks.state.db[key] = [];
    mocks.state.client = buildFakeClient();
    seed();
  });

  it('creates a ringing voice call between conversation participants', async () => {
    const res = await callsPOST(
      req('http://localhost/api/dm/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ conversationId: CONV, calleeId: B, callType: 'video' })
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.call).toMatchObject({ callerId: A, calleeId: B, callType: 'video', status: 'ringing' });
  });

  it('rejects calls between users not sharing a conversation', async () => {
    mocks.state.db.conversation_participants = mocks.state.db.conversation_participants.filter(cp => cp.user_id !== B);
    const res = await callsPOST(
      req('http://localhost/api/dm/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ conversationId: CONV, calleeId: B, callType: 'voice' })
      })
    );
    expect(res.status).toBe(400);
  });

  it('updates a call lifecycle status', async () => {
    const created = await callsPOST(
      req('http://localhost/api/dm/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ conversationId: CONV, calleeId: B, callType: 'voice' })
      })
    );
    const call = (await created.json()).call;

    const answer = await callStatusPOST(
      req(`http://localhost/api/dm/calls/${call.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(B, 'bob')}` },
        body: JSON.stringify({ status: 'active' })
      })
    );
    expect((await answer.json()).call.status).toBe('active');

    const end = await callStatusPOST(
      req(`http://localhost/api/dm/calls/${call.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ status: 'ended' })
      })
    );
    const endRes = await end;
    const endBody = await endRes.json();
    expect(endBody.call.status).toBe('ended');
    expect(endBody.call.endedAt).toBeTruthy();
  });

  it('forbids non-participants from mutating a call', async () => {
    const created = await callsPOST(
      req('http://localhost/api/dm/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ conversationId: CONV, calleeId: B, callType: 'voice' })
      })
    );
    const call = (await created.json()).call;
    const outsider = createSessionToken({ id: 'outsider', username: 'outsider', email: 'o@t.dev' });
    const res = await callStatusPOST(
      req(`http://localhost/api/dm/calls/${call.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outsider}` },
        body: JSON.stringify({ status: 'ended' })
      })
    );
    expect(res.status).toBe(403);
  });

  it('returns joined=true with the existing call when the callee is already in a call', async () => {
    const first = await callsPOST(
      req('http://localhost/api/dm/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ conversationId: CONV, calleeId: B, callType: 'voice' })
      })
    );
    const firstBody = await first.json();
    expect(firstBody.joined).toBe(false);
    const originalId = firstBody.call.id;

    // B is still ringing A; a fresh create from B's side into the same
    // conversation should join it instead of inserting a duplicate lane.
    const second = await callsPOST(
      req('http://localhost/api/dm/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(B, 'bob')}` },
        body: JSON.stringify({ conversationId: CONV, calleeId: A, callType: 'voice' })
      })
    );
    expect(second.status).toBe(201);
    const body = await second.json();
    expect(body.joined).toBe(true);
    expect(body.call).toMatchObject({ id: originalId, status: 'ringing' });
  });

  it('returns the newest pending call a user is a party to', async () => {
    const created = await callsPOST(
      req('http://localhost/api/dm/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticket(A, 'alice')}` },
        body: JSON.stringify({ conversationId: CONV, calleeId: B, callType: 'video' })
      })
    );
    const call = (await created.json()).call;

    const pending = await pendingCallGET(
      req('http://localhost/api/dm/calls/pending', { headers: { Authorization: `Bearer ${ticket(B, 'bob')}` } })
    );
    expect(pending.status).toBe(200);
    const body = await pending.json();
    expect(body.success).toBe(true);
    expect(body.call).toMatchObject({ id: call.id, status: 'ringing', callerId: A, calleeId: B });
  });

  it('returns call:null from pending when the user has no live call', async () => {
    const pending = await pendingCallGET(
      req('http://localhost/api/dm/calls/pending', { headers: { Authorization: `Bearer ${ticket(A, 'alice')}` } })
    );
    const body = await pending.json();
    expect(body.success).toBe(true);
    expect(body.call).toBeNull();
  });
});

describe('DM user profile route', () => {
  beforeEach(() => {
    mocks.state.configured = true;
    for (const key of Object.keys(mocks.state.db)) mocks.state.db[key] = [];
    mocks.state.client = buildFakeClient();
    seed();
  });

  it('returns the public profile with stats and waifu appearance', async () => {
    const res = await userProfileGET(req(`http://localhost/api/dm/users/${A}/profile`, { headers: { Authorization: `Bearer ${ticket(A, 'alice')}` } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toMatchObject({
      username: 'alice',
      stats: { coins: 1200, bondLevel: 7, defenseHighWave: 12 },
      waifu: {
        name: 'Hime',
        personality: 'yandere',
        appearance: { outfit: 'kimono', avatarFrame: 'frame_royal', hairColor: '#111111' }
      }
    });
  });

  it('returns 404 for a missing user', async () => {
    const res = await userProfileGET(req('http://localhost/api/dm/users/11111111-1111-1111-1111-111111111111/profile', { headers: { Authorization: `Bearer ${ticket(A, 'alice')}` } }));
    expect(res.status).toBe(404);
  });
});
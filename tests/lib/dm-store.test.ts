import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DmRealtimeHandlers } from '../../src/lib/dm/realtime';

const rt = vi.hoisted(() => ({
  instances: [] as any[],
  handlers: null as unknown as DmRealtimeHandlers
}));

const callRegistry = vi.hoisted(() => ({ instances: [] as any[] }));

vi.mock('../../src/lib/dm/realtime', () => ({
  DmRealtime: class {
    instance: any;
    constructor(config: unknown, handlers: DmRealtimeHandlers) {
      rt.handlers = handlers;
      this.instance = this;
      rt.instances.push(this);
    }
    connect = vi.fn(async () => undefined);
    trackPresence = vi.fn(async () => undefined);
    subscribeConversation = vi.fn(async () => undefined);
    sendMessage = vi.fn(async () => undefined);
    sendTyping = vi.fn(async () => undefined);
    sendReaction = vi.fn(async () => undefined);
    sendCallSignal = vi.fn(async () => undefined);
    sendIncomingCallOffer = vi.fn(async () => undefined);
    sendCallCancel = vi.fn(async () => undefined);
    disconnect = vi.fn(async () => undefined);
    getPresence = () => ({});
  }
}));

vi.mock('../../src/lib/dm/call', () => ({
  CallManager: class {
    deps: any = {};
    currentState = 'ringing';
    localMedia: MediaStream | null = null;
    remoteMedia: MediaStream | null = null;
    private muted = false;
    private videoOff = false;
    private screenSharing = false;
    constructor(deps: any) {
      this.deps = deps ?? {};
      callRegistry.instances.push(this);
    }
    async startLocal(): Promise<boolean> {
      return true;
    }
    async createOffer(): Promise<{ type: string; sdp: string }> {
      return { type: 'offer', sdp: 'offer-sdp' };
    }
    async acceptOffer(): Promise<{ type: string; sdp: string }> {
      this.currentState = 'connected';
      this.deps.onStateChange?.();
      return { type: 'answer', sdp: 'answer-sdp' };
    }
    async adoptAnswer(): Promise<void> {
      this.currentState = 'connected';
      this.deps.onStateChange?.();
    }
    async adoptIce(): Promise<void> {}
    toggleMute(): boolean {
      this.muted = true;
      this.deps.onStateChange?.();
      return true;
    }
    toggleVideo(): boolean {
      this.videoOff = !this.videoOff;
      this.deps.onStateChange?.();
      return true;
    }
    isMuted(): boolean {
      return this.muted;
    }
    isVideoOff(): boolean {
      return this.videoOff;
    }
    async ensureCamera(): Promise<boolean> {
      return true;
    }
    hasVideoTracks(): boolean {
      return true;
    }
    async enableScreenShare(): Promise<boolean> {
      this.screenSharing = true;
      return true;
    }
    async disableScreenShare(): Promise<boolean> {
      this.screenSharing = false;
      return true;
    }
    isScreenSharing(): boolean {
      return this.screenSharing;
    }
    hangUp(): void {
      this.currentState = 'ended';
      this.deps.onStateChange?.();
    }
  }
}));

import {
  configureDmRuntime,
  dmState,
  setDmState,
  initDm,
  selectConversation,
  sendText,
  sendGif,
  setOwnPresence,
  dmSearch,
  resetDmStore,
  startCall,
  acceptIncomingCall,
  hangUpCall,
  toggleMute,
  toggleVideo,
  toggleReaction,
  refreshPendingCall
} from '../../src/lib/dm/store';

const AUTH = { token: 't1', id: 'u-me', username: 'alice', avatarUrl: 'https://x/a.png' };

const JSON_RESP = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch(routes: Record<string, (url: string, init: RequestInit) => Response>) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) return handler(url, init ?? {});
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function makeConv(id: string, other: string) {
  return {
    id,
    type: 'dm' as const,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    lastReadAt: null,
    unreadCount: 0,
    lastMessage: null,
    otherUser: { id: other, username: other === 'u-bob' ? 'bob' : 'carol' }
  };
}

beforeEach(() => {
  rt.instances.length = 0;
  rt.handlers = null as unknown as DmRealtimeHandlers;
  callRegistry.instances.length = 0;
  resetDmStore();
  configureDmRuntime({ getAuth: () => ({ ...AUTH }), notify: () => undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dm store boot + conversations', () => {
  it('initDm loads config, conversations, presence and unread, then tracks presence', async () => {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'https://p.supabase.co', supabaseAnonKey: 'anon', isConfigured: true }),
      '/api/dm/conversations': () =>
        JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob'), makeConv('c2', 'u-carol')] }),
      '/api/dm/presence': (url, _init) =>
        url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'online', lastSeenAt: '2025-01-01T00:00:00.000Z' } }),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 2 })
    });

    const ok = await initDm();
    expect(ok).toBe(true);
    expect(dmState.ready).toBe(true);
    expect(dmState.conversations).toHaveLength(2);
    expect(dmState.totalUnread).toBe(2);
    expect(dmState.myPresence?.status).toBe('online');
    expect(rt.instances[0].connect).toHaveBeenCalledWith({ id: 'u-me', username: 'alice', avatar: 'https://x/a.png' });
    expect(rt.instances[0].trackPresence).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-me', status: 'online' }));
    // Every conversation channel is subscribed at boot so messages + call
    // signals arrive live regardless of which page/conversation is open.
    expect(rt.instances[0].subscribeConversation).toHaveBeenCalledWith('c1');
    expect(rt.instances[0].subscribeConversation).toHaveBeenCalledWith('c2');
  });

  it('selectConversation loads messages and subscribes to the realtime channel', async () => {
const msgs = [
      { id: 'm1', conversationId: 'c1', senderId: 'u-bob', content: 'hey', messageType: 'text', createdAt: '2025-01-01T00:00:00.000Z' }
    ];
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: msgs }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 })
    });
    await initDm();
    await selectConversation('c1');
    expect(dmState.activeConversationId).toBe('c1');
    expect(dmState.messages.c1).toHaveLength(1);
    expect(rt.instances[0].subscribeConversation).toHaveBeenCalledWith('c1');
    expect(dmState.hasOlder.c1).toBe(false);
  });

  it('sendText posts and optimistically-moves the conversation to the front', async () => {
const sent: any = [];
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': (url, init) => {
        if (init.method === 'POST') {
          const body = JSON.parse(String(init.body));
          sent.push({ url, body });
          return JSON_RESP({ success: true, message: { id: 'm-new', conversationId: 'c1', senderId: 'u-me', content: body.content, messageType: body.messageType, mediaUrl: body.mediaUrl, createdAt: '2025-01-03T00:00:00.000Z' } }, 201);
        }
        return JSON_RESP({ success: true, messages: [] });
      },
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob'), makeConv('c2', 'u-carol')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 })
    });
    await initDm();
    await selectConversation('c1');
    const msg = await sendText('hello bob');
    expect(msg?.content).toBe('hello bob');
    expect(dmState.messages.c1).toHaveLength(1);
    expect(dmState.conversations[0].id).toBe('c1');
    expect(dmState.conversations[0].unreadCount).toBe(0);
    expect(rt.instances[0].sendMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'c1' }));
    expect(sent[0].body).toMatchObject({ content: 'hello bob', messageType: 'text' });
  });

it('sendGif posts a gif message', async () => {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': (url, init) =>
        init.method === 'POST'
          ? JSON_RESP({ success: true, message: { id: 'm-g', conversationId: 'c1', senderId: 'u-me', content: '', messageType: 'gif', mediaUrl: 'https://media.tenor.com/a.gif', createdAt: '2025-01-03T00:00:00.000Z' } }, 201)
          : JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 })
    });
    await initDm();
    await selectConversation('c1');
    const msg = await sendGif('https://media.tenor.com/a.gif');
    expect(msg?.messageType).toBe('gif');
    expect(dmState.messages.c1[0].mediaUrl).toBe('https://media.tenor.com/a.gif');
  });

  it('sendText to an offline user is delivered locally without being gated or dropped', async () => {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': (url, init) =>
        init.method === 'POST'
          ? JSON_RESP({ success: true, message: { id: 'm-off', conversationId: 'c1', senderId: 'u-me', content: 'you there?', messageType: 'text', mediaUrl: null, createdAt: '2025-01-03T00:00:00.000Z' } }, 201)
          : JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) =>
        url.includes('/batch')
          ? JSON_RESP({ success: true, presence: { 'u-bob': { userId: 'u-bob', status: 'offline', lastSeenAt: '2025-01-01T00:00:00.000Z' } } })
          : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'online', lastSeenAt: '2025-01-01T00:00:00.000Z' } }),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 })
    });
    await initDm();
    expect(dmState.presence['u-bob']?.status).toBe('offline');
    await selectConversation('c1');
    const msg = await sendText('you there?');
    expect(msg?.content).toBe('you there?');
    // No silent loss: the message lands in the local timeline and bumps the conversation.
    expect(dmState.messages.c1?.some(m => m.id === 'm-off')).toBe(true);
    expect(dmState.conversations.find(c => c.id === 'c1')?.lastMessage?.content).toBe('you there?');
    expect(dmState.conversations.find(c => c.id === 'c1')?.unreadCount).toBe(0); // sender view; recipient unread is server-derived
  });
});

describe('dm store presence + search', () => {
  it('setOwnPresence updates local + realtime', async () => {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [] }),
      '/api/dm/presence': (url, init) => {
        if (url.includes('/batch')) return JSON_RESP({ success: true, presence: {} });
        if (init?.method === 'POST') return JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'dnd', customStatus: 'coding', lastSeenAt: '2025-01-01T00:00:00.000Z' } });
        return JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline', lastSeenAt: '2025-01-01T00:00:00.000Z' } });
      },
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 })
    });
    await initDm();
    await setOwnPresence('dnd', 'coding');
    expect(dmState.myPresence?.customStatus).toBe('coding');
    expect(rt.instances[0].trackPresence).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'dnd', customStatus: 'coding' }));
  });

  it('dmSearch returns empty below 2 chars and calls the API otherwise', async () => {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 }),
      '/api/dm/search': () => JSON_RESP({ success: true, users: [{ id: 'u-bob', username: 'bob', presenceStatus: 'online' }] })
    });
    await initDm();
    expect(await dmSearch('a')).toEqual([]);
    expect(dmState.searchResults).toEqual([]);
    const users = await dmSearch('bob');
    expect(users).toHaveLength(1);
    expect(dmState.searchResults[0].username).toBe('bob');
  });
});

describe('dm store realtime handlers', () => {
async function boot() {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 })
    });
    await initDm();
    return rt.instances[0];
  }

  it('incoming realtime message is stored, unread increments and notify fires', async () => {
    const notifySpy = vi.fn();
    configureDmRuntime({ getAuth: () => ({ ...AUTH }), notify: notifySpy });
    await boot();
    rt.handlers.onMessage({
      kind: 'dm-message',
      conversationId: 'c1',
      senderName: 'bob',
      message: { id: 'm-live', conversationId: 'c1', senderId: 'u-bob', content: 'ping', messageType: 'text', createdAt: '2025-01-04T00:00:00.000Z' }
    });
    expect(dmState.messages.c1[0].content).toBe('ping');
    expect(dmState.totalUnread).toBe(1);
    expect(dmState.conversations[0].lastMessage?.content).toBe('ping');
    expect(notifySpy).toHaveBeenCalledWith({ title: 'bob', body: 'ping' });
  });

  it('typing broadcasts track per-conversation user activity', async () => {
    await boot();
    rt.handlers.onTyping({ kind: 'typing', conversationId: 'c1', userId: 'u-bob', userName: 'bob', at: Date.now() });
    expect(dmState.typing.c1).toContain('u-bob');
  });

  it('presence changes hydrate the realtime map', async () => {
    await boot();
    rt.handlers.onPresenceChange({ 'u-bob': { userId: 'u-bob', username: 'bob', status: 'online', at: Date.now() } });
    expect(dmState.realtimePresence['u-bob'].status).toBe('online');
  });

  it('incoming call offer is surfaced and notifies', async () => {
    const notifySpy = vi.fn();
    configureDmRuntime({ getAuth: () => ({ ...AUTH }), notify: notifySpy });
    await boot();
    const call = {
      id: 'call-1', conversationId: 'c1', callerId: 'u-bob', calleeId: 'u-me', callType: 'video' as const,
      status: 'ringing' as const, startedAt: '', answeredAt: null, endedAt: null, createdAt: ''
    };
    rt.handlers.onIncomingCall({ kind: 'call-offer', call, callerName: 'bob', offer: { type: 'offer', sdp: 'offer-sdp' } });
    expect(dmState.incomingCall?.call.id).toBe('call-1');
    expect(notifySpy).toHaveBeenCalledWith({ title: 'bob is calling', body: 'Video call' });
  });
});

describe('dm store calls', () => {
async function boot() {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 }),
      '/api/dm/calls/call-2/status': () =>
        JSON_RESP({
          success: true,
          call: { id: 'call-2', conversationId: 'c1', callerId: 'u-me', calleeId: 'u-bob', callType: 'voice', status: 'ended', startedAt: '', answeredAt: null, endedAt: null, createdAt: '' },
          systemMessage: { id: 'sys-1', conversationId: 'c1', senderId: 'u-me', content: '{"kind":"call-ended","callType":"voice"}', messageType: 'system', mediaUrl: 'call-ended:call-2', createdAt: '2025-01-04T00:00:00.000Z' }
        }),
      '/api/dm/calls': () =>
        JSON_RESP(
          {
            success: true,
            call: { id: 'call-2', conversationId: 'c1', callerId: 'u-me', calleeId: 'u-bob', callType: 'voice', status: 'ringing', startedAt: '', answeredAt: null, endedAt: null, createdAt: '' }
          },
          201
        )
    });
    await initDm();
    return rt.instances[0];
  }

  it('startCall creates the call, acquires media, and emits an offer', async () => {
    const rtInst = await boot();
    await selectConversation('c1');
    const ok = await startCall('voice');
    expect(ok).toBe(true);
    expect(dmState.call?.direction).toBe('outgoing');
    expect(dmState.call?.call.callType).toBe('voice');
    expect(rtInst.sendCallSignal).toHaveBeenCalledWith(expect.objectContaining({ type: 'offer', callId: 'call-2', sdp: { type: 'offer', sdp: 'offer-sdp' } }));
    expect(rtInst.sendIncomingCallOffer).toHaveBeenCalledWith(expect.objectContaining({ callerName: 'alice', call: expect.objectContaining({ id: 'call-2' }) }));
  });

  it('acceptIncomingCall answers and sends an answer signal', async () => {
    const rtInst = await boot();
    const call = {
      id: 'call-9', conversationId: 'c1', callerId: 'u-bob', calleeId: 'u-me', callType: 'video' as const,
      status: 'ringing' as const, startedAt: '', answeredAt: null, endedAt: null, createdAt: ''
    };
    rt.handlers.onIncomingCall({ kind: 'call-offer', call, callerName: 'bob', offer: { type: 'offer', sdp: 'offer-sdp' } });
    await acceptIncomingCall();
    expect(dmState.incomingCall).toBeNull();
    expect(dmState.call?.direction).toBe('incoming');
    expect(dmState.call?.callState).toBe('connected');
    expect(rtInst.sendCallSignal).toHaveBeenCalledWith(expect.objectContaining({ type: 'answer', callId: 'call-9', sdp: { type: 'answer', sdp: 'answer-sdp' } }));
    expect(rtInst.subscribeConversation).toHaveBeenCalledWith('c1');
  });

  it('hangUpCall cancels an outgoing ringing call', async () => {
    const rtInst = await boot();
    await selectConversation('c1');
    await startCall('voice');
    await hangUpCall();
    expect(dmState.call).toBeNull();
    expect(rtInst.sendCallCancel).toHaveBeenCalledWith('u-bob', expect.objectContaining({ call: expect.objectContaining({ id: 'call-2' }) }));
  });

  it('canceled ringing calls apply a call-ended system message to the timeline', async () => {
    const rtInst = await boot();
    await selectConversation('c1');
    await startCall('voice');
    expect(dmState.call?.callState).toBe('ringing');
    // The server now reports a canceled (still-ringing, never answered) call as
    // "call-ended" so the timeline shows a system message instead of nothing.
    stubFetch({
      '/api/dm/calls/call-2/status': () => JSON_RESP({
        success: true,
        call: { id: 'call-2', conversationId: 'c1', callerId: 'u-me', calleeId: 'u-bob', callType: 'voice', status: 'canceled', startedAt: '2025-01-02T00:00:00.000Z', answeredAt: null, endedAt: null, createdAt: '2025-01-02T00:00:00.000Z' },
        systemMessage: { id: 'sys-cancel', conversationId: 'c1', senderId: 'u-me', content: '{"kind":"call-ended","callType":"voice"}', messageType: 'system', mediaUrl: 'call-ended:call-2', createdAt: '2025-01-02T00:00:02.000Z' }
      })
    });
    await hangUpCall();
    const msgs = dmState.messages.c1 ?? [];
    const sys = msgs.find((m) => m.messageType === 'system');
    expect(sys?.mediaUrl).toBe('call-ended:call-2');
    expect(sys?.content).toBe('{"kind":"call-ended","callType":"voice"}');
    // The broadcast still reaches the peer over the conversation channel.
    expect(rtInst.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'c1', message: expect.objectContaining({ messageType: 'system', mediaUrl: 'call-ended:call-2' }) }));
  });

  it('an echoed-back offer does not flip an outgoing ringing call to connected', async () => {
    const rtInst = await boot();
    await selectConversation('c1');
    await startCall('voice');
    expect(dmState.call?.callState).toBe('ringing');
    // Supabase realtime echoes a broadcast back to the sender: the caller
    // receives its own 'offer' on the conversation channel. That must NOT be
    // treated as a renegotiation (which would call acceptOffer and set state
    // to 'connected' before the callee has answered).
    rt.handlers.onCallSignal({
      kind: 'call-signal',
      callId: 'call-2',
      conversationId: 'c1',
      type: 'offer',
      sdp: { type: 'offer', sdp: 'offer-sdp' }
    });
    expect(dmState.call?.callState).toBe('ringing');
    expect(rtInst.sendCallSignal).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'answer', callId: 'call-2' }));
  });

  it('declines and cleans up an incoming call', async () => {
    const rtInst = await boot();
    const call = {
      id: 'call-7', conversationId: 'c1', callerId: 'u-bob', calleeId: 'u-me', callType: 'voice' as const,
      status: 'ringing' as const, startedAt: '', answeredAt: null, endedAt: null, createdAt: ''
    };
    rt.handlers.onIncomingCall({ kind: 'call-offer', call, callerName: 'bob' });
    expect(dmState.incomingCall?.call.id).toBe('call-7');
    // hangUpCall with no active call but an incoming call set acts as decline
    await hangUpCall();
    expect(dmState.incomingCall).toBeNull();
    expect(dmState.call).toBeNull();
    // simulate the server returning a status update that the realtime path would have sent
  });

  it('toggleMute reflects in the call UI state', async () => {
    await boot();
    await selectConversation('c1');
    await startCall('voice');
    toggleMute();
    expect(dmState.call?.muted).toBe(true);
    toggleVideo();
    expect(dmState.call?.videoOff).toBe(true);
  });

  it('hangUpCall applies a call-ended system message to the timeline and broadcasts it', async () => {
    const rtInst = await boot();
    await selectConversation('c1');
    await startCall('voice');
    await hangUpCall();
    expect(dmState.call).toBeNull();
    const msgs = dmState.messages.c1 ?? [];
    const sys = msgs.find((m) => m.messageType === 'system');
    expect(sys?.content).toBe('{"kind":"call-ended","callType":"voice"}');
    expect(rtInst.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'c1', message: expect.objectContaining({ messageType: 'system' }) }));
  });

  it('incoming realtime system messages are applied without a notification', async () => {
    const notifySpy = vi.fn();
    configureDmRuntime({ getAuth: () => ({ ...AUTH }), notify: notifySpy });
    await boot();
    setDmState('activeConversationId', 'c1');
    rt.handlers.onMessage({
      kind: 'dm-message',
      conversationId: 'c1',
      senderName: 'bob',
      message: { id: 'sys-x', conversationId: 'c1', senderId: 'u-bob', content: '{"kind":"call-missed","callType":"voice"}', messageType: 'system', createdAt: '2025-01-05T00:00:00.000Z' }
    });
    expect(dmState.messages.c1?.some((m) => m.id === 'sys-x')).toBe(true);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('startCall joins an already-busy call instead of ringing the callee again', async () => {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 }),
      '/api/dm/calls': () =>
        JSON_RESP(
          {
            success: true,
            joined: true,
            call: { id: 'call-existing', conversationId: 'c1', callerId: 'u-me', calleeId: 'u-bob', callType: 'voice', status: 'active', startedAt: '', answeredAt: null, endedAt: null, createdAt: '' }
          },
          201
        )
    });
    await initDm();
    await selectConversation('c1');
    const rtInst = rt.instances[0];
    const ok = await startCall('voice');
    expect(ok).toBe(true);
    // Adopts the existing call in the active dock without a fresh ringing flow.
    expect(dmState.call?.call.id).toBe('call-existing');
    expect(dmState.call?.direction).toBe('outgoing');
    expect(dmState.call?.callState).toBe('active');
    // The already-busy callee must NOT be re-rung with the incoming-call
    // broadcast, but a renegotiation offer is sent so media can link up.
    expect(rtInst.sendIncomingCallOffer).not.toHaveBeenCalled();
    expect(rtInst.sendCallSignal).toHaveBeenCalledWith(expect.objectContaining({ type: 'offer', callId: 'call-existing' }));
  });

  it('refreshPendingCall hydrates a missed incoming (ringing) call', async () => {
    let polled = 0;
    const pendingCall = {
      id: 'call-pend-1', conversationId: 'c1', callerId: 'u-bob', calleeId: 'u-me', callType: 'voice' as const,
      status: 'ringing' as const, startedAt: '', answeredAt: null, endedAt: null, createdAt: ''
    };
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 }),
      '/api/dm/calls/pending': () => {
        polled += 1;
        return polled === 1 ? JSON_RESP({ success: true, call: null }) : JSON_RESP({ success: true, call: pendingCall });
      }
    });
    await initDm();
    // The boot-time poll found nothing yet.
    expect(dmState.incomingCall).toBeNull();
    await refreshPendingCall();
    expect(dmState.incomingCall?.call.id).toBe('call-pend-1');
    expect(dmState.incomingCall?.callerName).toBe('bob');
  });

  it('refreshPendingCall hydrates an active call after a refresh (rejoin affordance)', async () => {
    const pendingCall = {
      id: 'call-pend-2', conversationId: 'c1', callerId: 'u-me', calleeId: 'u-bob', callType: 'voice' as const,
      status: 'active' as const, startedAt: '', answeredAt: null, endedAt: null, createdAt: ''
    };
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 }),
      '/api/dm/calls/pending': () => JSON_RESP({ success: true, call: pendingCall })
    });
    await initDm();
    await refreshPendingCall();
    expect(dmState.incomingCall?.call.id).toBe('call-pend-2');
  });

  it('refreshPendingCall never clobbers a call the user is already managing', async () => {
    let polled = 0;
    const pendingCall = {
      id: 'call-pend-3', conversationId: 'c1', callerId: 'u-bob', calleeId: 'u-me', callType: 'voice' as const,
      status: 'ringing' as const, startedAt: '', answeredAt: null, endedAt: null, createdAt: ''
    };
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 }),
      '/api/dm/calls/pending': () => {
        polled += 1;
        return polled === 1 ? JSON_RESP({ success: true, call: null }) : JSON_RESP({ success: true, call: pendingCall });
      }
    });
    await initDm();
    await selectConversation('c1');
    // An incoming offer already on screen is not replaced by the poll.
    rt.handlers.onIncomingCall({ kind: 'call-offer', call: pendingCall, callerName: 'bob' });
    expect(dmState.incomingCall?.call.id).toBe('call-pend-3');
    await refreshPendingCall();
    expect(dmState.incomingCall?.call.id).toBe('call-pend-3');
  });

  it('refreshPendingCall does not surface a ringing call where the user is the caller', async () => {
    const pendingCall = {
      id: 'call-pend-4', conversationId: 'c1', callerId: 'u-me', calleeId: 'u-bob', callType: 'voice' as const,
      status: 'ringing' as const, startedAt: '', answeredAt: null, endedAt: null, createdAt: ''
    };
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'offline' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 }),
      '/api/dm/calls/pending': () => JSON_RESP({ success: true, call: pendingCall })
    });
    await initDm();
    await refreshPendingCall();
    expect(dmState.incomingCall).toBeNull();
  });
});

describe('dm store reactions', () => {
  async function boot() {
    stubFetch({
      '/api/dm/config': () => JSON_RESP({ supabaseUrl: 'x', supabaseAnonKey: 'k', isConfigured: true }),
      '/api/dm/conversations/c1/messages': () => JSON_RESP({ success: true, messages: [] }),
      '/api/dm/conversations': () => JSON_RESP({ success: true, conversations: [makeConv('c1', 'u-bob')] }),
      '/api/dm/presence': (url) => (url.includes('/batch') ? JSON_RESP({ success: true, presence: {} }) : JSON_RESP({ success: true, presence: { userId: 'u-me', status: 'online' } })),
      '/api/dm/unread': () => JSON_RESP({ success: true, totalUnread: 0 })
    });
    await initDm();
    return rt.instances[0];
  }

  it('toggleReaction adds a reaction, applies authoritative state and broadcasts', async () => {
    const rtInst = await boot();
    setDmState('activeConversationId', 'c1');
    setDmState('messages', 'c1', [{ id: 'm1', conversationId: 'c1', senderId: 'u-bob', content: 'hi', messageType: 'text', createdAt: '2025-01-01T00:00:00.000Z' }]);
    stubFetch({
      '/api/dm/reactions': () =>
        JSON_RESP({ success: true, messageId: 'm1', emoji: '👍', action: 'add', reactions: [{ emoji: '👍', count: 1, userIds: ['u-me'] }] })
    });
    await toggleReaction('m1', '👍');
    expect(dmState.messages.c1?.[0]?.reactions).toEqual([{ emoji: '👍', count: 1, userIds: ['u-me'] }]);
    expect(rtInst.sendReaction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dm-reaction', messageId: 'm1', emoji: '👍', action: 'add' }));
  });

  it('incoming reaction broadcasts replace the local reactions buckets', async () => {
    await boot();
    setDmState('messages', 'c1', [
      { id: 'm1', conversationId: 'c1', senderId: 'u-me', content: 'mine', messageType: 'text', createdAt: '2025-01-01T00:00:00.000Z' }
    ]);
    rt.handlers.onReaction({
      kind: 'dm-reaction',
      conversationId: 'c1',
      messageId: 'm1',
      emoji: '😂',
      action: 'add',
      userId: 'u-bob',
      userName: 'bob',
      reactions: [{ emoji: '😂', count: 1, userIds: ['u-bob'] }]
    });
    expect(dmState.messages.c1?.[0]?.reactions).toEqual([{ emoji: '😂', count: 1, userIds: ['u-bob'] }]);
  });
});
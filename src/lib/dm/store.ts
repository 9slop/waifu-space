import { createStore } from 'solid-js/store';
import type {
  CallOfferBroadcast,
  CallSession,
  CallSignalPayload,
  CallType,
  DmConversationSummary,
  DmMessage,
  DmMessageBroadcast,
  DmReaction,
  DmUserLite,
  GifFavorite,
  MessageType,
  PresenceStatus,
  ReactionBroadcast,
  TypingBroadcast,
  UserPresence
} from './types';
import {
  classifyOutgoingMessage,
  createCallRequest,
  createConversation,
  fetchMessages,
  fetchMyPresence,
  fetchPendingCall,
  fetchPresenceBatch,
  fetchUnread,
  GifItem,
  listConversations,
  markConversationRead,
  mergeMessageLists,
  searchGifs,
  searchUsers,
  sendMessageRequest,
  setMyPresenceRequest,
  toDmMessage,
  updateCallStatusRequest,
  updateMessageRequest,
  deleteMessageRequest,
  toggleReactionRequest,
  listGifFavorites,
  addGifFavorite,
  removeGifFavorite,
  gifKeyOfUrl,
  heartbeatPresenceRequest
} from './api';
import { DmRealtime, RealtimePresencePayload } from './realtime';
import { CallManager, CallState } from './call';

// ---------------------------------------------------------------------------
// Client-side DM store
//
// Single reactive source of truth for the DM UI: conversations, messages,
// presence, search and the in-flight call. It talks to the server through the
// RPC-backed routes (./api) and to the world through Supabase Realtime
// (./realtime). The dependency injection (auth supplier + notifier) keeps this
// module fully unit-testable without a browser.
// ---------------------------------------------------------------------------

export interface DmAuth {
  token: string;
  id: string;
  username: string;
  avatarUrl?: string;
}

export interface DmRuntimeDeps {
  getAuth: () => DmAuth | null;
  notify?: (opts: { title: string; body: string }) => void;
  iceServers?: RTCConfiguration['iceServers'];
}

export interface DmCallUi {
  call: CallSession;
  direction: 'incoming' | 'outgoing';
  remoteName: string;
  callState: CallState;
  muted: boolean;
  videoOff: boolean;
  screenSharing: boolean;
  /** Discord-style "deafen": all audio muted (incoming + outgoing). */
  deafened: boolean;
}

export interface DmStoreState {
  ready: boolean;
  connecting: boolean;
  error: string | null;
  conversations: DmConversationSummary[];
  activeConversationId: string | null;
  loadingMessages: string[];
  hasOlder: Record<string, boolean>;
  messages: Record<string, DmMessage[]>;
  presence: Record<string, UserPresence>;
  realtimePresence: Record<string, RealtimePresencePayload>;
  myPresence: UserPresence | null;
  totalUnread: number;
  incomingCall: CallOfferBroadcast | null;
  call: DmCallUi | null;
  pendingIce: CallSignalPayload[];
  searchQuery: string;
  searchResults: DmUserLite[];
  gifQuery: string;
  gifResults: GifItem[];
  gifUnavailable: boolean;
  gifOpen: boolean;
  gifTab: 'search' | 'favorites';
  gifFavorites: GifItem[];
  emojiOpen: boolean;
  typing: Record<string, string[]>;
  /** Id of the message the composer is currently replying to, if any. */
  replyingTo: string | null;
}

interface PendingIncomingCall {
  call: CallSession;
  callerName: string;
}

interface DmRuntime {
  deps: DmRuntimeDeps;
  realtime: DmRealtime | null;
  call: CallManager | null;
  pendingAccept: PendingIncomingCall | null;
  mutedBeforeDeafen: boolean;
  lastTypingEmit: number;
  /** Whether the last presence write came from the auto monitor. */
  presenceOrigin: 'auto' | 'manual';
  pendingPollTimer: ReturnType<typeof setInterval> | null;
}

const runtime: DmRuntime = {
  deps: { getAuth: () => null, notify: undefined },
  realtime: null,
  call: null,
  pendingAccept: null,
  mutedBeforeDeafen: false,
  lastTypingEmit: 0,
  presenceOrigin: 'manual',
  pendingPollTimer: null
};

/** How often the store re-polls the DB for a pending (ringing/active) call. */
const PENDING_CALL_POLL_MS = 45_000;

const INITIAL: DmStoreState = {
  ready: false,
  connecting: false,
  error: null,
  conversations: [],
  activeConversationId: null,
  loadingMessages: [],
  hasOlder: {},
  messages: {},
  presence: {},
  realtimePresence: {},
  myPresence: null,
  totalUnread: 0,
  incomingCall: null,
  call: null,
  pendingIce: [],
  searchQuery: '',
  searchResults: [],
  gifQuery: '',
  gifResults: [],
  gifUnavailable: false,
  gifOpen: false,
  gifTab: 'search',
  gifFavorites: [],
  emojiOpen: false,
  typing: {},
  replyingTo: null
};

export const [dmState, setDmState] = createStore<DmStoreState>(JSON.parse(JSON.stringify(INITIAL)));

/** Configures runtime deps (auth + notifier). Call once at app boot. */
export function configureDmRuntime(deps: DmRuntimeDeps): void {
  runtime.deps = { notify: defaultNotify, ...deps };
}

function currentAuth(): DmAuth | null {
  return runtime.deps.getAuth();
}

function notify(title: string, body: string): void {
  runtime.deps.notify?.({ title, body });
}

function defaultNotify({ title, body }: { title: string; body: string }): void {
  void (async () => {
    const { sendNotification } = await import('../notifications');
    const { showToast } = await import('../store');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      sendNotification(title, body);
    } else {
      showToast(`${title} — ${body}`);
    }
  })();
}

// ---------------------------------------------------------------------------
// Realtime wiring
// ---------------------------------------------------------------------------

function onRealtimeMessage(broadcast: DmMessageBroadcast): void {
  const auth = currentAuth();
  const msg = toDmMessage(broadcast.message);
  const convId = broadcast.conversationId;
  const active = dmState.activeConversationId === convId;
  const isMine = !!auth && msg.senderId === auth.id;
  const wasUnread = dmState.conversations.find(c => c.id === convId)?.unreadCount ?? 0;
  const isSystem = msg.messageType === 'system';

  setDmState('messages', convId, (prev = []) => mergeMessageLists([prev, [msg]]));
  setDmState('conversations', (convs) =>
    convs
      .map((c) => {
        if (c.id !== convId) return c;
        const unreadCount = isSystem || isMine || active ? c.unreadCount ?? 0 : (c.unreadCount ?? 0) + 1;
        return { ...c, lastMessage: msg, updatedAt: msg.createdAt, unreadCount };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  );

  const wasIncoming = !isMine;
  if (wasIncoming && !active && wasUnread === 0 && !isSystem) {
    // Don't double-count: the server unaware increments; this store keeps the
    // local total roughly in sync with the badge while a conversation is open.
    setDmState('totalUnread', (n) => n + 1);
  }

  if (!isMine && !isSystem) {
    const dnd = dmState.presence[msg.senderId]?.status === 'dnd';
    const sender = broadcast.senderName || dmState.conversations.find(c => c.id === convId)?.otherUser?.username || 'Someone';
    const attachment = msg.messageType === 'gif' ? 'Sent a GIF' : msg.messageType === 'image' ? 'Sent an image' : msg.messageType === 'video' ? 'Sent a video' : '';
    if (!dnd) notify(broadcast.senderName || sender, attachment || msg.content || '(attachment)');
  }
}

function onRealtimeTyping(broadcast: TypingBroadcast): void {
  if (broadcast.userId === currentAuth()?.id) return;
  if (dmState.conversations.find(c => c.id === broadcast.conversationId) === undefined) return;
  setDmState('typing', broadcast.conversationId, (prev) => {
    const next = (prev ?? []).filter(id => id !== broadcast.userId);
    next.push(broadcast.userId);
    if (next.length > 5) next.splice(0, next.length - 5);
    return next;
  });
  setTimeout(() => {
    const current = dmState.typing[broadcast.conversationId];
    if (current?.includes(broadcast.userId)) {
      const remaining = current.filter(id => id !== broadcast.userId);
      if (remaining.length === 0) {
        setDmState('typing', broadcast.conversationId, []);
      } else {
        setDmState('typing', broadcast.conversationId, remaining);
      }
    }
  }, 5000);
}

/** Replaces a message's reaction buckets with the authoritative list. */
function applyReactionReactions(msgs: DmMessage[], messageId: string, reactions: DmReaction[]): DmMessage[] {
  return msgs.map(m => (m.id === messageId ? { ...m, reactions } : m));
}

/** Optimistically toggles the reacting user in/out of a bucket (pure). */
function optimisticToggleReaction(msgs: DmMessage[], messageId: string, emoji: string, userId: string): DmMessage[] {
  return msgs.map(m => {
    if (m.id !== messageId) return m;
    const list = m.reactions ?? [];
    const bucket = list.find(r => r.emoji === emoji);
    if (bucket && bucket.userIds.includes(userId)) {
      const next = bucket.count <= 1
        ? list.filter(r => r.emoji !== emoji)
        : list.map(r => (r.emoji === emoji ? { ...r, count: r.count - 1, userIds: r.userIds.filter(u => u !== userId) } : r));
      return { ...m, reactions: next };
    }
    const next = bucket
      ? list.map(r => (r.emoji === emoji ? { ...r, count: r.count + 1, userIds: [...r.userIds, userId] } : r))
      : [...list, { emoji, count: 1, userIds: [userId] }];
    return { ...m, reactions: next };
  });
}

function onRealtimeReaction(broadcast: ReactionBroadcast): void {
  if (broadcast.userId === currentAuth()?.id) return;
  const convId = broadcast.conversationId;
  if (!Array.isArray(dmState.messages[convId])) return;
  setDmState('messages', convId, (prev = []) => applyReactionReactions(prev, broadcast.messageId, broadcast.reactions));
}

function onRealtimePresence(map: Record<string, RealtimePresencePayload>): void {
  setDmState('realtimePresence', map);
}

function sendSignal(type: CallSignalPayload['type'], callId: string, conversationId: string, extras: Partial<CallSignalPayload>): void {
  void runtime.realtime?.sendCallSignal({ kind: 'call-signal', callId, conversationId, type, ...extras });
}

function flushPendingIce(conversationId: string, callId: string): void {
  const list = dmState.pendingIce;
  if (!list.length) return;
  setDmState('pendingIce', []);
  for (const s of list) sendSignal('ice', callId, conversationId, { candidate: s.candidate });
}

async function handleCallSignal(signal: CallSignalPayload): Promise<void> {
  const manager = runtime.call;
  if (!manager) return;
  const call = dmState.call;

  if (signal.type === 'offer') {
    // Caller's offer for an incoming call the user already accepted.
    if (runtime.pendingAccept && signal.callId === runtime.pendingAccept.call.id && signal.sdp) {
      const pending = runtime.pendingAccept;
      runtime.pendingAccept = null;
      const answer = await manager.acceptOffer(pending.call.id, pending.call.callerId, signal.sdp);
      if (answer) sendSignal('answer', pending.call.id, pending.call.conversationId, { sdp: answer });
      flushPendingIce(pending.call.conversationId, pending.call.id);
      return;
    }
    // A renegotiation offer mid-call (e.g. the remote side added a track).
    // Only accept once connected — a ringing outgoing call may receive its
    // own echo-back broadcast, which must not flip the state to 'connected'.
    if (call && signal.callId === call.call.id && signal.sdp && call.callState === 'connected') {
      const remoteId = call.direction === 'outgoing' ? call.call.calleeId : call.call.callerId;
      const answer = await manager.acceptOffer(call.call.id, remoteId, signal.sdp);
      if (answer) sendSignal('answer', call.call.id, call.call.conversationId, { sdp: answer });
    }
    return;
  }

  if (!call || signal.callId !== call.call.id) return;

  if (signal.type === 'answer') {
    if (signal.sdp) await manager.adoptAnswer(signal.sdp);
    flushPendingIce(signal.conversationId, call.call.id);
  } else if (signal.type === 'ice' && signal.candidate) {
    if (call.callState === 'connected') {
      await manager.adoptIce(signal.candidate);
    } else {
      setDmState('pendingIce', (list) => [...list, signal]);
    }
  }
}

function onIncomingCallOffer(broadcast: CallOfferBroadcast): void {
  if (dmState.incomingCall?.call.id === broadcast.call.id) return;
  setDmState('incomingCall', broadcast);
  notify(`${broadcast.callerName} is calling`, callTypeLabel(broadcast.call.callType));
}

function onIncomingCallCancel(broadcast: CallOfferBroadcast): void {
  if (dmState.incomingCall?.call.id === broadcast.call.id) {
    setDmState('incomingCall', null);
  }
}

/** Applies a system message to the local timeline and tells the peer via realtime. */
function applySystemMessage(convId: string, message: DmMessage | null | undefined): void {
  if (!message) return;
  setDmState('messages', convId, (prev = []) => mergeMessageLists([prev, [message]]));
  setDmState('conversations', (convs) => {
    if (!convs.some((c) => c.id === convId)) return convs;
    return convs
      .map((c) => (c.id === convId ? { ...c, lastMessage: message, updatedAt: message.createdAt } : c))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });
  void runtime.realtime?.sendMessage({
    kind: 'dm-message',
    conversationId: convId,
    message,
    senderName: '',
    senderAvatar: undefined
  });
}

function callTypeLabel(type: CallType): string {
  return type === 'screen' ? 'Screen share' : type === 'video' ? 'Video call' : 'Voice call';
}

// ---------------------------------------------------------------------------
// Call manager plumb + UI helpers
// ---------------------------------------------------------------------------

function makeCallManager(): CallManager {
  const manager = runtime.call ?? new CallManager({ iceServers: runtime.deps.iceServers });
  runtime.call = manager;
  return manager;
}

function wireCallManager(call: CallSession, manager: CallManager): void {
  manager.deps.onStateChange = () => {
    setDmState('call', (prev) =>
      prev
        ? {
            ...prev,
            callState: manager.currentState,
            muted: manager.isMuted(),
            videoOff: manager.isVideoOff(),
            screenSharing: manager.isScreenSharing()
          }
        : prev
    );
  };
  manager.deps.onIceCandidate = (candidate) => {
    const convId = call.conversationId;
    if (dmState.call?.callState === 'connected') {
      sendSignal('ice', call.id, convId, { candidate });
    } else {
      setDmState('pendingIce', (list) => [...list, { kind: 'call-signal', callId: call.id, conversationId: convId, type: 'ice', candidate }]);
    }
  };
  manager.deps.onRenegotiation = (offer, callId) => {
    if (callId !== call.id) return;
    sendSignal('offer', call.id, call.conversationId, { sdp: offer });
  };
}

export const callLocalStream = (): MediaStream | null => runtime.call?.localMedia ?? null;
export const callRemoteStream = (): MediaStream | null => runtime.call?.remoteMedia ?? null;

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

/** Boots the DM system: connects realtime, loads conversations + presence. */
export async function initDm(): Promise<boolean> {
  const auth = currentAuth();
  if (!auth) return false;
  setDmState({ connecting: true, error: null });
  try {
    const config = await (await fetch('/api/dm/config')).json();
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
      setDmState({ connecting: false, error: 'DM unavailable' });
      return false;
    }

    await runtime.realtime?.disconnect().catch(() => undefined);
    runtime.call?.hangUp('ended');
    runtime.call = null;

    const rt = new DmRealtime(config, {
      onMessage: onRealtimeMessage,
      onTyping: onRealtimeTyping,
      onReaction: onRealtimeReaction,
      onCallSignal: (s) => void handleCallSignal(s),
      onIncomingCall: onIncomingCallOffer,
      onCallCancel: onIncomingCallCancel,
      onPresenceChange: onRealtimePresence
    });
    runtime.realtime = rt;

    await rt.connect({ id: auth.id, username: auth.username, avatar: auth.avatarUrl });

    const [convs, presence, unread] = await Promise.all([
      listConversations(auth.token),
      fetchMyPresence(auth.token),
      fetchUnread(auth.token)
    ]);
    setDmState({ conversations: convs, myPresence: presence, totalUnread: unread, ready: true, connecting: false });

    // Subscribe to every conversation channel for the whole session so messages
    // and call signals arrive live no matter which page the user is on (the
    // channel set is small and unsubscribe only happens on disconnect).
    for (const c of convs) void rt.subscribeConversation(c.id);

    const participantIds = Array.from(new Set(convs.flatMap(c => (c.otherUser?.id ? [c.otherUser.id] : []))));
    if (participantIds.length) {
      const batch = await fetchPresenceBatch(auth.token, participantIds);
      setDmState('presence', batch);
    }

    await rt.trackPresence({
      userId: auth.id,
      username: auth.username,
      avatar: auth.avatarUrl,
      status: visibleFromStored(presence.status),
      customStatus: presence.customStatus ?? undefined,
      at: Date.now()
    });

    // Load saved GIF favorites so message hover hearts reflect them before
    // the picker has ever been opened.
    void gifLoadFavorites();

    // Incoming/busy calls ride the lossy realtime channel; poll the DB so a
    // missed call-offer broadcast or a refresh never hides a pending call.
    void refreshPendingCall();
    runtime.pendingPollTimer ??= setInterval(() => void refreshPendingCall(), PENDING_CALL_POLL_MS);
    return true;
  } catch (e) {
    setDmState({ connecting: false, error: e instanceof Error ? e.message : 'Failed to start DM' });
    return false;
  }
}

function visibleFromStored(status: PresenceStatus): PresenceStatus {
  return status === 'invisible' || status === 'offline' ? 'offline' : status;
}

export async function refreshConversations(): Promise<DmConversationSummary[]> {
  const auth = currentAuth();
  if (!auth) return [];
  const convs = await listConversations(auth.token);
  setDmState('conversations', convs);
  const participantIds = Array.from(new Set(convs.flatMap(c => (c.otherUser?.id ? [c.otherUser.id] : []))));
  if (participantIds.length) {
    const batch = await fetchPresenceBatch(auth.token, participantIds);
    setDmState('presence', batch);
  }
  return convs;
}

export async function openConversation(otherUserId: string): Promise<void> {
  const auth = currentAuth();
  if (!auth) return;
  try {
    const conv = await createConversation(auth.token, otherUserId);
    await selectConversation(conv.id);
    await refreshConversations();
  } catch {
    setDmState('error', 'Could not open that conversation');
  }
}

export async function selectConversation(conversationId: string): Promise<void> {
  const auth = currentAuth();
  if (!auth) return;
  setDmState('activeConversationId', conversationId);
  if (dmState.messages[conversationId] === undefined) {
    setDmState('loadingMessages', (list) => (list.includes(conversationId) ? list : [...list, conversationId]));
    try {
      const msgs = await fetchMessages(auth.token, conversationId, { limit: 50 });
      setDmState('messages', conversationId, msgs);
      setDmState('hasOlder', conversationId, msgs.length === 50);
    } finally {
      setDmState('loadingMessages', (list) => list.filter(id => id !== conversationId));
    }
  }
  void runtime.realtime?.subscribeConversation(conversationId);
  const conv = dmState.conversations.find(c => c.id === conversationId);
  if (conv && (conv.unreadCount ?? 0) > 0) {
    void markRead(conversationId);
  }
}

async function markRead(conversationId: string): Promise<void> {
  const auth = currentAuth();
  if (!auth) return;
  try {
    await markConversationRead(auth.token, conversationId);
    setDmState('conversations', (convs) => convs.map(c => (c.id === conversationId ? { ...c, unreadCount: 0, lastReadAt: new Date().toISOString() } : c)));
    const unread = await fetchUnread(auth.token);
    setDmState('totalUnread', unread);
  } catch {
    // ignore
  }
}

export async function loadOlder(): Promise<void> {
  const auth = currentAuth();
  const convId = dmState.activeConversationId;
  if (!auth || !convId) return;
  const existing = dmState.messages[convId];
  if (!existing?.length) return;
  setDmState('loadingMessages', (list) => (list.includes(convId) ? list : [...list, convId]));
  try {
    const older = await fetchMessages(auth.token, convId, { before: existing[0].createdAt, limit: 50 });
    if (older.length) {
      setDmState('messages', convId, mergeMessageLists([older, existing]));
    }
    setDmState('hasOlder', convId, older.length === 50);
  } finally {
    setDmState('loadingMessages', (list) => list.filter(id => id !== convId));
  }
}

export async function sendText(text: string, replyToId?: string | null): Promise<DmMessage | null> {
  const auth = currentAuth();
  const convId = dmState.activeConversationId;
  if (!auth || !convId) return null;
  const { content, messageType, mediaUrl } = classifyOutgoingMessage(text);
  if (!content && !mediaUrl) return null;
  const msg = await sendViaApi(convId, { content, messageType, mediaUrl, replyToId });
  if (msg) setDmState('replyingTo', null);
  return msg;
}

export async function sendGif(url: string): Promise<DmMessage | null> {
  const auth = currentAuth();
  const convId = dmState.activeConversationId;
  if (!auth || !convId || !url) return null;
  return sendViaApi(convId, { content: '', messageType: 'gif', mediaUrl: url });
}

async function sendViaApi(convId: string, payload: { content: string; messageType: MessageType; mediaUrl: string | null; replyToId?: string | null }): Promise<DmMessage | null> {
  const auth = currentAuth();
  if (!auth) return null;
  try {
    const msg = await sendMessageRequest(auth.token, convId, payload);
    setDmState('messages', convId, (prev = []) => mergeMessageLists([prev, [msg]]));
    setDmState('conversations', (convs) =>
      convs
        .map(c => (c.id === convId ? { ...c, lastMessage: msg, updatedAt: msg.createdAt, unreadCount: 0 } : c))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    );
    const conv = dmState.conversations.find(c => c.id === convId);
    void runtime.realtime?.sendMessage({ kind: 'dm-message', conversationId: convId, message: msg, senderName: auth.username, senderAvatar: auth.avatarUrl });
    return msg;
  } catch {
    setDmState('error', 'Message failed to send');
    return null;
  }
}

/** Targets the next composed message at an earlier message (reply). */
export function setReplyTarget(messageId: string | null): void {
  setDmState('replyingTo', messageId);
}

/** Edits one of the current user's text messages in place. */
export async function editMessage(messageId: string, content: string): Promise<DmMessage | null> {
  const auth = currentAuth();
  const convId = dmState.activeConversationId;
  const trimmed = content.trim();
  if (!auth || !convId || !trimmed) return null;
  try {
    const msg = await updateMessageRequest(auth.token, convId, messageId, trimmed);
    setDmState('messages', convId, (prev = []) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...msg, reactions: m.reactions ?? msg.reactions }
          : m
      )
    );
    setDmState('conversations', (convs) =>
      convs.map((c) =>
        c.id === convId && c.lastMessage?.id === messageId ? { ...c, lastMessage: { ...c.lastMessage, ...msg } } : c
      )
    );
    return msg;
  } catch {
    setDmState('error', 'Message failed to edit');
    return null;
  }
}

/** Soft-deletes one of the current user's messages (renders as deleted). */
export async function deleteMessage(messageId: string): Promise<boolean> {
  const auth = currentAuth();
  const convId = dmState.activeConversationId;
  if (!auth || !convId) return false;
  try {
    await deleteMessageRequest(auth.token, convId, messageId);
    const deletedAt = new Date().toISOString();
    setDmState('messages', convId, (prev = []) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, deletedAt, content: '', mediaUrl: null, reactions: [] } : m
      )
    );
    setDmState('conversations', (convs) =>
      convs.map((c) =>
        c.id === convId && c.lastMessage?.id === messageId
          ? { ...c, lastMessage: { ...c.lastMessage, deletedAt, content: '', mediaUrl: null } }
          : c
      )
    );
    if (dmState.replyingTo === messageId) setDmState('replyingTo', null);
    return true;
  } catch {
    setDmState('error', 'Message failed to delete');
    return false;
  }
}

export function emitTyping(): void {
  const auth = currentAuth();
  const convId = dmState.activeConversationId;
  if (!auth || !convId) return;
  const now = Date.now();
  if (now - runtime.lastTypingEmit < 1500) return;
  runtime.lastTypingEmit = now;
  void runtime.realtime?.sendTyping({ kind: 'typing', conversationId: convId, userId: auth.id, userName: auth.username, at: now });
}

export async function setOwnPresence(status: PresenceStatus, customStatus?: string | null): Promise<void> {
  const auth = currentAuth();
  if (!auth) return;
  runtime.presenceOrigin = 'manual';
  try {
    const presence = await setMyPresenceRequest(auth.token, status, customStatus);
    setDmState('myPresence', presence);
    void runtime.realtime?.trackPresence({
      userId: auth.id,
      username: auth.username,
      avatar: auth.avatarUrl,
      status: visibleFromStored(status),
      customStatus: customStatus ?? undefined,
      at: Date.now()
    });
  } catch {
    setDmState('error', 'Could not update status');
  }
}

/**
 * Marks an automatic presence update (online->idle / online->offline) coming
 * from the presence auto-monitor so the store knows the current status was not
 * chosen by the user. Writes follow the same path as `setOwnPresence` but the
 * `presenceOrigin` stays 'auto'.
 */
export async function setOwnPresenceAuto(status: PresenceStatus, customStatus?: string | null): Promise<void> {
  const auth = currentAuth();
  if (!auth) return;
  runtime.presenceOrigin = 'auto';
  try {
    const presence = await setMyPresenceRequest(auth.token, status, customStatus);
    setDmState('myPresence', presence);
    void runtime.realtime?.trackPresence({
      userId: auth.id,
      username: auth.username,
      avatar: auth.avatarUrl,
      status: visibleFromStored(status),
      customStatus: customStatus ?? undefined,
      at: Date.now()
    });
  } catch {
    setDmState('error', 'Could not update status');
  }
}

/** Whether the last presence write was automatic (drives the auto monitor's gating). */
export function isAutoPresence(): boolean {
  return runtime.presenceOrigin === 'auto';
}

/** Refreshes the last-seen timestamp on the server without changing the stored status. */
export async function heartbeatPresence(): Promise<void> {
  const auth = currentAuth();
  if (!auth) return;
  try {
    await heartbeatPresenceRequest(auth.token);
  } catch {
    // Heartbeat failures are transient and non-critical.
  }
}

export async function dmSearch(query: string): Promise<DmUserLite[]> {
  const auth = currentAuth();
  const trimmed = query.trim();
  setDmState('searchQuery', query);
  if (!auth || trimmed.length < 2) {
    setDmState('searchResults', []);
    return [];
  }
  try {
    const users = await searchUsers(auth.token, trimmed);
    setDmState('searchResults', users);
    return users;
  } catch {
    setDmState('searchResults', []);
    return [];
  }
}

export function clearSearch(): void {
  setDmState({ searchQuery: '', searchResults: [] });
}

export async function gifSearch(query: string): Promise<GifItem[]> {
  const auth = currentAuth();
  setDmState('gifQuery', query);
  if (!auth) return [];
  try {
    const result = await searchGifs(auth.token, query);
    setDmState('gifResults', result.items);
    setDmState('gifUnavailable', result.source === 'none' && !result.keyConfigured);
    return result.items;
  } catch {
    setDmState('gifResults', []);
    return [];
  }
}

export function setGifOpen(open: boolean): void {
  setDmState('gifOpen', open);
}

export function setEmojiOpen(open: boolean): void {
  setDmState('emojiOpen', open);
}

/** Toggles the active user's emoji reaction on a message (optimistic). */
export async function toggleReaction(messageId: string, emoji: string): Promise<void> {
  const auth = currentAuth();
  const convId = dmState.activeConversationId;
  if (!auth || !convId || !messageId || !emoji) return;
  if (!Array.isArray(dmState.messages[convId])) return;
  const uid = auth.id;
  setDmState('messages', convId, (prev = []) => optimisticToggleReaction(prev, messageId, emoji, uid));
  try {
    const result = await toggleReactionRequest(auth.token, messageId, emoji);
    setDmState('messages', convId, (prev = []) => applyReactionReactions(prev, messageId, result.reactions));
    const broadcast: ReactionBroadcast = {
      kind: 'dm-reaction',
      conversationId: convId,
      messageId,
      emoji,
      action: result.action,
      userId: uid,
      userName: auth.username,
      reactions: result.reactions
    };
    void runtime.realtime?.sendReaction(broadcast);
  } catch {
    setDmState('messages', convId, (prev = []) => optimisticToggleReaction(prev, messageId, emoji, uid));
    setDmState('error', 'Reaction could not be saved');
  }
}

export function setGifTab(tab: 'search' | 'favorites'): void {
  setDmState('gifTab', tab);
  if (tab === 'favorites') void gifLoadFavorites();
}

export function isGifFavorited(id: string): boolean {
  return dmState.gifFavorites.some((f) => f.id === id);
}

function favToItem(f: GifFavorite): GifItem {
  return { id: f.gifId, url: f.url, preview: f.preview || f.url, width: f.width, height: f.height, title: f.title || undefined };
}

export async function gifLoadFavorites(): Promise<GifItem[]> {
  const auth = currentAuth();
  if (!auth) return [];
  try {
    const favorites = await listGifFavorites(auth.token);
    const items = favorites.map(favToItem);
    setDmState('gifFavorites', items);
    return items;
  } catch {
    setDmState('gifFavorites', []);
    return [];
  }
}

/** Toggles a GIF's favorite state by its picker key (provider id). */
export async function gifToggleFavorite(item: GifItem): Promise<boolean> {
  const auth = currentAuth();
  if (!auth) return false;
  const existing = dmState.gifFavorites.some((f) => f.id === item.id);
  try {
    if (existing) {
      await removeGifFavorite(auth.token, item.id);
      setDmState('gifFavorites', (list) => list.filter((f) => f.id !== item.id));
      return false;
    }
    const fav = await addGifFavorite(auth.token, {
      gifId: item.id,
      url: item.url,
      preview: item.preview || item.url,
      width: item.width || 0,
      height: item.height || 0,
      title: item.title || ''
    });
    setDmState('gifFavorites', (list) => [favToItem(fav), ...list.filter((f) => f.id !== item.id)]);
    return true;
  } catch {
    setDmState('error', 'Could not update favorite');
    return existing;
  }
}

/** Toggles favorite state for a media URL (used from rendered chat media). */
export async function gifToggleFavoriteByUrl(url: string, title = ''): Promise<void> {
  if (!url) return;
  const key = gifKeyOfUrl(url);
  await gifToggleFavorite({ id: key, url, preview: url, width: 0, height: 0, title });
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export async function startCall(type: CallType): Promise<boolean> {
  const auth = currentAuth();
  const conv = dmState.conversations.find(c => c.id === dmState.activeConversationId);
  const otherId = conv?.otherUser?.id;
  if (!auth || !conv || !otherId) return false;
  try {
    const result = await createCallRequest(auth.token, conv.id, otherId, type);
    if (result.joined) {
      // The server found an already-ringing or already-active call in this
      // conversation involving us. Adopt it instead of starting a fresh
      // ringing flow: do NOT ring the (already busy) callee a second time.
      return joinExistingCall(result.call, conv, auth);
    }
    const call = result.call;
    const manager = makeCallManager();
    const ok = await manager.startLocal({ type, audio: true, video: type === 'video', screen: type === 'screen' });
    if (!ok) {
      await updateCallStatusRequest(auth.token, call.id, 'canceled').catch(() => undefined);
      return false;
    }
    wireCallManager(call, manager);
    setDmState('call', { call, direction: 'outgoing', remoteName: conv.otherUser.username, callState: 'ringing', muted: false, videoOff: type !== 'video', screenSharing: false, deafened: false });
    const offer = await manager.createOffer(call.id, otherId);
    if (offer) {
      sendSignal('offer', call.id, conv.id, { sdp: offer });
      void runtime.realtime?.sendIncomingCallOffer({ kind: 'call-offer', call, callerName: auth.username, offer });
    }
    return true;
  } catch {
    setDmState('error', 'Call could not be started');
    return false;
  }
}

/**
 * Adopts a call the server told us already exists (busy/ringing/active in the
 * same conversation). The caller becomes the joining party: the remote side is
 * already busy, so there is NO ringing and no new incoming-call broadcast.
 * Instead the call manager is wired to the returned call id, the UI moves
 * straight to the active dock, and a renegotiation offer is sent over the
 * conversation's call-signal channel so the already-joined participant answers
 * it (the existing accept/answer wiring) and the media links up.
 */
async function joinExistingCall(call: CallSession, conv: DmConversationSummary, auth: DmAuth): Promise<boolean> {
  const manager = makeCallManager();
  const ok = await manager.startLocal({ type: call.callType, audio: true, video: call.callType === 'video', screen: call.callType === 'screen' });
  if (!ok) return false;
  wireCallManager(call, manager);
  setDmState('call', { call, direction: 'outgoing', remoteName: conv.otherUser.username, callState: 'active', muted: false, videoOff: call.callType !== 'video', screenSharing: false, deafened: false });
  void runtime.realtime?.subscribeConversation(call.conversationId);
  const offer = await manager.createOffer(call.id, call.calleeId === auth.id ? call.callerId : call.calleeId);
  if (offer) sendSignal('offer', call.id, call.conversationId, { sdp: offer });
  return true;
}

/**
 * Recovery/fallback path for the lossy realtime call-offer channel: asks the
 * DB for the newest ringing/active call the current user is a party to and
 * hydrates the incoming-call state so a missed broadcast or a refresh never
 * hides an in-progress call. Real-time remains the fast path; this poll never
 * clobbers a call the user is already actively managing.
 */
export async function refreshPendingCall(): Promise<void> {
  const auth = currentAuth();
  if (!auth) return;
  if (dmState.call || dmState.incomingCall) return;
  try {
    const call = await fetchPendingCall(auth.token);
    if (!call || (call.status !== 'ringing' && call.status !== 'active')) return;
    if (dmState.call || dmState.incomingCall) return;
    // A still-ringing call where we are the caller is covered by our own
    // outgoing panel; only surface the rejoin/incoming affordance otherwise.
    if (call.status === 'ringing' && call.callerId === auth.id) return;
    const conv = dmState.conversations.find(c => c.id === call.conversationId);
    const callerName =
      conv && call.callerId === conv.otherUser?.id
        ? conv.otherUser.username
        : call.callerId === auth.id ? auth.username : '';
    setDmState('incomingCall', { call, callerName });
  } catch {
    // Poll failures are transient; the realtime channel remains the fast path.
  }
}

export async function acceptIncomingCall(): Promise<boolean> {
  const auth = currentAuth();
  const offer = dmState.incomingCall;
  if (!auth || !offer) return false;
  const { call, callerName } = offer;
  const manager = makeCallManager();
  const ok = await manager.startLocal({ type: call.callType, audio: true, video: call.callType === 'video', screen: call.callType === 'screen' });
  if (!ok) {
    setDmState('incomingCall', null);
    return false;
  }
  wireCallManager(call, manager);
  setDmState({ incomingCall: null, call: { call, direction: 'incoming', remoteName: callerName, callState: 'ringing', muted: false, videoOff: call.callType !== 'video', screenSharing: false, deafened: false } });
  void runtime.realtime?.subscribeConversation(call.conversationId);
  // Mark the call as answered on the server so both timelines get the
  // "call started" system message and the call session reflects the state.
  const result = await updateCallStatusRequest(auth.token, call.id, 'active').catch(() => null);
  if (result?.systemMessage) applySystemMessage(call.conversationId, result.systemMessage);
  if (offer.offer) {
    const answer = await manager.acceptOffer(call.id, call.callerId, offer.offer);
    if (answer) sendSignal('answer', call.id, call.conversationId, { sdp: answer });
    flushPendingIce(call.conversationId, call.id);
    return true;
  }
  // Offer not yet arrived; it is handled when onCallSignal fires later.
  runtime.pendingAccept = { call, callerName };
  return true;
}

export async function declineIncomingCall(): Promise<void> {
  const auth = currentAuth();
  const offer = dmState.incomingCall;
  setDmState('incomingCall', null);
  runtime.pendingAccept = null;
  if (!auth || !offer) return;
  const result = await updateCallStatusRequest(auth.token, offer.call.id, 'declined').catch(() => null);
  if (result?.systemMessage) applySystemMessage(offer.call.conversationId, result.systemMessage);
}

export async function hangUpCall(): Promise<void> {
  const auth = currentAuth();
  const call = dmState.call;

  if (!call) {
    // Caller canceled while ringing / user dismissed the incoming panel.
    const offer = dmState.incomingCall;
    setDmState('incomingCall', null);
    runtime.pendingAccept = null;
    if (auth && offer?.call.status === 'ringing') {
      const result = await updateCallStatusRequest(auth.token, offer.call.id, 'declined').catch(() => null);
      if (result?.systemMessage) applySystemMessage(offer.call.conversationId, result.systemMessage);
      void runtime.realtime?.sendCallCancel(offer.call.calleeId, { kind: 'call-offer', call: offer.call, callerName: auth.username });
    }
    return;
  }

  runtime.call?.hangUp('ended');
  announceCallCancel(call, auth);
  if (auth) {
    const status = call.callState === 'ringing' ? (call.direction === 'outgoing' ? 'canceled' : 'declined') : 'ended';
    const result = await updateCallStatusRequest(auth.token, call.call.id, status).catch(() => null);
    if (result?.systemMessage) applySystemMessage(call.call.conversationId, result.systemMessage);
  }
  setDmState('call', null);
  setDmState('incomingCall', null);
}

function announceCallCancel(call: DmCallUi, auth: DmAuth | null): void {
  if (call.direction === 'outgoing' && auth) {
    void runtime.realtime?.sendCallCancel(call.call.calleeId, { kind: 'call-offer', call: call.call, callerName: auth.username });
  }
}

export async function markCallBusyAndReject(): Promise<void> {
  const auth = currentAuth();
  const offer = dmState.incomingCall;
  if (!auth || !offer) return;
  const result = await updateCallStatusRequest(auth.token, offer.call.id, 'busy').catch(() => null);
  if (result?.systemMessage) applySystemMessage(offer.call.conversationId, result.systemMessage);
  setDmState('incomingCall', null);
  runtime.pendingAccept = null;
}

export function toggleMute(): boolean {
  const manager = runtime.call;
  if (!manager) return false;
  manager.toggleMute();
  setDmState('call', (prev) => (prev ? { ...prev, muted: manager.isMuted() } : prev));
  return manager.isMuted();
}

export function toggleVideo(): boolean {
  const manager = runtime.call;
  if (!manager) return false;
  manager.toggleVideo();
  setDmState('call', (prev) => (prev ? { ...prev, videoOff: manager.isVideoOff() } : prev));
  return manager.isVideoOff();
}

/** Toggles screen sharing on/off during a connected call. */
export async function toggleScreenShare(): Promise<boolean> {
  const manager = runtime.call;
  if (!manager) return false;
  const sharing = manager.isScreenSharing();
  const ok = sharing ? await manager.disableScreenShare() : await manager.enableScreenShare();
  setDmState('call', (prev) => (prev ? { ...prev, screenSharing: manager.isScreenSharing(), videoOff: manager.isVideoOff() } : prev));
  return ok;
}

/** Enables a camera feed mid-call when the call started as voice. */
export async function enableCallCamera(): Promise<boolean> {
  const manager = runtime.call;
  if (!manager) return false;
  const ok = await manager.ensureCamera();
  setDmState('call', (prev) => (prev ? { ...prev, videoOff: manager.isVideoOff() } : prev));
  return ok;
}

/** Camera button: turn the camera off/on (acquiring one if needed). */
export async function cameraButtonPressed(): Promise<void> {
  const manager = runtime.call;
  if (!manager) return;
  if (manager.hasVideoTracks()) {
    manager.toggleVideo();
  } else {
    await manager.ensureCamera();
  }
  setDmState('call', (prev) => (prev ? { ...prev, videoOff: manager.isVideoOff(), screenSharing: manager.isScreenSharing() } : prev));
}

/** Discord-style deafen: silences all audio and force-mutes the mic. */
export function toggleDeafen(): boolean {
  const manager = runtime.call;
  if (!manager) return false;
  const prev = dmState.call?.deafened ?? false;
  if (!prev) {
    runtime.mutedBeforeDeafen = manager.isMuted();
    if (!runtime.mutedBeforeDeafen) manager.toggleMute();
    manager.setRemoteAudioEnabled(false);
    setDmState('call', (c) => (c ? { ...c, deafened: true, muted: true } : c));
  } else {
    manager.setRemoteAudioEnabled(true);
    if (!runtime.mutedBeforeDeafen) manager.toggleMute();
    setDmState('call', (c) => (c ? { ...c, deafened: false, muted: manager.isMuted() } : c));
  }
  return !prev;
}

export function resetDmStore(): void {
  if (runtime.pendingPollTimer) {
    clearInterval(runtime.pendingPollTimer);
    runtime.pendingPollTimer = null;
  }
  setDmState(JSON.parse(JSON.stringify(INITIAL)));
}

export async function disconnectDm(): Promise<void> {
  runtime.call?.hangUp('ended');
  runtime.call = null;
  runtime.pendingAccept = null;
  if (runtime.pendingPollTimer) {
    clearInterval(runtime.pendingPollTimer);
    runtime.pendingPollTimer = null;
  }
  await runtime.realtime?.disconnect().catch(() => undefined);
  runtime.realtime = null;
  resetDmStore();
}
import type {
  CallSession,
  CallStatus,
  CallType,
  DmConversationSummary,
  DmMessage,
  DmReaction,
  DmUserLite,
  DmUserProfile,
  GifFavorite,
  MessageType,
  PresenceStatus,
  ReactionToggleResult,
  UserPresence
} from './types';

// ---------------------------------------------------------------------------
// Pure helpers (framework-free, unit-tested)
// ---------------------------------------------------------------------------

export type MediaKind = 'gif' | 'image' | 'video';

const GIF_EXT_RE = /\.(gif|gifv)(\?.*)?$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|avif|bmp|gif|gifv)(\?.*)?$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i;
const KNOWN_GIF_PROVIDER_RE =
  /(tenor\.com|giphy\.com|media\.tenor\.com|media\.giphy\.com|i\.giphy\.media|media\.gif|gph\.is)/i;
/** Extracts a GIPHY media id from /media/<id>/giphy.gif style URLs. */
const GIPHY_MEDIA_RE = /\/media\/([A-Za-z0-9]+)\//i;

/**
 * Detects whether a pasted/typed string is a direct URL to a GIF, image or
 * video we can embed. Returns the kind + canonical URL, or null.
 */
export function detectMediaUrl(value: string): { url: string; kind: MediaKind } | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > 2048) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  const path = trimmed.split('#')[0];
  if (VIDEO_EXT_RE.test(path)) return { url: trimmed, kind: 'video' };
  if (IMAGE_EXT_RE.test(path)) {
    const kind: MediaKind = GIF_EXT_RE.test(path) ? 'gif' : 'image';
    return { url: trimmed, kind };
  }
  if (KNOWN_GIF_PROVIDER_RE.test(trimmed)) return { url: trimmed, kind: 'gif' };
  return null;
}

/** True when a string looks like a direct image/GIF/video URL we can embed. */
export function isGifUrl(value: string): boolean {
  return detectMediaUrl(value) !== null;
}

/** Trims/canonicalizes a pasted media URL, or null if not a media URL. */
export function normalizeGifUrl(value: string): string | null {
  const detected = detectMediaUrl(value);
  return detected ? detected.url : null;
}

/** Chooses the message type + payload to send for a raw input string. */
export function classifyOutgoingMessage(
  input: string,
  explicitMediaUrl?: string | null
): { content: string; messageType: MessageType; mediaUrl: string | null } {
  if (explicitMediaUrl) {
    return { content: '', messageType: 'gif', mediaUrl: explicitMediaUrl };
  }
  const detected = detectMediaUrl(input);
  if (detected) {
    return { content: '', messageType: detected.kind, mediaUrl: detected.url };
  }
  return { content: input.trim(), messageType: 'text', mediaUrl: null };
}

/**
 * Resolves the embeddable media for a message (if any). For `gif`/`image`/
 * `video` messages the stored media URL wins; pasted text links are detected.
 */
export function mediaSourceOf(message: DmMessage): { url: string; kind: MediaKind } | null {
  if (message.messageType === 'text') {
    const detected = detectMediaUrl(message.mediaUrl || message.content);
    return detected ? { url: detected.url, kind: detected.kind } : null;
  }
  if ((message.messageType === 'gif' || message.messageType === 'image' || message.messageType === 'video') && message.mediaUrl) {
    return { url: message.mediaUrl, kind: message.messageType };
  }
  return null;
}

/**
 * Stable favorite key for a media URL: the GIPHY media id when the URL is a
 * GIPHY asset (so favoriting a sent gif matches picker favorites), else the
 * URL itself.
 */
export function gifKeyOfUrl(url: string): string {
  const match = url.split('#')[0].match(GIPHY_MEDIA_RE);
  return (match && match[1]) || url;
}

/** Normalizes a raw reaction bucket into a typed one. */
export function toDmReaction(raw: any): DmReaction {
  return {
    emoji: String(raw?.emoji ?? ''),
    count: Number(raw?.count ?? (Array.isArray(raw?.userIds) ? raw.userIds.length : 0)),
    userIds: Array.isArray(raw?.userIds) ? raw.userIds.map(String) : []
  };
}

/** Renders a server row (any shape) into a typed DM message. */
export function toDmMessage(raw: any): DmMessage {
  const rawType = (raw?.messageType ?? raw?.message_type ?? 'text') as MessageType;
  const messageType: MessageType =
    rawType === 'gif' || rawType === 'image' || rawType === 'video' || rawType === 'system' ? rawType : 'text';
  return {
    id: String(raw?.id ?? ''),
    conversationId: String(raw?.conversationId ?? raw?.conversation_id ?? ''),
    senderId: String(raw?.senderId ?? raw?.sender_id ?? ''),
    content: String(raw?.content ?? ''),
    messageType,
    mediaUrl: (raw?.mediaUrl ?? raw?.media_url ?? null) || null,
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? new Date().toISOString()),
    editedAt: raw?.editedAt ?? raw?.edited_at ?? null,
    deletedAt: raw?.deletedAt ?? raw?.deleted_at ?? null,
    replyToId: (raw?.replyToId ?? raw?.reply_to_id ?? null) || null,
    reactions: Array.isArray(raw?.reactions) ? raw.reactions.map(toDmReaction) : undefined
  };
}

/** Merges message lists, dedupes by id and sorts oldest → newest. */
export function mergeMessageLists(lists: Array<DmMessage[] | null | undefined>): DmMessage[] {
  const seen = new Set<string>();
  const out: DmMessage[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const msg of list) {
      if (!msg || !msg.id || seen.has(msg.id)) continue;
      seen.add(msg.id);
      out.push(msg);
    }
  }
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

/** True when a message belongs to the current user. */
export function isOwnMessage(msg: DmMessage, myUserId: string | null | undefined): boolean {
  return !!myUserId && msg.senderId === myUserId;
}

export function formatMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatJoinDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function formatDayDivider(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as any)?.error || `Request failed: ${res.status}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return body as T;
}

export async function listConversations(token: string): Promise<DmConversationSummary[]> {
  const data = await request<{ success: boolean; conversations: DmConversationSummary[] }>(
    '/api/dm/conversations',
    { method: 'GET' },
    token
  );
  return data.conversations ?? [];
}

export async function createConversation(token: string, userId: string): Promise<DmConversationSummary> {
  const data = await request<{ success: boolean; conversation: DmConversationSummary }>(
    '/api/dm/conversations',
    { method: 'POST', body: JSON.stringify({ userId }) },
    token
  );
  return data.conversation;
}

export async function fetchMessages(
  token: string,
  conversationId: string,
  opts: { before?: string; limit?: number } = {}
): Promise<DmMessage[]> {
  const params = new URLSearchParams();
  if (opts.before) params.set('before', opts.before);
  params.set('limit', String(opts.limit ?? 50));
  const data = await request<{ success: boolean; messages: DmMessage[] }>(
    `/api/dm/conversations/${conversationId}/messages?${params}`,
    { method: 'GET' },
    token
  );
  return data.messages ?? [];
}

export async function sendMessageRequest(
  token: string,
  conversationId: string,
  payload: { content: string; messageType: MessageType; mediaUrl?: string | null; replyToId?: string | null }
): Promise<DmMessage> {
  const data = await request<{ success: boolean; message: DmMessage }>(
    `/api/dm/conversations/${conversationId}/messages`,
    { method: 'POST', body: JSON.stringify(payload) },
    token
  );
  return data.message;
}

/** Edits a text message owned by the current user. */
export async function updateMessageRequest(token: string, conversationId: string, messageId: string, content: string): Promise<DmMessage> {
  const data = await request<{ success: boolean; message: DmMessage }>(
    `/api/dm/conversations/${conversationId}/messages`,
    { method: 'PATCH', body: JSON.stringify({ messageId, content }) },
    token
  );
  return data.message;
}

/** Deletes a message owned by the current user. */
export async function deleteMessageRequest(token: string, conversationId: string, messageId: string): Promise<void> {
  await request<{ success: boolean }>(
    `/api/dm/conversations/${conversationId}/messages`,
    { method: 'DELETE', body: JSON.stringify({ messageId }) },
    token
  );
}

/** Toggles the current user's emoji reaction on a message. */
export async function toggleReactionRequest(token: string, messageId: string, emoji: string): Promise<ReactionToggleResult> {
  const data = await request<{ success: boolean; action: 'add' | 'remove'; reactions: DmReaction[] }>(
    '/api/dm/reactions',
    { method: 'POST', body: JSON.stringify({ messageId, emoji }) },
    token
  );
  return { action: data.action, emoji, reactions: data.reactions ?? [] };
}

export async function markConversationRead(token: string, conversationId: string): Promise<void> {
  await request<{ success: boolean }>(
    `/api/dm/conversations/${conversationId}/read`,
    { method: 'POST', body: JSON.stringify({}) },
    token
  );
}

export async function fetchUnread(token: string): Promise<number> {
  const data = await request<{ success: boolean; totalUnread: number }>(
    '/api/dm/unread',
    { method: 'GET' },
    token
  );
  return data.totalUnread ?? 0;
}

export async function searchUsers(token: string, query: string): Promise<DmUserLite[]> {
  const data = await request<{ success: boolean; users: DmUserLite[] }>(
    `/api/dm/search?q=${encodeURIComponent(query)}`,
    { method: 'GET' },
    token
  );
  return data.users ?? [];
}

export async function fetchMyPresence(token: string): Promise<UserPresence> {
  const data = await request<{ success: boolean; presence: UserPresence }>(
    '/api/dm/presence',
    { method: 'GET' },
    token
  );
  return data.presence;
}

export async function setMyPresenceRequest(
  token: string,
  status: PresenceStatus,
  customStatus?: string | null
): Promise<UserPresence> {
  const data = await request<{ success: boolean; presence: UserPresence }>(
    '/api/dm/presence',
    { method: 'POST', body: JSON.stringify({ status, customStatus: customStatus ?? null }) },
    token
  );
  return data.presence;
}

export async function heartbeatPresenceRequest(token: string): Promise<void> {
  await request<{ success: boolean }>(
    '/api/dm/presence/heartbeat',
    { method: 'POST' },
    token
  );
}

export async function fetchPresenceBatch(token: string, userIds: string[]): Promise<Record<string, UserPresence>> {
  const data = await request<{ success: boolean; presence: Record<string, UserPresence> }>(
    `/api/dm/presence/batch?userIds=${encodeURIComponent(userIds.join(','))}`,
    { method: 'GET' },
    token
  );
  return data.presence ?? {};
}

export interface CreateCallResult {
  joined: boolean;
  call: CallSession;
}

export async function createCallRequest(
  token: string,
  conversationId: string,
  calleeId: string,
  callType: CallType
): Promise<CreateCallResult> {
  const data = await request<{ success: boolean; joined?: boolean; call: CallSession }>(
    '/api/dm/calls',
    { method: 'POST', body: JSON.stringify({ conversationId, calleeId, callType }) },
    token
  );
  return { joined: !!data.joined, call: data.call };
}

export async function fetchPendingCall(token: string): Promise<CallSession | null> {
  const data = await request<{ success: boolean; call: CallSession | null }>(
    '/api/dm/calls/pending',
    { method: 'GET' },
    token
  );
  return data.call ?? null;
}

export interface CallStatusResult {
  call: CallSession;
  systemMessage?: DmMessage | null;
}

export async function updateCallStatusRequest(token: string, callId: string, status: CallStatus): Promise<CallStatusResult> {
  const data = await request<{ success: boolean; call: CallSession; systemMessage?: any }>(
    `/api/dm/calls/${callId}/status`,
    { method: 'POST', body: JSON.stringify({ status }) },
    token
  );
  const result: CallStatusResult = { call: data.call, systemMessage: data.systemMessage ? toDmMessage(data.systemMessage) : null };
  return result;
}

export async function fetchUserProfileRequest(token: string, userId: string): Promise<DmUserProfile> {
  const data = await request<{ success: boolean; profile: DmUserProfile }>(
    `/api/dm/users/${userId}/profile`,
    { method: 'GET' },
    token
  );
  return data.profile;
}

export interface GifItem {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
  title?: string;
}

export interface GifSearchResult {
  items: GifItem[];
  source: 'giphy' | 'tenor' | 'none';
  keyConfigured: boolean;
}

export async function searchGifs(token: string, query: string): Promise<GifSearchResult> {
  const data = await request<{ success: boolean; items?: GifItem[]; source?: string; keyConfigured?: boolean }>(
    `/api/dm/gif-search?q=${encodeURIComponent(query)}`,
    { method: 'GET' },
    token
  );
  return {
    items: data.items ?? [],
    source: data.source === 'tenor' ? 'tenor' : data.source === 'none' ? 'none' : 'giphy',
    keyConfigured: data.keyConfigured ?? true
  };
}

export async function listGifFavorites(token: string): Promise<GifFavorite[]> {
  const data = await request<{ success: boolean; favorites: GifFavorite[] }>(
    '/api/dm/gif-favorites',
    { method: 'GET' },
    token
  );
  return data.favorites ?? [];
}

export interface GifFavoriteInput {
  gifId: string;
  url: string;
  preview?: string;
  width?: number;
  height?: number;
  title?: string;
}

export async function addGifFavorite(token: string, item: GifFavoriteInput): Promise<GifFavorite> {
  const data = await request<{ success: boolean; favorite: GifFavorite }>(
    '/api/dm/gif-favorites',
    { method: 'POST', body: JSON.stringify(item) },
    token
  );
  return data.favorite;
}

export async function removeGifFavorite(token: string, gifId: string): Promise<void> {
  await request<{ success: boolean }>(
    '/api/dm/gif-favorites',
    { method: 'DELETE', body: JSON.stringify({ gifId }) },
    token
  );
}

export async function fetchDmConfig(): Promise<{ supabaseUrl: string; supabaseAnonKey: string; isConfigured: boolean }> {
  const data = await request<{ supabaseUrl: string; supabaseAnonKey: string; isConfigured: boolean }>(
    '/api/dm/config',
    { method: 'GET' }
  );
  return data;
}
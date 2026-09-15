// Shared types for the Discord-clone DM, presence & calling system.
// Used by both the server API routes (src/routes/api/dm/*) and the client
// library (src/lib/dm/*).

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

export type MessageType = 'text' | 'gif' | 'image' | 'video' | 'system';

export type CallType = 'voice' | 'video' | 'screen';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'declined' | 'missed' | 'canceled' | 'busy';

export interface DmUserLite {
  id: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  presenceStatus?: PresenceStatus;
  customStatus?: string;
}

/** A single emoji reaction bucket on a message (mirrors the DB aggregation). */
export interface DmReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface DmMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  mediaUrl?: string | null;
  createdAt: string;
  /** Set when the sender edited the message; renders an "(edited)" marker. */
  editedAt?: string | null;
  /** Set when the sender deleted the message; renders "(deleted message)". */
  deletedAt?: string | null;
  /** Id of the message this one replies to, if any. */
  replyToId?: string | null;
  /** Per-emoji reaction buckets, empty when unreacted. */
  reactions?: DmReaction[];
}

export interface DmConversationSummary {
  id: string;
  type: 'dm';
  createdAt: string;
  updatedAt: string;
  lastReadAt?: string | null;
  unreadCount?: number;
  lastMessage?: DmMessage | null;
  otherUser: DmUserLite;
}

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  customStatus?: string | null;
  lastSeenAt: string;
}

export interface CallSession {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  status: CallStatus;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
}

export interface DmUserProfile {
  id: string;
  username: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
  stats: {
    coins: number;
    bondLevel: number;
    defenseHighWave: number;
    totalVictories: number;
    goblinsDefeated: number;
  };
  waifu: {
    name: string;
    personality: string;
    appearance: {
      outfit: string;
      accessory: string;
      hairstyle: string;
      avatarFrame: string;
      hairColor: string;
      eyeColor: string;
      skinTone: string;
      avatarMode: 'svg' | 'custom';
    };
  };
}

/** A saved favorite GIF (mirrors the `gif_favorites` table row). */
export interface GifFavorite {
  id: string;
  gifId: string;
  url: string;
  preview: string;
  width: number;
  height: number;
  title: string;
  provider: string;
  createdAt: string;
}

/** Payload broadcast over Supabase Realtime when a new message lands. */
export interface DmMessageBroadcast {
  kind: 'dm-message';
  conversationId: string;
  message: DmMessage;
  senderName: string;
  senderAvatar?: string;
}

/** Payload broadcast over Supabase Realtime when a call is offered. */
export interface CallOfferBroadcast {
  kind: 'call-offer';
  call: CallSession;
  callerName: string;
  offer?: RTCSessionDescriptionInit;
}

export interface CallSignalPayload {
  kind: 'call-signal';
  callId: string;
  conversationId: string;
  type: 'offer' | 'answer' | 'ice';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface TypingBroadcast {
  kind: 'typing';
  conversationId: string;
  userId: string;
  userName: string;
  at: number;
}

/** Payload broadcast over Supabase Realtime when someone toggles a reaction. */
export interface ReactionBroadcast {
  kind: 'dm-reaction';
  conversationId: string;
  messageId: string;
  emoji: string;
  action: 'add' | 'remove';
  userId: string;
  userName: string;
  reactions: DmReaction[];
}

/** Result of the react toggle RPC. */
export interface ReactionToggleResult {
  action: 'add' | 'remove';
  emoji: string;
  reactions: DmReaction[];
}
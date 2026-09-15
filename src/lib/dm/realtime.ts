import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type {
  CallOfferBroadcast,
  CallSignalPayload,
  DmMessageBroadcast,
  PresenceStatus,
  ReactionBroadcast,
  TypingBroadcast
} from './types';
import { isVisiblePresence } from './presence';

// ---------------------------------------------------------------------------
// Realtime manager
//
// Layered on top of Supabase Realtime broadcast + presence channels. These
// channels are open to anonymous clients (no RLS), which is exactly what we
// need because the app authenticates with its own HMAC sessions, not Supabase
// JWTs. The database (via RPCs) remains the source of truth; realtime only
// delivers the "edge" events so the UI can update instantly.
//
// Channel layout:
//   - presence        : shared channel, every visible user tracks one entry.
//   - dm-<convId>     : one per conversation, joined while it is open (messages,
//                       typing, and call signalling ride this channel).
//   - dm-calls-<uid>  : per-user channel that always stays subscribed, so a
//                       user receives incoming call offers even when they are
//                       not looking at that conversation.
// ---------------------------------------------------------------------------

export interface RealtimePresencePayload {
  userId: string;
  username: string;
  avatar?: string;
  status: PresenceStatus;
  customStatus?: string;
  at: number;
}

export interface DmRealtimeHandlers {
  onMessage(broadcast: DmMessageBroadcast): void;
  onTyping(broadcast: TypingBroadcast): void;
  onReaction(broadcast: ReactionBroadcast): void;
  onCallSignal(signal: CallSignalPayload): void;
  onIncomingCall(broadcast: CallOfferBroadcast): void;
  onCallCancel(broadcast: CallOfferBroadcast): void;
  onPresenceChange(presence: Record<string, RealtimePresencePayload>): void;
}

export interface DmRealtimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const PRESENCE_CHANNEL = 'waifu-space-dm-presence';

// The typed RealtimeChannel.on() has no presence-specific overload that this
// TS version matches reliably, so presence listeners are attached through a
// small structural facade that resolves to the real overloads downstream.
type PresenceBindable = {
  on(
    event: 'presence',
    filter: { event: 'sync' | 'join' | 'leave' },
    callback: (ctx: any, presence: any) => void
  ): RealtimeChannel;
};

export class DmRealtime {
  private client: SupabaseClient | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private incomingChannel: RealtimeChannel | null = null;
  private convChannels = new Map<string, RealtimeChannel>();
  private handlers: DmRealtimeHandlers;
  private config: DmRealtimeConfig;
  private connected = false;
  private myUserId: string | null = null;
  private myPresence: RealtimePresencePayload | null = null;
  private presenceMap: Record<string, RealtimePresencePayload> = {};

  constructor(config: DmRealtimeConfig, handlers: DmRealtimeHandlers) {
    this.config = config;
    this.handlers = handlers;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  getPresence(): Record<string, RealtimePresencePayload> {
    return { ...this.presenceMap };
  }

  private makeClient(): SupabaseClient {
    return createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
  }

  private handlePresenceState(): void {
    if (!this.presenceChannel) return;
    const next: Record<string, RealtimePresencePayload> = {};
    const state = this.presenceChannel.presenceState() as Record<string, Array<{ payload: RealtimePresencePayload }>>;
    for (const key of Object.keys(state)) {
      for (const entry of state[key] ?? []) {
        const payload = entry?.payload;
        if (payload?.userId) next[payload.userId] = payload;
      }
    }
    this.presenceMap = next;
    this.handlers.onPresenceChange(this.getPresence());
  }

  private async handlePresenceBroadcast(channel: RealtimeChannel, payload: RealtimePresencePayload): Promise<void> {
    if (!payload?.userId) return;
    const { userId } = payload;
    const state = (channel.presenceState() as Record<string, Array<{ payload: RealtimePresencePayload }>>)[userId] ?? [];
    // A user is present only while they have an active tracked presence.
    const current = state.map(e => e?.payload).find(p => p?.userId === userId);
    return this.applyPresenceEntry(userId, current ?? null);
  }

  private async applyPresenceEntry(userId: string, payload: RealtimePresencePayload | null): Promise<void> {
    if (payload && isVisiblePresence(payload.status)) {
      this.presenceMap[userId] = payload;
    } else {
      delete this.presenceMap[userId];
    }
    this.handlers.onPresenceChange(this.getPresence());
  }

  /** Connects the shared presence + personal incoming-call channels. */
  async connect(user: { id: string; username: string; avatar?: string }): Promise<void> {
    this.myUserId = user.id;
    this.client = this.makeClient();

    this.presenceChannel = this.client.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } }
    });

    const presence = this.presenceChannel as unknown as PresenceBindable;
    presence.on('presence', { event: 'sync' }, () => this.handlePresenceState());
    presence.on('presence', { event: 'join' }, (_ctx, presencePayload) => {
      const payload = presencePayload as RealtimePresencePayload | undefined;
      if (payload?.userId) {
        void this.handlePresenceBroadcast(this.presenceChannel!, payload);
      }
    });
    presence.on('presence', { event: 'leave' }, (_ctx, presencePayload) => {
      const payload = presencePayload as RealtimePresencePayload | undefined;
      if (payload?.userId) {
        void this.applyPresenceEntry(payload.userId, null);
      }
    });
    this.presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.presenceMap = {};
          this.handlePresenceState();
          if (this.myPresence && isVisiblePresence(this.myPresence.status)) {
            await this.trackPresence(this.myPresence);
          }
        }
      });

    this.incomingChannel = this.client.channel(`dm-calls-${user.id}`);
    this.incomingChannel
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        this.handlers.onIncomingCall(payload as CallOfferBroadcast);
      })
      .on('broadcast', { event: 'call-cancel' }, ({ payload }) => {
        this.handlers.onCallCancel(payload as CallOfferBroadcast);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (status === 'SUBSCRIBED') this.connected = true;
        }
      });
  }

  /** Tracks the current user on the shared presence channel (visible statuses only). */
  async trackPresence(payload: RealtimePresencePayload): Promise<void> {
    this.myPresence = payload;
    if (!this.presenceChannel) return;
    try {
      if (isVisiblePresence(payload.status)) {
        await this.presenceChannel.track(payload);
      } else {
        await this.presenceChannel.untrack();
      }
    } catch {
      // Realtime is best-effort; presence updates also round-trip through the DB.
    }
  }

  /** Joins a conversation channel to receive message/typing/call events. */
  async subscribeConversation(conversationId: string): Promise<void> {
    if (!this.client || this.convChannels.has(conversationId) || !this.myUserId) return;
    const chan = this.client.channel(`dm-${conversationId}`);
    chan
      .on('broadcast', { event: 'dm-message' }, ({ payload }) => this.handlers.onMessage(payload as DmMessageBroadcast))
      .on('broadcast', { event: 'typing' }, ({ payload }) => this.handlers.onTyping(payload as TypingBroadcast))
      .on('broadcast', { event: 'dm-reaction' }, ({ payload }) => this.handlers.onReaction(payload as ReactionBroadcast))
      .on('broadcast', { event: 'call-signal' }, ({ payload }) => this.handlers.onCallSignal(payload as CallSignalPayload))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Channel is volatile; the conv channel uses default settings.
        }
      });
    this.convChannels.set(conversationId, chan);
  }

  async unsubscribeConversation(conversationId: string): Promise<void> {
    const chan = this.convChannels.get(conversationId);
    if (!chan) return;
    this.convChannels.delete(conversationId);
    if (this.client) await this.client.removeChannel(chan);
  }

  async sendMessage(broadcast: DmMessageBroadcast): Promise<void> {
    await this.broadcast(`dm-${broadcast.conversationId}`, 'dm-message', broadcast);
  }

  async sendTyping(payload: TypingBroadcast): Promise<void> {
    await this.broadcast(`dm-${payload.conversationId}`, 'typing', payload);
  }

  async sendReaction(payload: ReactionBroadcast): Promise<void> {
    await this.broadcast(`dm-${payload.conversationId}`, 'dm-reaction', payload);
  }

  async sendCallSignal(signal: CallSignalPayload): Promise<void> {
    await this.broadcast(`dm-${signal.conversationId}`, 'call-signal', signal);
  }

  async sendIncomingCallOffer(broadcast: CallOfferBroadcast): Promise<void> {
    await this.broadcast(`dm-calls-${broadcast.call.calleeId}`, 'call-offer', broadcast);
  }

  async sendCallCancel(userId: string, broadcast: CallOfferBroadcast): Promise<void> {
    await this.broadcast(`dm-calls-${userId}`, 'call-cancel', broadcast);
  }

  private async broadcast(channelName: string, event: string, payload: unknown): Promise<void> {
    const client = this.client;
    if (!client) return;
    try {
      const chan = client.channel(channelName);
      await chan.subscribe();
      await chan.send({ type: 'broadcast', event, payload });
      await client.removeChannel(chan);
    } catch {
      // Realtime is best-effort for the "edge" notifications; DB is source of truth.
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.myUserId = null;
    this.myPresence = null;
    this.convChannels.clear();
    this.presenceMap = {};
    if (!this.client) return;
    try {
      await this.client.removeChannel(this.presenceChannel!);
    } catch {
      // ignore
    }
    try {
      await this.client.removeChannel(this.incomingChannel!);
    } catch {
      // ignore
    }
    this.presenceChannel = null;
    this.incomingChannel = null;
    this.client = null;
  }
}
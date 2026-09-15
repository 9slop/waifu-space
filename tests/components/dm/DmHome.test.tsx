import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@solidjs/testing-library';
import { DmHome } from '../../../src/components/dm/DmHome';
import { initDm } from '../../../src/lib/dm/store';
import { resetForDmTests, stubFetch, flush } from '../../dm-helpers';
import type { DmMessageBroadcast } from '../../../src/lib/dm/types';

const { FakeRealtime } = vi.hoisted(() => {
  class FakeRealtime {
    static instances: any[] = [];
    handlers: any = null;
    presences: any[] = [];
    constructor(_config: any, handlers: any) {
      this.handlers = handlers;
      FakeRealtime.instances.push(this);
    }
    async connect() { return undefined; }
    async disconnect() { return undefined; }
    async trackPresence(payload: any) { this.presences.push(payload); }
    async subscribeConversation() { return undefined; }
    async sendMessage() { return undefined; }
    async sendTyping() { return undefined; }
    async sendCallSignal() { return undefined; }
    async sendIncomingCallOffer() { return undefined; }
    async sendCallCancel() { return undefined; }
  }
  return { FakeRealtime };
});

vi.mock('../../../src/lib/dm/realtime', () => ({
  DmRealtime: FakeRealtime
}));

const CONV = {
  id: 'c1',
  type: 'dm',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
  lastReadAt: null,
  unreadCount: 1,
  lastMessage: { id: 'm1', conversationId: 'c1', senderId: 'u-bob', content: 'first', messageType: 'text', createdAt: '2025-01-02T00:00:00.000Z' },
  otherUser: { id: 'u-bob', username: 'Bob', presenceStatus: 'online' }
};

function bootRoutes() {
  return stubFetch({
    '/api/dm/config': () => ({ body: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon', isConfigured: true } }),
    '/api/dm/conversations/c1/messages': () => ({
      body: { success: true, messages: [{ id: 'm1', conversationId: 'c1', senderId: 'u-bob', content: 'first', messageType: 'text', createdAt: '2025-01-02T00:00:00.000Z' }] }
    }),
    '/api/dm/conversations': () => ({ body: { success: true, conversations: [CONV] } }),
    '/api/dm/presence': () => ({ body: { success: true, presence: { userId: 'u-me', status: 'online', lastSeenAt: '2025-01-02T00:00:00.000Z' } } }),
    '/api/dm/unread': () => ({ body: { success: true, totalUnread: 1 } })
  });
}

describe('DmHome', () => {
  beforeEach(() => {
    cleanup();
    FakeRealtime.instances = [];
    resetForDmTests();
  });

  it('renders the sidebar + empty chat once the global DM runtime is booted', async () => {
    const restore = bootRoutes();
    await initDm();
    const { container } = render(() => <DmHome />);
    expect(container.querySelector('[data-testid="dm-sidebar"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-conv-c1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-chat-empty"]')).toBeInTheDocument();
    restore();
  });

  it('opens a conversation and feeds realtime messages into the list', async () => {
    const restore = bootRoutes();
    await initDm();
    const { container } = render(() => <DmHome />);
    fireEvent.click(container.querySelector('[data-testid="dm-conv-c1"]')!);
    await waitFor(() => expect(container.querySelector('.dm-msg-content')).toHaveTextContent('first'));

    const rt = FakeRealtime.instances[0];
    expect(rt).toBeDefined();
    const broadcast: DmMessageBroadcast = {
      kind: 'dm-message',
      conversationId: 'c1',
      message: { id: 'm2', conversationId: 'c1', senderId: 'u-bob', content: 'newest', messageType: 'text', createdAt: '2025-01-02T00:01:00.000Z' },
      senderName: 'Bob'
    };
    rt.handlers.onMessage(broadcast);
    await flush();
    expect(container.textContent).toContain('newest');
    restore();
  });

  it('tracks presence on the realtime channel after boot', async () => {
    const restore = bootRoutes();
    await initDm();
    const { container } = render(() => <DmHome />);
    await flush();
    const rt = FakeRealtime.instances[FakeRealtime.instances.length - 1];
    expect(rt.presences.length).toBe(1);
    expect(rt.presences[0].userId).toBe('u-me');
    restore();
  });

  it('shows an error state when the DM boot fails', async () => {
    const restore = stubFetch({
      '/api/dm/config': () => ({ body: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon', isConfigured: true } }),
      '/api/dm/conversations': () => ({ body: { success: false }, status: 500 })
    });
    await initDm();
    const { container } = render(() => <DmHome />);
    expect(container.querySelector('.dm-boot-error')).toBeInTheDocument();
    restore();
  });

  it('opens the peer profile popover from the chat header identity', async () => {
    const restore = bootRoutes();
    await initDm();
    const { container } = render(() => <DmHome />);
    fireEvent.click(container.querySelector('[data-testid="dm-conv-c1"]')!);
    await waitFor(() => expect(container.querySelector('[data-testid="dm-chat-identity"]')).toBeInTheDocument());

    const profileRestore = stubFetch({
      '/api/dm/users/u-bob/profile': () => ({
        body: { success: true, profile: { id: 'u-bob', username: 'Bob', avatarUrl: null, bio: 'bob bio', createdAt: '2025-01-01T00:00:00.000Z', lastSeenAt: '2025-01-02T00:00:00.000Z' } }
      })
    });
    fireEvent.click(container.querySelector('[data-testid="dm-chat-identity"]')!);
    expect(container.querySelector('[data-testid="dm-profile-popover"]')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('[data-testid="dm-popover-bio"]')?.textContent).toContain('bob bio'));
    profileRestore();
    restore();
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { DmSidebar } from '../../../src/components/dm/DmSidebar';
import { dmState, setDmState } from '../../../src/lib/dm/store';
import { resetForDmTests, stubFetch, flush } from '../../dm-helpers';

const bob = { id: 'u-bob', username: 'Bob', avatarUrl: 'https://img/bob.png' };
const carol = { id: 'u-carol', username: 'Carol' };

function seed() {
  setDmState('conversations', [
    {
      id: 'c1',
      type: 'dm',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      lastReadAt: '2025-01-02T00:00:00.000Z',
      unreadCount: 0,
      lastMessage: { id: 'm1', conversationId: 'c1', senderId: 'u-bob', content: 'hey', messageType: 'text', createdAt: '2025-01-02T00:00:00.000Z' },
      otherUser: { ...bob, presenceStatus: 'online' }
    },
    {
      id: 'c2',
      type: 'dm',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      lastReadAt: '2025-01-01T00:00:00.000Z',
      unreadCount: 2,
      lastMessage: null,
      otherUser: { ...carol, presenceStatus: 'offline' }
    }
  ]);
  setDmState('presence', {
    'u-bob': { userId: 'u-bob', status: 'online', lastSeenAt: '2025-01-02T00:00:00.000Z' },
    'u-carol': { userId: 'u-carol', status: 'offline', lastSeenAt: '2025-01-01T00:00:00.000Z' }
  });
  setDmState('myPresence', { userId: 'u-me', status: 'online', lastSeenAt: '2025-01-01T00:00:00.000Z' });
}

describe('DmSidebar', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('shows the logged-in user name and conversation rows', () => {
    seed();
    const { container } = render(() => <DmSidebar />);
    expect(container.textContent).toContain('me');
    expect(container.querySelector('[data-testid="dm-conv-c1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-conv-c2"]')).toBeInTheDocument();
  });

  it('sorts online conversations first', () => {
    seed();
    const { container } = render(() => <DmSidebar />);
    const rows = Array.from(container.querySelectorAll('.dm-conv-row'));
    expect(rows[0]).toHaveAttribute('data-testid', 'dm-conv-c1');
    expect(rows[1]).toHaveAttribute('data-testid', 'dm-conv-c2');
  });

  it('shows unread badges', () => {
    seed();
    const { container } = render(() => <DmSidebar />);
    expect(container.querySelector('[data-testid="dm-unread-c2"]')).toHaveTextContent('2');
    expect(container.querySelector('[data-testid="dm-unread-c1"]')).not.toBeInTheDocument();
  });

  it('searches users and opens a conversation', async () => {
    seed();
    let searchHit = false;
    const restore = stubFetch({
      '/api/dm/search': () => {
        searchHit = true;
        return { body: { success: true, users: [{ id: 'u-dave', username: 'Dave', presenceStatus: 'idle' }] } };
      },
      '/api/dm/conversations/c3/messages': () => ({ body: { success: true, messages: [] } }),
      '/api/dm/conversations': (url, init) => {
        if (init.method === 'POST') {
          return {
            body: {
              success: true,
              conversation: { id: 'c3', type: 'dm', createdAt: '2025-01-03T00:00:00.000Z', updatedAt: '2025-01-03T00:00:00.000Z', lastReadAt: null, unreadCount: 0, lastMessage: null, otherUser: { id: 'u-dave', username: 'Dave', presenceStatus: 'idle' } }
            }
          };
        }
        return { body: { success: true, conversations: [] } };
      },
      '/api/dm/unread': () => ({ body: { success: true, totalUnread: 0 } }),
      '/api/dm/presence': () => ({ body: { success: true, presence: {} } })
    });
    const { container } = render(() => <DmSidebar />);
    const input = container.querySelector('[data-testid="dm-search-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Da' } });
    await flush();
    expect(searchHit).toBe(true);
    const result = container.querySelector('[data-testid="dm-search-user-u-dave"]');
    expect(result).toBeInTheDocument();
    fireEvent.click(result!);
    await flush();
    expect(dmState.activeConversationId).toBe('c3');
    restore();
  });

  it('pins the user panel at the bottom of the sidebar', () => {
    seed();
    const { container } = render(() => <DmSidebar />);
    const sidebar = container.querySelector('.dm-sidebar')!;
    expect(sidebar.lastElementChild).toHaveClass('dm-user-panel');
  });

  it('opens the own profile popover from the pinned user panel', () => {
    seed();
    const restore = stubFetch({
      '/api/dm/users/u-me/profile': () => ({
        body: {
          success: true,
          profile: { id: 'u-me', username: 'me', avatarUrl: null, bio: 'myself', createdAt: '2025-01-01T00:00:00.000Z', lastSeenAt: '2025-01-01T00:00:00.000Z' }
        }
      })
    });
    const { container } = render(() => <DmSidebar />);
    fireEvent.click(container.querySelector('.dm-user-panel')!);
    expect(container.querySelector('[data-testid="dm-profile-popover"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-profile-name"]')).toHaveTextContent('me');
    restore();
  });

  it('does not open the own profile popover when selecting a status from the presence menu', async () => {
    seed();
    const restore = stubFetch({
      '/api/dm/presence': () => ({
        body: { success: true, presence: { userId: 'u-me', status: 'dnd', customStatus: null, lastSeenAt: '2025-01-01T00:00:00.000Z' } }
      })
    });
    const { container } = render(() => <DmSidebar />);
    fireEvent.click(container.querySelector('[data-testid="dm-status-menu-btn"]')!);
    expect(container.querySelector('[data-testid="dm-status-menu"]')).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-status-dnd"]')!);
    await flush();
    expect(container.querySelector('[data-testid="dm-profile-popover"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-status-menu"]')).not.toBeInTheDocument();
    expect(dmState.myPresence?.status).toBe('dnd');
    restore();
  });
});
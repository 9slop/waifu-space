import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { DmMessageList, scrollDmThreadToBottomIfNear } from '../../../src/components/dm/DmMessageList';
import { dmState, setDmState } from '../../../src/lib/dm/store';
import { resetForDmTests, flush } from '../../dm-helpers';
import type { DmMessage } from '../../../src/lib/dm/types';

const mk = (id: string, senderId: string, createdAt: string, content = 'hi'): DmMessage => ({
  id,
  conversationId: 'c1',
  senderId,
  content,
  messageType: 'text',
  createdAt
});

function seed(messages: DmMessage[]) {
  setDmState('conversations', [
    {
      id: 'c1',
      type: 'dm',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: '2025-01-02T00:00:00.000Z',
      lastReadAt: null,
      unreadCount: 0,
      lastMessage: null,
      otherUser: { id: 'u-bob', username: 'Bob', presenceStatus: 'online' }
    }
  ]);
  setDmState('activeConversationId', 'c1');
  setDmState('messages', { ...dmState.messages, c1: messages });
}

describe('DmMessageList', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('shows an empty-state message when there are no messages', () => {
    seed([]);
    const { container } = render(() => <DmMessageList />);
    expect(container.querySelector('.dm-no-messages')).toBeInTheDocument();
  });

  it('renders a day divider between different days', () => {
    seed([
      mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z'),
      mk('m2', 'u-bob', '2025-01-02T10:00:00.000Z')
    ]);
    const { container } = render(() => <DmMessageList />);
    expect(container.querySelectorAll('[data-testid="dm-day-divider"]').length).toBeGreaterThanOrEqual(2);
  });

  it('groups consecutive messages from the same author', () => {
    seed([
      mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z'),
      mk('m2', 'u-bob', '2025-01-01T10:01:00.000Z'),
      mk('m3', 'u-me', '2025-01-01T10:02:00.000Z')
    ]);
    const { container } = render(() => <DmMessageList />);
    const headers = container.querySelectorAll('.dm-msg-header');
    // m1 (header), m2 (continuation), m3 (header) -> 2 full headers
    expect(headers.length).toBe(2);
    expect(container.querySelectorAll('.dm-msg-cont').length).toBe(1);
  });

  it('shows a single avatar for a run of media messages', () => {
    const media = (id: string, createdAt: string): DmMessage => ({
      ...mk(id, 'u-bob', createdAt),
      messageType: 'gif',
      mediaUrl: 'https://media.tenor.com/foo.gif'
    });
    seed([
      media('m1', '2025-01-01T10:00:00.000Z'),
      media('m2', '2025-01-01T10:01:00.000Z'),
      media('m3', '2025-01-01T10:02:00.000Z')
    ]);
    const { container } = render(() => <DmMessageList />);
    expect(container.querySelectorAll('[data-testid="dm-avatar"]').length).toBe(1);
    expect(container.querySelectorAll('.dm-msg-cont').length).toBe(2);
  });

  it('renders a load-older button at the top while more history exists', () => {
    seed([mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z')]);
    setDmState('hasOlder', 'c1', true);
    const { container } = render(() => <DmMessageList />);
    const btn = container.querySelector('[data-testid="dm-load-older"]');
    expect(btn).toBeInTheDocument();
    // The button sits above the first message, not below the last one.
    const firstMsg = container.querySelector('.dm-msg, .dm-day-divider');
    expect(firstMsg).toBeTruthy();
    if (btn && firstMsg) {
      const btnRect = btn.compareDocumentPosition(firstMsg);
      expect(btnRect & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('hides the load-older button once scrolled away from the top', async () => {
    seed([mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z')]);
    setDmState('hasOlder', 'c1', true);
    const { container } = render(() => <DmMessageList />);
    const list = container.querySelector('[data-testid="dm-messages"]') as HTMLDivElement;
    expect(container.querySelector('[data-testid="dm-load-older"]')).toBeInTheDocument();
    list.scrollTop = 400;
    list.dispatchEvent(new Event('scroll', { bubbles: true }));
    await flush();
    expect(container.querySelector('[data-testid="dm-load-older"]')).not.toBeInTheDocument();
    // Scrolling back to the top brings it back.
    list.scrollTop = 0;
    list.dispatchEvent(new Event('scroll', { bubbles: true }));
    await flush();
    expect(container.querySelector('[data-testid="dm-load-older"]')).toBeInTheDocument();
  });
});

describe('DmMessageList auto-scroll (issue B)', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  const defineGeometry = (el: HTMLElement, scrollHeight: number, clientHeight = 200) => {
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  };

  it('snaps to the bottom when a conversation opens with messages', async () => {
    const { container } = render(() => <DmMessageList />);
    const list = container.querySelector('[data-testid="dm-messages"]') as HTMLDivElement;
    defineGeometry(list, 700);
    setDmState('activeConversationId', 'c1');
    setDmState('messages', { ...dmState.messages, c1: [mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z')] });
    await flush();
    expect(list.scrollTop).toBe(500);
  });

  it('stays pinned to the bottom as messages arrive while the reader is at the bottom', async () => {
    seed([mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z')]);
    const { container } = render(() => <DmMessageList />);
    const list = container.querySelector('[data-testid="dm-messages"]') as HTMLDivElement;
    defineGeometry(list, 700);
    list.scrollTop = 500;
    defineGeometry(list, 800);
    setDmState('messages', {
      ...dmState.messages,
      c1: [...dmState.messages.c1!, mk('m2', 'u-bob', '2025-01-01T10:01:00.000Z')]
    });
    await flush();
    expect(list.scrollTop).toBe(600);
  });

  it('does not yank the viewport when a new message lands while scrolled into history', async () => {
    seed([mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z'), mk('m2', 'u-bob', '2025-01-01T10:01:00.000Z')]);
    const { container } = render(() => <DmMessageList />);
    const list = container.querySelector('[data-testid="dm-messages"]') as HTMLDivElement;
    defineGeometry(list, 1000);
    list.scrollTop = 100;
    list.dispatchEvent(new Event('scroll'));
    defineGeometry(list, 1100);
    setDmState('messages', {
      ...dmState.messages,
      c1: [...dmState.messages.c1!, mk('m3', 'u-bob', '2025-01-01T10:02:00.000Z')]
    });
    await flush();
    expect(list.scrollTop).toBe(100);
  });

  it('scrolls to your own sent message even when scrolled into history', async () => {
    seed([mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z'), mk('m2', 'u-bob', '2025-01-01T10:01:00.000Z')]);
    const { container } = render(() => <DmMessageList />);
    const list = container.querySelector('[data-testid="dm-messages"]') as HTMLDivElement;
    defineGeometry(list, 1000);
    list.scrollTop = 0;
    defineGeometry(list, 1100);
    setDmState('messages', {
      ...dmState.messages,
      c1: [...dmState.messages.c1!, mk('m3', 'u-me', '2025-01-01T10:02:00.000Z')]
    });
    await flush();
    expect(list.scrollTop).toBe(900);
  });

  it('does not scroll when older history is prepended (load-more)', async () => {
    seed([mk('m1', 'u-bob', '2025-01-01T10:00:00.000Z'), mk('m2', 'u-bob', '2025-01-01T10:01:00.000Z')]);
    const { container } = render(() => <DmMessageList />);
    const list = container.querySelector('[data-testid="dm-messages"]') as HTMLDivElement;
    defineGeometry(list, 1000);
    list.scrollTop = 800;
    list.dispatchEvent(new Event('scroll'));
    defineGeometry(list, 1200);
    setDmState('messages', {
      ...dmState.messages,
      c1: [mk('m0', 'u-bob', '2024-12-31T23:00:00.000Z'), ...dmState.messages.c1!]
    });
    await flush();
    expect(list.scrollTop).toBe(800);
  });

  it('media that loads late still snaps shut within the send grace window', async () => {
    seed([mk('m1', 'u-me', '2025-01-01T10:00:00.000Z')]);
    const { container } = render(() => <DmMessageList />);
    const list = container.querySelector('[data-testid="dm-messages"]') as HTMLDivElement;
    defineGeometry(list, 700);
    setDmState('messages', {
      ...dmState.messages,
      c1: [...dmState.messages.c1!, { ...mk('m2', 'u-me', '2025-01-01T10:01:00.000Z'), messageType: 'gif', mediaUrl: 'https://media.tenor.com/x.gif' }]
    });
    await flush();
    expect(list.scrollTop).toBe(500);
    // The GIF row finished loading and grew the timeline below the previous
    // bottom; the onLoad handler runs while the grace window is still open.
    defineGeometry(list, 1100);
    scrollDmThreadToBottomIfNear();
    await flush();
    expect(list.scrollTop).toBe(900);
  });
});
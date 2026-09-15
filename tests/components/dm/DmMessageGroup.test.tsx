import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { DmMessageGroup, parseDmSystemContent } from '../../../src/components/dm/DmMessageGroup';
import { dmState, setDmState } from '../../../src/lib/dm/store';
import { resetForDmTests, stubFetch, flush } from '../../dm-helpers';
import type { DmMessage } from '../../../src/lib/dm/types';

const msg = (over: Partial<DmMessage>): DmMessage => ({
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u-bob',
  content: 'hello',
  messageType: 'text',
  createdAt: '2025-01-01T10:00:00.000Z',
  ...over
});

describe('DmMessageGroup', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('renders author + time when it heads a group', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({})} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    expect(container.querySelector('.dm-msg-header')).toBeInTheDocument();
    expect(container.querySelector('.dm-msg-author')).toHaveTextContent('Bob');
    expect(container.querySelector('.dm-msg-time')).toBeInTheDocument();
    const avatar = container.querySelector('[data-testid="dm-avatar"]');
    expect(avatar).toBeInTheDocument();
  });

  it('omits author + avatar for continuation rows', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({})} showAvatar={false} senderName="Bob" myUserId="u-me" />
    ));
    expect(container.querySelector('.dm-msg-cont')).toBeInTheDocument();
    expect(container.querySelector('.dm-msg-author')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-avatar"]')).not.toBeInTheDocument();
  });

  it('marks own messages', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({ senderId: 'u-me' })} showAvatar senderName="me" myUserId="u-me" />
    ));
    const row = container.querySelector('.dm-msg');
    expect(row).toHaveClass('dm-msg-own');
    expect(container.querySelector('.dm-msg-you')).not.toBeInTheDocument();
  });

  it('renders a gif message as an embedded image', () => {
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ messageType: 'gif', mediaUrl: 'https://media.tenor.com/foo.gif' })}
        showAvatar
        senderName="Bob"
        myUserId="u-me"
      />
    ));
    const img = container.querySelector('img.dm-msg-media');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://media.tenor.com/foo.gif');
  });

  it('renders plain text content with emoji-friendly rendering', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({ content: 'hi there' })} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    expect(container.querySelector('.dm-msg-content')).toHaveTextContent('hi there');
  });

  it('fires onAuthorClick for the avatar and the author name', () => {
    const clicks: string[] = [];
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({})}
        showAvatar
        senderName="Bob"
        myUserId="u-me"
        onAuthorClick={(senderId) => clicks.push(senderId)}
      />
    ));
    fireEvent.click(container.querySelector('.dm-msg-avatar-btn')!);
    fireEvent.click(container.querySelector('.dm-msg-author')!);
    expect(clicks).toEqual(['u-bob', 'u-bob']);
  });

  it('renders a video message as an embedded <video>', () => {
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ messageType: 'video', mediaUrl: 'https://example.com/clip.mp4' })}
        showAvatar
        senderName="Bob"
        myUserId="u-me"
      />
    ));
    const video = container.querySelector('video.dm-msg-media');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://example.com/clip.mp4');
  });

  it('marks a media message as favorited when it matches a saved favorite', () => {
    setDmState('gifFavorites', [
      { id: 'https://media.tenor.com/foo.gif', url: 'https://media.tenor.com/foo.gif', preview: 'https://media.tenor.com/foo.gif', width: 480, height: 270, title: null }
    ]);
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ messageType: 'gif', mediaUrl: 'https://media.tenor.com/foo.gif' })}
        showAvatar
        senderName="Bob"
        myUserId="u-me"
      />
    ));
    expect(container.querySelector('.dm-msg-fav-btn')).toHaveClass('favorited');
  });

  it('renders reaction pills and marks the user own reaction', () => {
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ reactions: [{ emoji: '👍', count: 2, userIds: ['u-bob', 'u-me'] }] })}
        showAvatar
        senderName="Bob"
        myUserId="u-me"
      />
    ));
    const pill = container.querySelector('.dm-reaction-btn')!;
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass('mine');
    expect(pill.querySelector('.dm-reaction-count')).toHaveTextContent('2');
  });

  it('toggles an existing reaction off (POST) and keeps the store authoritative', async () => {
    setDmState('activeConversationId', 'c1');
    const message = msg({ reactions: [{ emoji: '👍', count: 2, userIds: ['u-bob', 'u-me'] }] });
    setDmState('messages', 'c1', [message]);
    let posted: any = null;
    const restore = stubFetch({
      '/api/dm/reactions': (url, init) => {
        posted = JSON.parse(String(init.body));
        return {
          body: {
            success: true,
            messageId: 'm1',
            emoji: '👍',
            action: 'remove',
            reactions: [{ emoji: '👍', count: 1, userIds: ['u-bob'] }]
          }
        };
      }
    });
    const { container } = render(() => (
      <DmMessageGroup message={message} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    fireEvent.click(container.querySelector('.dm-reaction-btn')!);
    await flush();
    expect(posted).toEqual({ messageId: 'm1', emoji: '👍' });
    expect(dmState.messages.c1?.[0]?.reactions?.[0]).toMatchObject({ count: 1, userIds: ['u-bob'] });
    restore();
  });

  it('opens the full emoji picker from the + button and adds a reaction', async () => {
    setDmState('activeConversationId', 'c1');
    const message = msg({});
    setDmState('messages', 'c1', [message]);
    let posted: any = null;
    const restore = stubFetch({
      '/api/dm/reactions': (url, init) => {
        posted = JSON.parse(String(init.body));
        return {
          body: {
            success: true,
            messageId: 'm1',
            emoji: '😀',
            action: 'add',
            reactions: [{ emoji: '😀', count: 1, userIds: ['u-me'] }]
          }
        };
      }
    });
    const { container } = render(() => (
      <DmMessageGroup message={message} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    fireEvent.click(container.querySelector('[data-testid="dm-reaction-add"]')!);
    expect(container.querySelector('[data-testid="dm-emoji-picker"]')).toBeInTheDocument();
    const item = container.querySelector('[aria-label="😀"]');
    expect(item).not.toBeNull();
    fireEvent.click(item!);
    await flush();
    expect(posted).toEqual({ messageId: 'm1', emoji: '😀' });
    expect(dmState.messages.c1?.[0]?.reactions?.[0]).toMatchObject({ emoji: '😀', count: 1 });
    expect(container.querySelector('[data-testid="dm-emoji-picker"]')).not.toBeInTheDocument();
    restore();
  });

  it('toggles the full emoji picker directly from the + button, without a quick-reaction grid', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({})} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    fireEvent.click(container.querySelector('[data-testid="dm-reaction-add"]')!);
    expect(container.querySelector('[data-testid="dm-emoji-picker"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-reaction-quick"]')).not.toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-reaction-add"]')!);
    expect(container.querySelector('[data-testid="dm-emoji-picker"]')).not.toBeInTheDocument();
  });

  it('renders system messages centered with an icon, no avatar or reactions', () => {
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ messageType: 'system', content: '{"kind":"call-missed","callType":"voice"}' })}
        showAvatar
        senderName="Bob"
        myUserId="u-me"
      />
    ));
    expect(container.querySelector('[data-testid="dm-message-system"]')).toBeInTheDocument();
    expect(container.querySelector('.dm-system-text')).toHaveTextContent('Missed call');
    expect(container.querySelector('.dm-system-icon.missed')).toBeInTheDocument();
    expect(container.querySelector('.dm-msg-avatar')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-reactions-row"]')).not.toBeInTheDocument();
  });

  it('parseDmSystemContent handles a JSON payload and falls back to plain-kind text', () => {
    expect(parseDmSystemContent('{"kind":"call-started","callType":"video"}')).toEqual({ kind: 'call-started', callType: 'video' });
    expect(parseDmSystemContent('call-started')).toEqual({ kind: 'call-started' });
    expect(parseDmSystemContent('')).toEqual({ kind: '' });
  });

  it('opens a context menu on right-click with edit/delete only for own text messages', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({ senderId: 'u-me' })} showAvatar senderName="me" myUserId="u-me" />
    ));
    fireEvent.contextMenu(container.querySelector('.dm-msg')!);
    expect(container.querySelector('[data-testid="dm-msg-menu"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-msg-menu-reply"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-msg-menu-edit"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-msg-menu-delete"]')).toBeInTheDocument();
  });

  it('hides edit/delete when the message is not owned', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({ senderId: 'u-bob' })} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    fireEvent.contextMenu(container.querySelector('.dm-msg')!);
    expect(container.querySelector('[data-testid="dm-msg-menu"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-msg-menu-reply"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-msg-menu-edit"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-msg-menu-delete"]')).not.toBeInTheDocument();
  });

  it('start reply flow sets the reply target', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({ senderId: 'u-bob' })} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    fireEvent.contextMenu(container.querySelector('.dm-msg')!);
    fireEvent.click(container.querySelector('[data-testid="dm-msg-menu-reply"]')!);
    expect(dmState.replyingTo).toBe('m1');
  });

  it('edits an owned text message via context menu + inline editor', async () => {
    const message = msg({ senderId: 'u-me', content: 'old text' });
    const restore = stubFetch({
      '/api/dm/conversations/c1/messages': (url, init) => {
        if (init.method === 'PATCH') {
          const body = JSON.parse(String(init.body));
          expect(body).toEqual({ messageId: 'm1', content: 'new text' });
          return {
            body: {
              success: true,
              message: { ...message, content: 'new text', editedAt: '2025-01-01T11:00:00.000Z' }
            },
            status: 200
          };
        }
        return { body: { success: true, messages: [] } };
      }
    });
    setDmState('activeConversationId', 'c1');
    setDmState('messages', 'c1', [message]);
    const { container } = render(() => (
      <DmMessageGroup message={message} showAvatar senderName="me" myUserId="u-me" />
    ));
    fireEvent.contextMenu(container.querySelector('.dm-msg')!);
    fireEvent.click(container.querySelector('[data-testid="dm-msg-menu-edit"]')!);
    expect(container.querySelector('[data-testid="dm-msg-edit-input"]')).toBeInTheDocument();
    const input = container.querySelector('[data-testid="dm-msg-edit-input"]') as HTMLTextAreaElement;
    fireEvent.input(input, { target: { value: 'new text' } });
    fireEvent.click(container.querySelector('[data-testid="dm-msg-edit-save"]')!);
    await flush();
    expect(dmState.messages.c1?.[0]?.content).toBe('new text');
    expect(dmState.messages.c1?.[0]?.editedAt).toBe('2025-01-01T11:00:00.000Z');
    restore();
  });

  it('renders an edited marker when editedAt is set', () => {
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ senderId: 'u-me', content: 'edited msg', editedAt: '2025-01-01T11:00:00.000Z' })}
        showAvatar
        senderName="me"
        myUserId="u-me"
      />
    ));
    expect(container.querySelector('.dm-msg-edited')).toHaveTextContent('edited');
  });

  it('soft-deletes an owned message via the context menu', async () => {
    const message = msg({ senderId: 'u-me' });
    let deleted = false;
    const confirmStub = vi.fn(() => true);
    window.confirm = confirmStub as any;
    const restore = stubFetch({
      '/api/dm/conversations/c1/messages': (url, init) => {
        if (init.method === 'DELETE') {
          deleted = true;
          expect(JSON.parse(String(init.body))).toEqual({ messageId: 'm1' });
          return { body: { success: true }, status: 200 };
        }
        return { body: { success: true, messages: [] } };
      }
    });
    setDmState('activeConversationId', 'c1');
    setDmState('messages', 'c1', [message]);
    const { container } = render(() => (
      <DmMessageGroup message={message} showAvatar senderName="me" myUserId="u-me" />
    ));
    fireEvent.contextMenu(container.querySelector('.dm-msg')!);
    fireEvent.click(container.querySelector('[data-testid="dm-msg-menu-delete"]')!);
    await flush();
    expect(deleted).toBe(true);
    expect(dmState.messages.c1).toHaveLength(1);
    expect(dmState.messages.c1?.[0]?.deletedAt).toBeTruthy();
    expect(dmState.messages.c1?.[0]?.content).toBe('');
    delete (window as Partial<Window & { confirm: any }>).confirm;
    restore();
  });

  it('renders a deleted message as (deleted message) without media, reactions or edit menu', () => {
    setDmState('activeConversationId', 'c1');
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ senderId: 'u-me', deletedAt: '2025-01-01T12:00:00.000Z', content: 'secret', reactions: [{ emoji: '👍', count: 1, userIds: ['u-me'] }] })}
        showAvatar
        senderName="me"
        myUserId="u-me"
      />
    ));
    expect(container.querySelector('.dm-msg-deleted-text')).toHaveTextContent('(deleted message)');
    expect(container.querySelector('[data-testid="dm-reactions-row"]')).not.toBeInTheDocument();
    fireEvent.contextMenu(container.querySelector('.dm-msg')!);
    expect(container.querySelector('[data-testid="dm-msg-menu-edit"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-msg-menu-delete"]')).not.toBeInTheDocument();
  });

  it('shows (deleted message) in a reply quote when the target was deleted', () => {
    setDmState('activeConversationId', 'c1');
    setDmState('messages', 'c1', [
      { ...msg({ id: 'm0', senderId: 'u-bob', deletedAt: '2025-01-01T12:00:00.000Z', content: '' }) },
      { ...msg({ id: 'm1', content: 'reply!', replyToId: 'm0' }) }
    ]);
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ id: 'm1', content: 'reply!', replyToId: 'm0' })}
        showAvatar
        senderName="Bob"
        myUserId="u-me"
      />
    ));
    expect(container.querySelector('.dm-reply-quote-text')).toHaveTextContent('(deleted message)');
  });

  it('renders a message containing a single emoji with the large-emoji class', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({ content: '😂' })} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    expect(container.querySelector('.dm-msg-content')).toHaveClass('dm-msg-content-bigemoji');
  });

  it('does not upscale mixed text+emoji messages', () => {
    const { container } = render(() => (
      <DmMessageGroup message={msg({ content: 'hello 😂' })} showAvatar senderName="Bob" myUserId="u-me" />
    ));
    expect(container.querySelector('.dm-msg-content')).not.toHaveClass('dm-msg-content-bigemoji');
  });

  it('renders a reply quote for a message that references a local target', () => {
    setDmState('activeConversationId', 'c1');
    setDmState('messages', 'c1', [
      { ...msg({ id: 'm0', content: 'original', senderId: 'u-bob' }) },
      { ...msg({ id: 'm1', content: 'reply!', replyToId: 'm0' }) }
    ]);
    const { container } = render(() => (
      <DmMessageGroup
        message={msg({ id: 'm1', content: 'reply!', replyToId: 'm0' })}
        showAvatar
        senderName="Bob"
        myUserId="u-me"
      />
    ));
    expect(container.querySelector('[data-testid="dm-reply-quote"]')).toBeInTheDocument();
    expect(container.querySelector('.dm-reply-quote-author')).toHaveTextContent('Replying to @Bob');
  });
});
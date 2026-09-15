import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { DmInputBar } from '../../../src/components/dm/DmInputBar';
import { dmState, setDmState } from '../../../src/lib/dm/store';
import { resetForDmTests, stubFetch, flush } from '../../dm-helpers';

function seedConv() {
  setDmState('conversations', [
    {
      id: 'c1',
      type: 'dm',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      lastReadAt: null,
      unreadCount: 0,
      lastMessage: null,
      otherUser: { id: 'u-bob', username: 'Bob', presenceStatus: 'online' }
    }
  ]);
  setDmState('activeConversationId', 'c1');
}

describe('DmInputBar', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('renders a placeholder with the conversation partner name', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    expect(container.querySelector('[data-testid="dm-input-textarea"]')).toHaveAttribute('placeholder', 'Message Bob');
  });

  it('sends text on Enter (without shift) and clears the box', async () => {
    seedConv();
    let posted: any = null;
    const restore = stubFetch({
      '/api/dm/conversations/c1/messages': (url, init) => {
        if (init.method === 'POST') {
          posted = JSON.parse(String(init.body));
          return {
            body: {
              success: true,
              message: { id: 'm-new', conversationId: 'c1', senderId: 'u-me', content: posted.content, messageType: posted.messageType, mediaUrl: posted.mediaUrl, createdAt: '2025-01-03T00:00:00.000Z' }
            },
            status: 201
          };
        }
        return { body: { success: true, messages: [] } };
      }
    });
    const { container } = render(() => <DmInputBar />);
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'hello bob' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await flush();
    expect(posted).toEqual({ content: 'hello bob', messageType: 'text', mediaUrl: null, replyToId: null });
    expect(dmState.messages.c1?.[0]?.content).toBe('hello bob');
    restore();
  });

  it('does not send empty text and keeps the send button disabled', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    const send = container.querySelector('[data-testid="dm-send-btn"]') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(send);
    expect(dmState.messages.c1).toBeUndefined();
  });

  it('opens the GIF picker from the GIF button', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    fireEvent.click(container.querySelector('[data-testid="dm-gif-btn"]')!);
    expect(container.querySelector('[data-testid="dm-gif-picker"]')).toBeInTheDocument();
  });

  it('places the emoji and GIF buttons within the input actions on the right', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    const actions = container.querySelector('.dm-input-actions')!;
    expect(actions.querySelector('[data-testid="dm-emoji-btn"]')).toBeInTheDocument();
    expect(actions.querySelector('[data-testid="dm-gif-btn"]')).toBeInTheDocument();
  });

  it('opens the emoji picker and inserts the selected emoji into the textarea', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    fireEvent.click(container.querySelector('[data-testid="dm-emoji-btn"]')!);
    expect(container.querySelector('[data-testid="dm-emoji-picker"]')).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-emoji-item-0"]')!);
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    expect(textarea.value).toBe('😀');
    expect(container.querySelector('[data-testid="dm-emoji-picker"]')).not.toBeInTheDocument();
  });

  it('closes the emoji picker on outside click', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    fireEvent.click(container.querySelector('[data-testid="dm-emoji-btn"]')!);
    expect(container.querySelector('[data-testid="dm-emoji-picker"]')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(container.querySelector('[data-testid="dm-emoji-picker"]')).not.toBeInTheDocument();
  });

  it('shows a reply preview when replying and passes the reply id on send', async () => {
    seedConv();
    setDmState('messages', 'c1', [
      {
        id: 'm0',
        conversationId: 'c1',
        senderId: 'u-bob',
        content: 'need a hand',
        messageType: 'text',
        createdAt: '2025-01-01T10:00:00.000Z'
      }
    ]);
    setDmState('replyingTo', 'm0');
    let posted: any = null;
    const restore = stubFetch({
      '/api/dm/conversations/c1/messages': (url, init) => {
        if (init.method === 'POST') {
          posted = JSON.parse(String(init.body));
          return {
            body: {
              success: true,
              message: { id: 'm-new', conversationId: 'c1', senderId: 'u-me', content: posted.content, messageType: posted.messageType, mediaUrl: posted.mediaUrl, replyToId: posted.replyToId, createdAt: '2025-01-03T00:00:00.000Z' }
            },
            status: 201
          };
        }
        return { body: { success: true, messages: [] } };
      }
    });
    const { container } = render(() => <DmInputBar />);
    expect(container.querySelector('[data-testid="dm-reply-preview"]')).toBeInTheDocument();
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'on it' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await flush();
    expect(posted).toEqual({ content: 'on it', messageType: 'text', mediaUrl: null, replyToId: 'm0' });
    expect(dmState.replyingTo).toBeNull();
    restore();
  });

  it('cancels reply mode from the preview bar', () => {
    seedConv();
    setDmState('messages', 'c1', [
      {
        id: 'm0',
        conversationId: 'c1',
        senderId: 'u-bob',
        content: 'need a hand',
        messageType: 'text',
        createdAt: '2025-01-01T10:00:00.000Z'
      }
    ]);
    setDmState('replyingTo', 'm0');
    const { container } = render(() => <DmInputBar />);
    expect(container.querySelector('[data-testid="dm-reply-preview"]')).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-reply-preview-cancel"]')!);
    expect(container.querySelector('[data-testid="dm-reply-preview"]')).not.toBeInTheDocument();
  });

  it('shows a :name: autocomplete dropdown while typing a shortcode prefix', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'go :sun' } });
    const ac = container.querySelector('[data-testid="dm-emoji-autocomplete"]');
    expect(ac).toBeInTheDocument();
    expect(ac!.textContent).toContain(':sunflower:');
    expect(ac!.textContent).toContain(':sunglasses:');
  });

  it('hides the autocomplete when the text has no shortcode token', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'no shortcode here' } });
    expect(container.querySelector('[data-testid="dm-emoji-autocomplete"]')).not.toBeInTheDocument();
  });

  it('clicking an autocomplete item inserts the emoji inline', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: ':glasses' } });
    const item = container.querySelector('[data-testid="dm-emoji-ac-1"]') as HTMLElement;
    expect(item).toBeInTheDocument();
    expect(item.textContent).toContain(':sunglasses:');
    fireEvent.click(item);
    expect(textarea.value).toBe('😎');
    expect(container.querySelector('[data-testid="dm-emoji-autocomplete"]')).not.toBeInTheDocument();
  });

  it('Enter accepts the highlighted suggestion and inserts the emoji instead of sending', async () => {
    seedConv();
    let posted: any = null;
    const restore = stubFetch({
      '/api/dm/conversations/c1/messages': (url, init) => {
        if (init.method === 'POST') {
          posted = JSON.parse(String(init.body));
          return { body: { success: true }, status: 201 };
        }
        return { body: { success: true, messages: [] } };
      }
    });
    const { container } = render(() => <DmInputBar />);
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: ':' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await flush();
    expect(posted).toBeNull();
    expect(textarea.value).toBe('😎');
    expect(container.querySelector('[data-testid="dm-emoji-autocomplete"]')).not.toBeInTheDocument();
    restore();
  });

  it('Escape closes the autocomplete dropdown', () => {
    seedConv();
    const { container } = render(() => <DmInputBar />);
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: ':sun' } });
    expect(container.querySelector('[data-testid="dm-emoji-autocomplete"]')).toBeInTheDocument();
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(container.querySelector('[data-testid="dm-emoji-autocomplete"]')).not.toBeInTheDocument();
    expect(textarea.value).toBe(':sun');
  });

  it('sending converts known :name: shortcodes into emoji', async () => {
    seedConv();
    let posted: any = null;
    const restore = stubFetch({
      '/api/dm/conversations/c1/messages': (url, init) => {
        if (init.method === 'POST') {
          posted = JSON.parse(String(init.body));
          return {
            body: {
              success: true,
              message: { id: 'm-new', conversationId: 'c1', senderId: 'u-me', content: posted.content, messageType: posted.messageType, mediaUrl: posted.mediaUrl, createdAt: '2025-01-03T00:00:00.000Z' }
            },
            status: 201
          };
        }
        return { body: { success: true, messages: [] } };
      }
    });
    const { container } = render(() => <DmInputBar />);
    const textarea = container.querySelector('[data-testid="dm-input-textarea"]') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'chill :sunglasses: here' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await flush();
    expect(posted).toEqual({ content: 'chill 😎 here', messageType: 'text', mediaUrl: null, replyToId: null });
    expect(dmState.messages.c1?.[0]?.content).toBe('chill 😎 here');
    restore();
  });
});
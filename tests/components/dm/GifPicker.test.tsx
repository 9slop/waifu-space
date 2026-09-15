import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@solidjs/testing-library';
import { GifPicker } from '../../../src/components/dm/GifPicker';
import { dmState, gifLoadFavorites, gifSearch, setDmState } from '../../../src/lib/dm/store';
import { resetForDmTests, stubFetch, flush } from '../../dm-helpers';

vi.mock('../../../src/lib/dm/call', () => ({
  CallManager: class {}
}));

function seedConv() {
  setDmState('conversations', [
    {
      id: 'c1',
      type: 'dm',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      lastReadAt: null,
      unreadCount: 0,
      lastMessage: null,
      otherUser: { id: 'u-bob', username: 'Bob', presenceStatus: 'online' }
    }
  ]);
  setDmState('activeConversationId', 'c1');
}

describe('GifPicker', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('searches and renders GIF results with heart toggles', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/gif-search': () => ({
        body: {
          success: true,
          items: [
            { id: 'g-1', url: 'https://media.giphy.com/media/g1/giphy.gif', preview: 'https://media.giphy.com/media/g1/giphy-preview.gif', width: 1, height: 1 }
          ],
          source: 'giphy'
        }
      })
    });
    const items = await gifSearch('hello');
    expect(items.length).toBe(1);

    const { container } = render(() => <GifPicker />);
    await waitFor(() => expect(container.querySelector('[data-testid="dm-gif-item-g-1"]')).toBeInTheDocument());
    expect(container.querySelector('[data-testid="dm-gif-fav-g-1"]')).toBeInTheDocument();
    expect(dmState.gifTab).toBe('search');
    restore();
  });

  it('favoriting from search adds and removes the entry', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/gif-search': () => ({
        body: { success: true, items: [{ id: 'g-1', url: 'https://media.giphy.com/media/g1/giphy.gif', preview: 'https://media.giphy.com/media/g1/giphy-preview.gif', width: 1, height: 1 }], source: 'giphy' }
      }),
      '/api/dm/gif-favorites': (url, init) => {
        if (init.method === 'POST') {
          const sent = JSON.parse(String(init.body));
          return {
            body: {
              success: true,
              favorite: { id: 'fav1', gifId: sent.gifId, url: sent.url, preview: sent.preview, width: 480, height: 270, title: sent.title || '', provider: 'giphy', createdAt: '2025-01-01T00:00:00.000Z' }
            }
          };
        }
        if (init.method === 'DELETE') return { body: { success: true } };
        return { body: { success: true, favorites: [] } };
      }
    });
    await gifSearch('hello');
    const { container } = render(() => <GifPicker />);
    await waitFor(() => expect(container.querySelector('[data-testid="dm-gif-item-g-1"]')).toBeInTheDocument());

    fireEvent.click(container.querySelector('[data-testid="dm-gif-fav-g-1"]')!);
    await waitFor(() => expect(dmState.gifFavorites.some((f) => f.id === 'g1')).toBe(true));

    fireEvent.click(container.querySelector('[data-testid="dm-gif-fav-g-1"]')!);
    await waitFor(() => expect(dmState.gifFavorites.some((f) => f.id === 'g1')).toBe(false));
    restore();
  });

  it('favorites tab lists saved GIFs and shows the empty state otherwise', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/gif-favorites': () => ({
        body: { success: true, favorites: [{ id: 'f1', gifId: 'g-9', url: 'https://media.giphy.com/media/g9/giphy.gif', preview: 'https://media.giphy.com/media/g9/preview.gif', width: 480, height: 270, title: 'nice', provider: 'giphy', createdAt: '2025-01-01T00:00:00.000Z' }] }
      })
    });
    const items = await gifLoadFavorites();
    expect(items.length).toBe(1);

    const { container } = render(() => <GifPicker />);
    fireEvent.click(container.querySelector('[data-testid="dm-gif-tab-favorites"]')!);
    await waitFor(() => expect(container.querySelector('[data-testid="dm-gif-fav-item-g-9"]')).toBeInTheDocument());
    expect(container.querySelector('[data-testid="dm-gif-unfav-g-9"]')).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-gif-unfav-g-9"]')!);
    await waitFor(() => expect(dmState.gifFavorites.length).toBe(0));
    restore();
  });

  it('sends a GIF when the send area is clicked', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/gif-search': () => ({
        body: { success: true, items: [{ id: 'g-1', url: 'https://media.giphy.com/media/g1/giphy.gif', preview: 'https://media.giphy.com/media/g1/giphy-preview.gif', width: 1, height: 1 }], source: 'giphy' }
      }),
      '/api/dm/gif-favorites': () => ({ body: { success: true, favorites: [] } }),
      '/api/dm/conversations/c1/messages': () => ({ body: { success: true, message: { id: 'm1', conversationId: 'c1', senderId: 'u-me', content: '', messageType: 'gif', mediaUrl: 'https://media.giphy.com/media/g1/giphy.gif', createdAt: '2025-01-01T00:00:00.000Z' } }, status: 201 })
    });
    await gifSearch('hello');
    const { container } = render(() => <GifPicker />);
    await waitFor(() => expect(container.querySelector('[data-testid="dm-gif-item-g-1"]')).toBeInTheDocument());

    let posted = '';
    globalThis.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes('/api/dm/conversations/c1/messages')) {
        posted = JSON.parse(String(init?.body)).mediaUrl;
        return new Response(JSON.stringify({ success: true, message: { id: 'm1', conversationId: 'c1', senderId: 'u-me', content: '', messageType: 'gif', mediaUrl: posted, createdAt: '2025-01-01T00:00:00.000Z' } }), { status: 201 });
      }
      return new Response(JSON.stringify({ success: true, favorites: [] }), { status: 200 });
    });

    fireEvent.click(container.querySelector('.dm-gif-send')!);
    await flush();
    expect(posted).toBe('https://media.giphy.com/media/g1/giphy.gif');
    expect(dmState.messages.c1?.[0]?.messageType).toBe('gif');
    restore();
  });

  it('shows a hint when no GIF provider key is configured', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/gif-search': () => ({ body: { success: true, source: 'none', keyConfigured: false, items: [] } }),
      '/api/dm/gif-favorites': () => ({ body: { success: true, favorites: [] } })
    });
    await gifSearch('anything');
    expect(dmState.gifUnavailable).toBe(true);
    const { container } = render(() => <GifPicker />);
    expect(container.querySelector('[data-testid="dm-gif-unavailable"]')).toBeInTheDocument();
    restore();
  });
});
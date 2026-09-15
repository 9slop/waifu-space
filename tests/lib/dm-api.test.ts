import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isGifUrl,
  normalizeGifUrl,
  classifyOutgoingMessage,
  toDmMessage,
  mergeMessageLists,
  isOwnMessage,
  mediaSourceOf,
  formatMessageTime,
  formatDayDivider,
  listConversations,
  fetchMessages,
  sendMessageRequest,
  markConversationRead,
  fetchUnread,
  searchUsers,
  searchGifs,
  fetchDmConfig
} from '../../src/lib/dm/api';

describe('dm-api pure helpers', () => {
  it('isGifUrl recognizes direct image URLs and known providers', () => {
    expect(isGifUrl('https://media.tenor.com/abc.gif')).toBe(true);
    expect(isGifUrl('https://media.giphy.com/media/abc/giphy.gif')).toBe(true);
    expect(isGifUrl('https://i.giphy.com/abc.webp')).toBe(true);
    expect(isGifUrl('https://example.com/x.webp?size=2')).toBe(true);
    expect(isGifUrl('https://example.com/photo.jpg')).toBe(true);
    expect(isGifUrl('https://media.tenor.com/abc.mp4')).toBe(true);
    expect(isGifUrl('not a url')).toBe(false);
    expect(isGifUrl('')).toBe(false);
    expect(isGifUrl('   ')).toBe(false);
  });

  it('normalizeGifUrl trims and rejects long/non-media inputs', () => {
    expect(normalizeGifUrl('  https://media.tenor.com/a.gif  ')).toBe('https://media.tenor.com/a.gif');
    expect(normalizeGifUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(normalizeGifUrl('https://example.com/a.mp4')).toBe('https://example.com/a.mp4');
    expect(normalizeGifUrl('hello')).toBeNull();
    expect(normalizeGifUrl(`https://example.com/${'x'.repeat(3000)}.gif`)).toBeNull();
  });

  it('classifyOutgoingMessage sends explicit GIFs and detects pasted GIF URLs', () => {
    expect(classifyOutgoingMessage('', 'https://media.tenor.com/a.gif')).toEqual({
      content: '',
      messageType: 'gif',
      mediaUrl: 'https://media.tenor.com/a.gif'
    });
    expect(classifyOutgoingMessage('https://media.giphy.com/media/x/giphy.gif')).toEqual({
      content: '',
      messageType: 'gif',
      mediaUrl: 'https://media.giphy.com/media/x/giphy.gif'
    });
    expect(classifyOutgoingMessage('  hello world  ')).toEqual({
      content: 'hello world',
      messageType: 'text',
      mediaUrl: null
    });
    expect(classifyOutgoingMessage('   ')).toEqual({ content: '', messageType: 'text', mediaUrl: null });
  });

  it('toDmMessage normalizes server rows of either casing', () => {
    const camel = toDmMessage({ id: '1', conversationId: 'c1', senderId: 'u1', content: 'hi', messageType: 'gif', mediaUrl: 'https://x/a.gif', createdAt: '2025-01-01T00:00:00.000Z' });
    expect(camel).toMatchObject({ id: '1', conversationId: 'c1', messageType: 'gif', mediaUrl: 'https://x/a.gif' });
    const snake = toDmMessage({ id: '2', conversation_id: 'c2', sender_id: 'u2', content: 'yo', message_type: 'text', created_at: '2025-01-01T00:00:00.000Z' });
    expect(snake).toMatchObject({ conversationId: 'c2', senderId: 'u2', messageType: 'text' });
  });

  it('mergeMessageLists dedupes by id and sorts ascending', () => {
    const a = { id: '1', conversationId: 'c', senderId: 'u', content: 'one', messageType: 'text' as const, createdAt: '2025-01-01T00:00:00.000Z' };
    const b = { id: '2', conversationId: 'c', senderId: 'u', content: 'two', messageType: 'text' as const, createdAt: '2025-01-01T00:01:00.000Z' };
    const merged = mergeMessageLists([null, [b], undefined, [a], [b]]);
    expect(merged.map(m => m.id)).toEqual(['1', '2']);
  });

  it('isOwnMessage matches against the my id', () => {
    const msg = { id: '1', conversationId: 'c', senderId: 'me', content: '', messageType: 'text' as const, createdAt: '' };
    expect(isOwnMessage(msg, 'me')).toBe(true);
    expect(isOwnMessage(msg, 'other')).toBe(false);
    expect(isOwnMessage(msg, null)).toBe(false);
  });

  it('mediaSourceOf embeds messageType gif and text URLs', () => {
    expect(mediaSourceOf({ id: '1', conversationId: 'c', senderId: 'u', content: '', messageType: 'gif', mediaUrl: 'https://x/a.gif', createdAt: '' })).toEqual({ url: 'https://x/a.gif', kind: 'gif' });
    expect(mediaSourceOf({ id: '2', conversationId: 'c', senderId: 'u', content: 'https://media.tenor.com/b.gif', messageType: 'text', createdAt: '' })).toEqual({ url: 'https://media.tenor.com/b.gif', kind: 'gif' });
    expect(mediaSourceOf({ id: '3', conversationId: 'c', senderId: 'u', content: 'https://x/a.mp4', messageType: 'video', mediaUrl: 'https://x/a.mp4', createdAt: '' })).toEqual({ url: 'https://x/a.mp4', kind: 'video' });
    expect(mediaSourceOf({ id: '4', conversationId: 'c', senderId: 'u', content: 'plain', messageType: 'text', createdAt: '' })).toBeNull();
  });

  it('formatMessageTime and formatDayDivider render labels', () => {
    expect(formatMessageTime('2025-01-01T09:05:00.000Z')).toBeTruthy();
    expect(formatDayDivider(new Date().toISOString())).toBe('Today');
    expect(formatDayDivider(new Date(Date.now() - 86400000).toISOString())).toBe('Yesterday');
  });
});

describe('dm-api http client', () => {
  let calls: Array<{ url: string; init: RequestInit }> = [];
  beforeEach(() => {
    calls = [];
    const respond = (ok = true, status = 200, body: unknown = {}) => new Response(ok ? JSON.stringify(body) : JSON.stringify({ error: 'boom' }), { status });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });
      if (url.includes('/conversations/') && init?.method === 'POST') {
        return respond(true, 201, { success: true, message: { id: 'm1', conversationId: 'c1', senderId: 'u1', content: 'hi', messageType: 'text', createdAt: new Date().toISOString() } });
      }
      if (url.includes('/read')) return respond(true, 200, { success: true });
      if (url.includes('/conversations')) return respond(true, 200, { success: true, conversations: [] });
      if (url.includes('/messages') || url.includes('/conversations/')) return respond(true, 200, { success: true, messages: [], conversation: { id: 'c1' } });
      if (url.includes('/unread')) return respond(true, 200, { success: true, totalUnread: 3 });
      if (url.includes('/search')) return respond(true, 200, { success: true, users: [] });
      if (url.includes('/gif-search')) return respond(true, 200, { success: true, items: [{ id: 'g1', url: 'https://x.gif', preview: 'https://x.gif', width: 100, height: 100 }] });
      if (url.includes('/config')) return respond(true, 200, { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon', isConfigured: true });
      return respond(true, 200, { success: true });
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listConversations sends the bearer token', async () => {
    await listConversations('tok-1');
    expect(String((globalThis.fetch as any).mock.calls[0][0])).toBe('/api/dm/conversations');
    expect((globalThis.fetch as any).mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
  });

  it('sendMessageRequest posts a GIF message', async () => {
    const msg = await sendMessageRequest('tok', 'c1', { content: '', messageType: 'gif', mediaUrl: 'https://x/a.gif' });
    expect(msg.id).toBe('m1');
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('/api/dm/conversations/c1/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ content: '', messageType: 'gif', mediaUrl: 'https://x/a.gif' });
  });

  it('markConversationRead resolves without throwing', async () => {
    await expect(markConversationRead('tok', 'c1')).resolves.toBeUndefined();
  });

  it('fetchUnread returns the total', async () => {
    expect(await fetchUnread('tok')).toBe(3);
  });

  it('searchUsers and searchGifs return typed items', async () => {
    expect(await searchUsers('tok', 'bob')).toEqual([]);
    const gifs = await searchGifs('tok', 'cat');
    expect(gifs.items[0]).toMatchObject({ id: 'g1', width: 100 });
    expect(gifs.source).toBe('giphy');
    expect(gifs.keyConfigured).toBe(true);
  });

  it('fetchDmConfig returns the realtime config', async () => {
    const cfg = await fetchDmConfig();
    expect(cfg.supabaseUrl).toBe('https://x.supabase.co');
    expect(cfg.supabaseAnonKey).toBe('anon');
  });

  it('throws an ApiError-like error on non-ok responses', async () => {
    (globalThis.fetch as any).mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'nope' }), { status: 400 }));
    await expect(fetchMessages('tok', 'c1')).rejects.toThrow('nope');
  });
});
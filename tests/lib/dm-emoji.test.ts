import { describe, it, expect } from 'vitest';
import {
  twemojiFilename,
  twemojiUrl,
  splitEmojiText,
  isSingleEmoji,
  EMOJI_SEGMENT_RE
} from '../../src/lib/dm/emoji';

describe('emoji helpers', () => {
  it('builds twemoji filenames for simple emoji', () => {
    expect(twemojiFilename('👍')).toBe('1f44d');
    expect(twemojiFilename('😀')).toBe('1f600');
    expect(twemojiFilename('⭐')).toBe('2b50');
  });

  it('strips the variation selector and joins codepoints for composed emoji', () => {
    expect(twemojiFilename('❤️')).toBe('2764');
    expect(twemojiFilename('👍🏽')).toBe('1f44d-1f3fd');
    expect(twemojiFilename('✌️')).toBe('270c');
  });

  it('builds the full twemoji CDN url', () => {
    expect(twemojiUrl('😀')).toBe('https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f600.png');
  });

  it('splits text into plain + emoji segments', () => {
    expect(splitEmojiText('hey 😀 there ❤️ end')).toEqual([
      { text: 'hey ', emoji: false },
      { text: '😀', emoji: true },
      { text: ' there ', emoji: false },
      { text: '❤️', emoji: true },
      { text: ' end', emoji: false }
    ]);
  });

  it('keeps plain-only text as a single segment', () => {
    expect(splitEmojiText('no emoji here')).toEqual([{ text: 'no emoji here', emoji: false }]);
  });

  it('recognizes a single emoji but rejects multi-emoji or plain text', () => {
    expect(isSingleEmoji('👍')).toBe(true);
    expect(isSingleEmoji('❤️')).toBe(true);
    expect(isSingleEmoji('👍🏽')).toBe(true);
    expect(isSingleEmoji('😀😀')).toBe(false);
    expect(isSingleEmoji('hello')).toBe(false);
    expect(isSingleEmoji('')).toBe(false);
  });

  it('matches keycap and regional-indicator sequences', () => {
    expect('1️⃣'.match(EMOJI_SEGMENT_RE)?.[0]).toBe('1️⃣');
    expect('🇺🇸'.match(EMOJI_SEGMENT_RE)?.[0]).toBe('🇺🇸');
  });
});
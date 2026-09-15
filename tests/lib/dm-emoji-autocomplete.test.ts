import { describe, it, expect } from 'vitest';
import {
  EMOJI_BY_NAME,
  EMOJI_CATEGORIES,
  QUICK_REACTIONS,
  findEmojiAutocompletions,
  replaceEmojiShortcodes,
  isSingleEmoji
} from '../../src/lib/dm/emoji';

describe('emoji shortcode map', () => {
  it('maps the first picker item to its canonical shortcode', () => {
    expect(EMOJI_BY_NAME['grinning']).toBe('😀');
  });

  it('maps every quick reaction to at least one shortcode', () => {
    const values = new Set(Object.values(EMOJI_BY_NAME));
    for (const reaction of QUICK_REACTIONS) {
      expect(values.has(reaction), `no shortcode maps to ${reaction}`).toBe(true);
    }
  });

  it('every mapped emoji is a valid single emoji', () => {
    for (const emoji of Object.values(EMOJI_BY_NAME)) {
      expect(isSingleEmoji(emoji), `invalid emoji: ${emoji}`).toBe(true);
    }
  });

  it('every picker category item is a valid single emoji', () => {
    for (const cat of EMOJI_CATEGORIES) {
      for (const emoji of cat.items) {
        expect(isSingleEmoji(emoji), `invalid ${cat.id} item: ${emoji}`).toBe(true);
      }
    }
  });
});

describe('findEmojiAutocompletions', () => {
  it('finds suggestions by prefix with prefix hits first', () => {
    const sun = findEmojiAutocompletions('sun');
    const names = sun.map((s) => s.name);
    expect(names).toContain('sunflower');
    expect(names).toContain('sunglasses');
    expect(names[0]).toBe('sun_with_face');
    expect(sun.length).toBeLessThanOrEqual(10);
    for (const entry of sun) {
      expect(EMOJI_BY_NAME[entry.name]).toBe(entry.emoji);
    }
  });

  it('matches substrings too', () => {
    expect(findEmojiAutocompletions('glasses').map((s) => s.name)).toEqual(['clinking_glasses', 'sunglasses']);
  });

  it('returns nothing for an unknown prefix', () => {
    expect(findEmojiAutocompletions('zzzzqq')).toEqual([]);
  });

  it('returns a curated popular set (capped) for an empty prefix', () => {
    const res = findEmojiAutocompletions('');
    expect(res.length).toBeGreaterThan(0);
    expect(res.length).toBeLessThanOrEqual(10);
    expect(res.map((r) => r.name)).toContain('smile');
  });

  it('respects a custom limit', () => {
    expect(findEmojiAutocompletions('s', 3).length).toBeLessThanOrEqual(3);
  });
});

describe('replaceEmojiShortcodes', () => {
  it('replaces known shortcodes case-insensitively', () => {
    expect(replaceEmojiShortcodes(':sunglasses: hi :SUNFLOWER:')).toBe('😎 hi 🌻');
  });

  it('replaces embedded shortcodes inside words', () => {
    expect(replaceEmojiShortcodes('time:smile:ole')).toBe('time😄ole');
  });

  it('leaves unknown shortcodes and plain text untouched', () => {
    expect(replaceEmojiShortcodes(':not_a_real_code: hello')).toBe(':not_a_real_code: hello');
    expect(replaceEmojiShortcodes('plain text chat')).toBe('plain text chat');
  });

  it('supports country-code flags via the flag helper', () => {
    expect(EMOJI_BY_NAME['flag_us']).toBe('\u{1F1FA}\u{1F1F8}');
    expect(replaceEmojiShortcodes(':flag_us: :jp:')).toBe('\u{1F1FA}\u{1F1F8} \u{1F1EF}\u{1F1F5}');
  });
});
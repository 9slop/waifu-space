import { describe, it, expect } from 'vitest';
import { sanitizeRawState } from '../../src/lib/validate';

describe('State hydration sanitizer (validate.ts)', () => {
  it('returns empty data for non-object input', () => {
    expect(sanitizeRawState(null).data).toEqual({});
    expect(sanitizeRawState('string').data).toEqual({});
    expect(sanitizeRawState(42).data).toEqual({});
    expect(sanitizeRawState([]).data).toEqual({});
  });

  it('defaults empty input to null user and zeroed rpg slice', () => {
    const out = sanitizeRawState({}).data;
    expect(out.user).toBeNull();
    expect(out.rpg?.coins).toBe(200);
    expect(out.rpg?.unlockedOutfits).toEqual([]);
    expect(out.waifu).toBeUndefined();
  });

  it('preserves a valid activeTab', () => {
    expect(sanitizeRawState({ activeTab: 'calendar' }).data.activeTab).toBe('calendar');
  });

  it('drops invalid activeTab values', () => {
    expect(sanitizeRawState({ activeTab: 'foo' }).data.activeTab).toBeUndefined();
  });

  it('sanitizes user account', () => {
    const out = sanitizeRawState({ user: { id: 'u1', username: 'alice' } });
    expect(out.data.user).toEqual({ id: 'u1', username: 'alice' });
  });

  it('sets user to null for missing or invalid data', () => {
    expect(sanitizeRawState({}).data.user).toBeNull();
    expect(sanitizeRawState({ user: { id: 'u1' } }).data.user).toBeNull();
  });

  it('sanitizes waifu with default fallbacks', () => {
    const out = sanitizeRawState({ waifu: {} });
    expect(out.data.waifu?.name).toBe('Akari');
    expect(out.data.waifu?.personality).toBe('tsundere');
    expect(out.data.waifu?.appearance?.hairstyle).toBe('twintails');
    expect(out.data.waifu?.appearance?.avatarMode).toBe('svg');
    expect(out.data.waifu?.bondLevel).toBe(1);
    expect(out.data.waifu?.bondExp).toBe(0);
  });

  it('clamps negative coins and exp to zero', () => {
    const out = sanitizeRawState({ rpg: { coins: -100, unlockedOutfits: [] } });
    expect(out.data.rpg?.coins).toBe(0);
  });

  it('enforces bondLevel >= 1', () => {
    const out = sanitizeRawState({ waifu: { bondLevel: 0 } });
    expect(out.data.waifu?.bondLevel).toBe(1);
  });

  it('repairs an event whose end is before its start', () => {
    const out = sanitizeRawState({
      calendar: {
        events: [
          { id: 'e1', title: 'T', start: '2026-01-01T10:00:00Z', end: '2026-01-01T09:00:00Z', type: 'event', recurrence: 'none' }
        ]
      }
    });
    const evt = out.data.calendar?.events?.[0];
    expect(evt).toBeDefined();
    const startMs = new Date(evt!.start).getTime();
    const endMs = new Date(evt!.end).getTime();
    expect(endMs).toBeGreaterThanOrEqual(startMs);
  });

  it('deduplicates unlock lists', () => {
    const out = sanitizeRawState({ rpg: { unlockedOutfits: ['a', 'a', 'b'] } });
    expect(out.data.rpg?.unlockedOutfits).toEqual(['a', 'b']);
  });

  it('defaults calendar view to month for invalid values', () => {
    const out = sanitizeRawState({ calendar: { view: 'grid' } });
    expect(out.data.calendar?.view).toBe('month');
  });

  it('deduplicates claimedAffectionMilestones and floors floats', () => {
    const out = sanitizeRawState({ rpg: { claimedAffectionMilestones: [1, 1.7, 2.3, 2] } });
    expect(out.data.rpg?.claimedAffectionMilestones).toEqual([1, 2]);
  });

  it('replaces bad hex colors with defaults', () => {
    const out = sanitizeRawState({ waifu: { appearance: { hairColor: 'blue', eyeColor: 'red' } } });
    expect(out.data.waifu?.appearance?.hairColor).toMatch(/^#/);
    expect(out.data.waifu?.appearance?.eyeColor).toMatch(/^#/);
  });

  it('sanitizes chat messages and dedupes suggestions', () => {
    const out = sanitizeRawState({
      chat: { messages: [{ id: 'm1', sender: 'user', text: 'hi' }, null, 99], suggestions: ['a', 'a', 'b'] }
    });
    expect(out.data.chat?.messages?.length).toBe(1);
    expect(out.data.chat?.suggestions).toEqual(['a', 'b']);
  });
});

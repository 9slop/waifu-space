import { describe, it, expect } from 'vitest';
import {
  validateCalendarEventInput,
  firstValidationMessage,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_TYPES,
  RECURRENCE_RULES,
  sanitizeSettings,
  sanitizeSettingsUpdate,
  isHexColor,
  isValidDateString
} from '../../src/lib/validation';

describe('Form validation (validation.ts)', () => {
  const valid = { title: 'Standup', start: '2026-01-01T10:00:00', end: '2026-01-01T11:00:00', type: 'event', recurrence: 'none' };

  it('returns ok for a fully valid event input', () => {
    expect(validateCalendarEventInput(valid).ok).toBe(true);
  });

  it('rejects an empty title', () => {
    const result = validateCalendarEventInput({ title: '' });
    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe('calendar.validation.titleRequired');
  });

  it('rejects a title exceeding the max length', () => {
    const result = validateCalendarEventInput({ title: 'x'.repeat(EVENT_TITLE_MAX_LENGTH + 1) });
    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe('calendar.validation.titleTooLong');
  });

  it('rejects an invalid start date', () => {
    const result = validateCalendarEventInput({ start: 'not-a-date' });
    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe('calendar.validation.invalidStart');
  });

  it('rejects an end date before start', () => {
    const result = validateCalendarEventInput({
      start: '2026-01-01T12:00:00',
      end: '2026-01-01T11:00:00'
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.key === 'calendar.validation.endBeforeStart')).toBe(true);
  });

  it('rejects invalid event type', () => {
    const result = validateCalendarEventInput({ type: 'invalid-type' });
    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe('calendar.validation.invalidType');
  });

  it('rejects invalid recurrence rule', () => {
    const result = validateCalendarEventInput({ recurrence: 'biweekly' });
    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe('calendar.validation.invalidRecurrence');
  });

  it('rejects invalid hex color', () => {
    const result = validateCalendarEventInput({ color: 'not-hex' });
    expect(result.ok).toBe(false);
    expect(result.issues[0].key).toBe('calendar.validation.invalidColor');
  });

  it('allows all valid event types and recurrence rules', () => {
    expect(validateCalendarEventInput({ type: 'event' }).ok).toBe(true);
    expect(validateCalendarEventInput({ type: 'task' }).ok).toBe(true);
    expect(validateCalendarEventInput({ type: 'birthday' }).ok).toBe(true);
    for (const rule of RECURRENCE_RULES) {
      expect(validateCalendarEventInput({ recurrence: rule }).ok).toBe(true);
    }
  });
});

describe('firstValidationMessage', () => {
  it('returns the first issue message', () => {
    const result = validateCalendarEventInput({ title: '', start: 'bad' });
    expect(firstValidationMessage(result)).toBeTruthy();
  });

  it('returns null when there are no issues', () => {
    expect(firstValidationMessage({ ok: true, issues: [] })).toBeNull();
  });
});

describe('isHexColor / isValidDateString', () => {
  it('recognizes valid hex colors', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('#ff6584')).toBe(true);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#gggggg')).toBe(false);
  });

  it('recognizes valid date strings', () => {
    expect(isValidDateString('2026-01-01T00:00:00Z')).toBe(true);
    expect(isValidDateString(new Date().toISOString())).toBe(true);
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString('not a date')).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('clamps wallpaperBlur to [0, 20]', () => {
    const result = sanitizeSettings({ wallpaperBlur: -5 });
    expect(result.wallpaperBlur).toBe(0);
    const result2 = sanitizeSettings({ wallpaperBlur: 100 });
    expect(result2.wallpaperBlur).toBe(20);
  });

  it('clamps wallpaperDim to [0, 100]', () => {
    expect(sanitizeSettings({ wallpaperDim: -10 }).wallpaperDim).toBe(0);
    expect(sanitizeSettings({ wallpaperDim: 200 }).wallpaperDim).toBe(100);
  });

  it('clamps ttsPitch and ttsRate to [0.5, 2]', () => {
    expect(sanitizeSettings({ ttsPitch: 0.1 }).ttsPitch).toBe(0.5);
    expect(sanitizeSettings({ ttsPitch: 3 }).ttsPitch).toBe(2);
    expect(sanitizeSettings({ ttsRate: 0 }).ttsRate).toBe(0.5);
  });

  it('sanitizes language to en or ja', () => {
    expect(sanitizeSettings({ language: 'ja' }).language).toBe('ja');
    expect(sanitizeSettings({ language: 'fr' }).language).toBe('en');
  });

  it('rejects invalid hex customAccent and falls back to default', () => {
    expect(sanitizeSettings({ customAccent: 'blue' }).customAccent).toBe('#ff6584');
    expect(sanitizeSettings({ customAccent: '#abc' }).customAccent).toBe('#abc');
  });

  it('returns empty object for completely empty input', () => {
    expect(sanitizeSettings({})).toEqual({});
  });
});

describe('sanitizeSettingsUpdate', () => {
  it('sanitizes a single field without clobbering others', () => {
    const result = sanitizeSettingsUpdate({ wallpaperDim: 55 });
    expect(result.wallpaperDim).toBe(55);
    expect(result.ttsPitch).toBeUndefined();
  });
});

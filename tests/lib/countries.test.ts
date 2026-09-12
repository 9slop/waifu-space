import { describe, it, expect } from 'vitest';
import {
  normalizeCountryCode,
  sanitizeCountryCode,
  countryFlagEmoji,
  isValidHolidayDate,
  holidayEntryToEvent,
  buildHolidayEvents,
  sanitizeCountry,
  sanitizeHolidayEntry,
  HOLIDAY_COLOR,
  CULTURE_COLOR,
  CULTURAL_HOLIDAYS,
  culturalHolidayDate,
  buildCulturalHolidayEvents
} from '../../src/lib/countries';

describe('Country helpers (countries.ts)', () => {
  describe('normalizeCountryCode / sanitizeCountryCode', () => {
    it('normalizes, trims, and uppercases valid two-letter codes', () => {
      expect(normalizeCountryCode('us')).toBe('US');
      expect(normalizeCountryCode(' jp ')).toBe('JP');
      expect(sanitizeCountryCode('gB')).toBe('GB');
    });

    it('rejects invalid codes', () => {
      expect(normalizeCountryCode('USA')).toBeNull();
      expect(normalizeCountryCode('U')).toBeNull();
      expect(normalizeCountryCode('U1')).toBeNull();
      expect(normalizeCountryCode('')).toBeNull();
      expect(normalizeCountryCode('  ')).toBeNull();
      expect(normalizeCountryCode(123)).toBeNull();
      expect(normalizeCountryCode(null)).toBeNull();
      expect(normalizeCountryCode(undefined)).toBeNull();
    });
  });

  describe('countryFlagEmoji', () => {
    it('maps ISO codes to regional-indicator flag emojis', () => {
      expect(countryFlagEmoji('US')).toBe('\u{1F1FA}\u{1F1F8}'); // 🇺🇸
      expect(countryFlagEmoji('jp')).toBe('\u{1F1EF}\u{1F1F5}'); // 🇯🇵
      expect(countryFlagEmoji(' UK ')).toBe('\u{1F1EC}\u{1F1E7}'); // 🇬🇧 (normalized)
    });

    it('falls back to a globe for anything unrecognizable', () => {
      expect(countryFlagEmoji('USA')).toBe('🌍');
      expect(countryFlagEmoji('')).toBe('🌍');
    });
  });

  describe('isValidHolidayDate', () => {
    it('accepts real calendar dates', () => {
      expect(isValidHolidayDate('2024-01-01')).toBe(true);
      expect(isValidHolidayDate('2026-12-31')).toBe(true);
      expect(isValidHolidayDate('0004-02-29')).toBe(true); // proleptic leap year, no JS 1900+ shift
      expect(isValidHolidayDate('0002-02-29')).toBe(false); // year 2 is not a leap year
    });

    it('rejects malformed or impossible dates', () => {
      expect(isValidHolidayDate('2024-02-30')).toBe(false);
      expect(isValidHolidayDate('2024-13-01')).toBe(false);
      expect(isValidHolidayDate('2024-1-1')).toBe(false);
      expect(isValidHolidayDate('01/01/2024')).toBe(false);
      expect(isValidHolidayDate('not-a-date')).toBe(false);
      expect(isValidHolidayDate(123)).toBe(false);
      expect(isValidHolidayDate(null)).toBe(false);
    });
  });

  describe('holidayEntryToEvent', () => {
    it('builds a read-only all-day event with local-midnight bounds', () => {
      const ev = holidayEntryToEvent({ date: '2026-10-15', name: 'Culture Day', countryCode: 'jp' });
      expect(ev).not.toBeNull();
      expect(ev!.id).toBe('holiday-JP-2026-10-15');
      expect(ev!.title).toBe('Culture Day');
      expect(ev!.allDay).toBe(true);
      expect(ev!.type).toBe('event');
      expect(ev!.completed).toBe(false);
      expect(ev!.color).toBe(HOLIDAY_COLOR);
      expect(ev!._holiday).toEqual({ countryCode: 'JP' });

      const start = new Date(ev!.start);
      const end = new Date(ev!.end);
      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(9);
      expect(start.getDate()).toBe(15);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      // All-day events end at local midnight of the following day.
      expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
    });

    it('rejects invalid entries', () => {
      expect(holidayEntryToEvent({ date: '2026-10-15', name: 'X', countryCode: 'USA' })).toBeNull();
      expect(holidayEntryToEvent({ date: '2026-10-15', name: '', countryCode: 'US' })).toBeNull();
      expect(holidayEntryToEvent({ date: '2026-13-45', name: 'X', countryCode: 'US' })).toBeNull();
      expect(holidayEntryToEvent(null as any)).toBeNull();
    });
  });

  describe('buildHolidayEvents', () => {
    it('deduplicates by (country, date) id and drops invalid rows', () => {
      const events = buildHolidayEvents([
        { date: '2026-01-01', name: 'New Year', countryCode: 'us' },
        { date: '2026-01-01', name: 'New Year (dup)', countryCode: 'US' },
        { date: '2026-07-04', name: 'Independence Day', countryCode: 'US' },
        { date: 'bad-date', name: 'Junk', countryCode: 'US' },
        { date: '2026-05-05', name: 'Golden Week', countryCode: 'JP' }
      ]);
      expect(events).toHaveLength(3);
      expect(events.map(e => e.id).sort()).toEqual([
        'holiday-JP-2026-05-05',
        'holiday-US-2026-01-01',
        'holiday-US-2026-07-04'
      ]);
    });

    it('returns [] for non-array input', () => {
      expect(buildHolidayEvents(null as any)).toEqual([]);
      expect(buildHolidayEvents({} as any)).toEqual([]);
    });
  });

  describe('sanitizeCountry / sanitizeHolidayEntry', () => {
    it('normalizes Nager "AvailableCountries" rows', () => {
      expect(sanitizeCountry({ key: 'US', value: 'United States' })).toEqual({ code: 'US', name: 'United States' });
      expect(sanitizeCountry({ key: 'jp', value: 'Japan' })).toEqual({ code: 'JP', name: 'Japan' });
      expect(sanitizeCountry({ key: 'USA', value: 'Bad' })).toBeNull();
      expect(sanitizeCountry(null)).toBeNull();
      expect(sanitizeCountry('nope')).toBeNull();
    });

    it('tolerates the proxy response shape ({ code, name })', () => {
      expect(sanitizeCountry({ code: 'JP', name: 'Japan' })).toEqual({ code: 'JP', name: 'Japan' });
      expect(sanitizeCountry({ code: 'us', name: 'United States' })).toEqual({ code: 'US', name: 'United States' });
      expect(sanitizeCountry({ code: 'USA', name: 'Bad' })).toBeNull();
      expect(sanitizeCountry({ code: 'JP' })).toBeNull();
      expect(sanitizeCountry({ name: 'Nameless' })).toBeNull();
    });

    it('normalizes Nager "PublicHolidays" rows (name over localName)', () => {
      const entry = sanitizeHolidayEntry({
        date: '2026-01-01',
        name: "New Year's Day",
        localName: '元日',
        countryCode: 'jp'
      });
      expect(entry).toEqual({ date: '2026-01-01', name: "New Year's Day", countryCode: 'JP' });

      expect(sanitizeHolidayEntry({ date: '2026-01-01', name: '', localName: '元日', countryCode: 'JP' })).toEqual({
        date: '2026-01-01',
        name: '元日',
        countryCode: 'JP'
      });

      expect(sanitizeHolidayEntry({ date: 'bad', name: 'X', countryCode: 'US' })).toBeNull();
      expect(sanitizeHolidayEntry(null)).toBeNull();
    });
  });

  describe("Cultural holidays (Halloween, New Year's Eve, ...)", () => {
    it('defines the expected worldwide cultural entries', () => {
      const keys = CULTURAL_HOLIDAYS.map(d => d.key);
      expect(keys).toContain('halloween');
      expect(keys).toContain('new-years-eve');
      expect(keys).toContain('valentines-day');
      expect(keys).toContain('christmas-eve');
      expect(keys).toContain('mothers-day');
      expect(keys).toContain('fathers-day');
    });

    it('resolves fixed-date holidays to the right day', () => {
      expect(culturalHolidayDate(CULTURAL_HOLIDAYS.find(d => d.key === 'halloween')!, 2026)).toEqual(new Date(2026, 9, 31));
      expect(culturalHolidayDate(CULTURAL_HOLIDAYS.find(d => d.key === 'new-years-eve')!, 2026)).toEqual(new Date(2026, 11, 31));
      expect(culturalHolidayDate(CULTURAL_HOLIDAYS.find(d => d.key === 'valentines-day')!, 2026)).toEqual(new Date(2026, 1, 14));
      expect(culturalHolidayDate(CULTURAL_HOLIDAYS.find(d => d.key === 'christmas-eve')!, 2026)).toEqual(new Date(2026, 11, 24));
    });

    it('resolves rule-based holidays (2nd Sunday of May, 3rd Sunday of June)', () => {
      expect(culturalHolidayDate(CULTURAL_HOLIDAYS.find(d => d.key === 'mothers-day')!, 2026)).toEqual(new Date(2026, 4, 10));
      expect(culturalHolidayDate(CULTURAL_HOLIDAYS.find(d => d.key === 'fathers-day')!, 2026)).toEqual(new Date(2026, 5, 21));
      // Stable across years (2025: May 11, June 15).
      expect(culturalHolidayDate(CULTURAL_HOLIDAYS.find(d => d.key === 'mothers-day')!, 2025)).toEqual(new Date(2025, 4, 11));
      expect(culturalHolidayDate(CULTURAL_HOLIDAYS.find(d => d.key === 'fathers-day')!, 2025)).toEqual(new Date(2025, 5, 15));
    });

    it('builds read-only all-day cultural events with a 🎉 marker', () => {
      const events = buildCulturalHolidayEvents([2026]);
      const halloween = events.find(e => e.id === 'culture-halloween-2026-10-31');
      expect(halloween).toBeDefined();
      expect(halloween!.title).toBe('Halloween');
      expect(halloween!.allDay).toBe(true);
      expect(halloween!.type).toBe('event');
      expect(halloween!.completed).toBe(false);
      expect(halloween!.color).toBe(CULTURE_COLOR);
      expect(halloween!._holiday).toEqual({ countryCode: '', culture: true });

      const start = new Date(halloween!.start);
      const end = new Date(halloween!.end);
      expect(start.getDate()).toBe(31);
      expect(start.getMonth()).toBe(9);
      expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
    });

    it('deduplicates across years and rejects junk input', () => {
      const events = buildCulturalHolidayEvents([2025, 2026, 2025]);
      const ids = events.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(events.filter(e => e.id.startsWith('culture-halloween-')).length).toBe(2); // 2025 + 2026

      expect(buildCulturalHolidayEvents(null as any)).toEqual([]);
      expect(buildCulturalHolidayEvents(['bad'] as any)).toEqual([]);
    });
  });
});
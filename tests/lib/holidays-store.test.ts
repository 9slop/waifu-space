import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  state,
  setState,
  updateSettings,
  DEFAULT_STATE,
  STORAGE_KEY,
  fetchHolidaysForCountry,
  fetchCountryCatalog,
  refreshHolidayEvents,
  setCountryHolidays,
  holidayEvents,
  setHolidayEvents,
  clearHolidayCache
} from '../../src/lib/store';
import { buildHolidayEvents } from '../../src/lib/countries';

describe('Store: country holidays (store.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
    clearHolidayCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockFetch = (handler: (url: string) => Response | Promise<Response>) => {
    const fn = vi.fn(async (url: string) => handler(url));
    vi.stubGlobal('fetch', fn);
    return { fn };
  };

  const scopedStorage = () => localStorage.getItem(STORAGE_KEY);

  describe('setCountryHolidays', () => {
    it('sanitizes, uppercases, de-duplicates, and persists the selection', () => {
      setCountryHolidays(['jp', 'US', 'JP', 'zz', 'DE']);
      // Syntactically valid 2-letter codes survive (ZZ is a real ISO slot);
      // duplicates and casing collapse.
      expect(state.settings.countryHolidays).toEqual(['JP', 'US', 'ZZ', 'DE']);

      const saved = JSON.parse(scopedStorage() || '{}');
      expect(saved.settings.countryHolidays).toEqual(['JP', 'US', 'ZZ', 'DE']);
    });

    it('falls back to an empty list for junk input and never exceeds 20 codes', () => {
      setCountryHolidays(['!!!', 'USA', 42 as any]);
      expect(state.settings.countryHolidays).toEqual([]);

      const many = Array.from({ length: 30 }, (_, i) => (i < 26 ? String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + ((i * 7) % 26)) : 'JD'));
      setCountryHolidays(many);
      expect(state.settings.countryHolidays.length).toBeLessThanOrEqual(20);
    });
  });

  describe('updateSettings whitelist', () => {
    it('round-trips countryHolidays through the settings sanitizer', () => {
      updateSettings({ countryHolidays: ['us', 'GB', 'gB', 'bad!'] });
      expect(state.settings.countryHolidays).toEqual(['US', 'GB']);

      const saved = JSON.parse(scopedStorage() || '{}');
      expect(saved.settings.countryHolidays).toEqual(['US', 'GB']);
    });
  });

  describe('fetchHolidaysForCountry', () => {
    it('hits the proxy once per (country, year) thanks to the in-memory cache', async () => {
      const { fn } = mockFetch(() => new Response(JSON.stringify({
        holidays: [{ date: '2026-01-01', name: "New Year's Day", countryCode: 'US' }]
      })));

      const a = await fetchHolidaysForCountry('US', 2026);
      const b = await fetchHolidaysForCountry('us', 2026);
      expect(a).toEqual([{ date: '2026-01-01', name: "New Year's Day", countryCode: 'US' }]);
      expect(b).toEqual(a);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('/api/holidays?action=events&country=US&year=2026');
    });

    it('returns [] and never fetches for invalid input or upstream failures', async () => {
      const { fn } = mockFetch(() => new Response('nope', { status: 500 }));
      expect(await fetchHolidaysForCountry('USA', 2026)).toEqual([]);
      expect(await fetchHolidaysForCountry('US', -50)).toEqual([]);
      expect(fn).not.toHaveBeenCalled();

      expect(await fetchHolidaysForCountry('US', 2026)).toEqual([]);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('returns [] when the proxy throws', async () => {
      mockFetch(() => { throw new TypeError('network'); });
      expect(await fetchHolidaysForCountry('US', 2026)).toEqual([]);
    });
  });

  describe('fetchCountryCatalog', () => {
    it('returns the sorted catalog and caches it', async () => {
      const { fn } = mockFetch(() => new Response(JSON.stringify({
        countries: [
          { code: 'JP', name: 'Japan' },
          { code: 'US', name: 'United States' }
        ]
      })));

      const first = await fetchCountryCatalog();
      const second = await fetchCountryCatalog();
      expect(first).toEqual([
        { code: 'JP', name: 'Japan' },
        { code: 'US', name: 'United States' }
      ]);
      expect(second).toEqual(first);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('/api/holidays?action=countries');
    });

    it('returns [] on upstream failure', async () => {
      mockFetch(() => new Response('boom', { status: 502 }));
      expect(await fetchCountryCatalog()).toEqual([]);
    });
  });

  describe('refreshHolidayEvents', () => {
    it('clears events when no country is selected', async () => {
      setHolidayEvents(buildHolidayEvents([{ date: '2026-01-01', name: 'X', countryCode: 'US' }]));
      expect(holidayEvents()).toHaveLength(1);
      setState('settings', 'countryHolidays', []);
      await refreshHolidayEvents([2026]);
      expect(holidayEvents()).toEqual([]);
    });

    it('builds read-only holiday events across all selected countries and years', async () => {
      mockFetch((url: string) => {
        if (url.includes('year=2027')) {
          return new Response(JSON.stringify({
            holidays: [{ date: '2027-01-01', name: 'New Year 2027', countryCode: 'US' }]
          }));
        }
        return new Response(JSON.stringify({
          holidays: [
            { date: '2026-01-01', name: "New Year's Day", countryCode: 'US' },
            { date: '2026-07-04', name: 'Independence Day', countryCode: 'US' },
            { date: '2026-05-05', name: 'Golden Week', countryCode: 'JP' }
          ]
        }));
      });

      setCountryHolidays(['US', 'JP']);
      await refreshHolidayEvents([2026, 2027]);

      const events = holidayEvents();
      expect(events).toHaveLength(4);
      expect(events.filter(e => e._holiday?.countryCode === 'US')).toHaveLength(3);
      expect(events.find(e => e.title === 'Golden Week')).toMatchObject({
        allDay: true,
        type: 'event',
        completed: false,
        _holiday: { countryCode: 'JP' }
      });
      // No holiday events may ever carry a recurrence or parent linkage.
      expect(events.every(e => !e.recurrence || e.recurrence === 'none')).toBe(true);
      expect(events.every(e => !e.parentId)).toBe(true);
    });
  });
});
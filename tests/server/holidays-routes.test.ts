import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET as holidaysGET } from '../../src/routes/api/holidays';
import { clearRateLimits } from '../../src/lib/server/rate-limit';

describe('Holidays proxy route (/api/holidays)', () => {
  beforeEach(() => {
    clearRateLimits();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockFetch = () => fetch as unknown as ReturnType<typeof vi.fn>;

  const req = (query = '') => new Request(`http://localhost/api/holidays${query ? `?${query}` : ''}`);

  describe('action=countries', () => {
    it('proxies the upstream country catalog, normalized and sorted by name', async () => {
      mockFetch().mockResolvedValueOnce(
        new Response(JSON.stringify([
          { key: 'us', value: 'United States' },
          { key: 'JP', value: 'Japan' },
          { key: 'DE', value: 'Germany' },
          { key: 'BAD', value: 'Invalid code' }
        ]))
      );

      const res = await holidaysGET({ request: req('action=countries') });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.countries).toEqual([
        { code: 'DE', name: 'Germany' },
        { code: 'JP', name: 'Japan' },
        { code: 'US', name: 'United States' }
      ]);
      expect(mockFetch()).toHaveBeenCalledWith(
        'https://date.nager.at/api/v3/AvailableCountries',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('returns 502 when the upstream fails', async () => {
      mockFetch().mockResolvedValueOnce(new Response('upstream exploded', { status: 500 }));
      const res = await holidaysGET({ request: req('action=countries') });
      expect(res.status).toBe(502);

      mockFetch().mockRejectedValueOnce(new TypeError('network down'));
      const res2 = await holidaysGET({ request: req('action=countries') });
      expect(res2.status).toBe(502);
    });
  });

  describe('action=events', () => {
    it('maps holidays to { date, name, countryCode } validated and date-sorted', async () => {
      mockFetch().mockResolvedValueOnce(
        new Response(JSON.stringify([
          { date: '2026-12-25', name: 'Christmas Day', localName: 'Christmas', countryCode: 'US' },
          { date: '2026-07-04', name: 'Independence Day', localName: 'Portugal Day', countryCode: 'us' },
          { date: 'bad-date', name: 'Junk', countryCode: 'US' },
          { date: '2026-01-01', name: '', localName: "New Year's Day", countryCode: 'US' }
        ]))
      );

      const res = await holidaysGET({ request: req('action=events&country=US&year=2026') });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.holidays).toEqual([
        { date: '2026-01-01', name: "New Year's Day", countryCode: 'US' },
        { date: '2026-07-04', name: 'Independence Day', countryCode: 'US' },
        { date: '2026-12-25', name: 'Christmas Day', countryCode: 'US' }
      ]);
      expect(mockFetch()).toHaveBeenCalledWith(
        'https://date.nager.at/api/v3/PublicHolidays/2026/US',
        expect.anything()
      );
    });

    it('lowercases dodge-proof: country and year are validated strictly', async () => {
      await expect((await holidaysGET({ request: req('action=events&country=USA&year=2026') })).status).toBe(400);
      await expect((await holidaysGET({ request: req('action=events&country=US') })).status).toBe(400);
      await expect((await holidaysGET({ request: req('action=events&country=US&year=1700') })).status).toBe(400);
      await expect((await holidaysGET({ request: req('action=events&country=US&year=abc') })).status).toBe(400);
      await expect((await holidaysGET({ request: req('action=events&country=US&year=2026.5') })).status).toBe(400);
    });

    it('treats upstream 404 as an empty schedule (success, no error)', async () => {
      mockFetch().mockResolvedValueOnce(new Response('not found', { status: 404 }));
      const res = await holidaysGET({ request: req('action=events&country=ZZ&year=2050') });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true, holidays: [] });
    });

    it('returns 502 on upstream failure and on network errors', async () => {
      mockFetch().mockResolvedValueOnce(new Response('boom', { status: 503 }));
      expect((await holidaysGET({ request: req('action=events&country=US&year=2026') })).status).toBe(502);

      mockFetch().mockRejectedValueOnce(new TypeError('ECONNRESET'));
      expect((await holidaysGET({ request: req('action=events&country=US&year=2026') })).status).toBe(502);
    });
  });

  describe('request hardening', () => {
    it('rejects unknown actions', async () => {
      expect((await holidaysGET({ request: req('action=nonsense') })).status).toBe(400);
    });

    it('rate limits by client IP (120/min)', async () => {
      const fetchMock = mockFetch();
      fetchMock.mockImplementation(async () => new Response(JSON.stringify([])));

      for (let i = 0; i < 120; i++) {
        const res = await holidaysGET({ request: req('action=countries') });
        expect(res.status).toBe(200);
      }
      const blocked = await holidaysGET({ request: req('action=countries') });
      expect(blocked.status).toBe(429);
      const data = await blocked.json();
      expect(data.success).toBe(false);
    });
  });
});
import { json } from '@solidjs/router';
import { checkRateLimit } from '../../lib/server/rate-limit';
import { normalizeCountryCode, isValidHolidayDate } from '../../lib/countries';

const NAGER_BASE = 'https://date.nager.at/api/v3';
const UPSTREAM_TIMEOUT_MS = 10_000;
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

export interface HolidayEntryApi {
  date: string;
  name: string;
  countryCode: string;
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim().slice(0, 64) || 'unknown';
  return 'unknown';
}

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < YEAR_MIN || n > YEAR_MAX) return null;
  return n;
}

async function fetchUpstream(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Public-holiday proxy for Nager.Date (https://date.nager.at). The upstream API
 * is free and requires no key, but it does NOT send CORS headers, so browsers
 * cannot call it directly. This endpoint relays the two calls the calendar
 * needs so the client stays same-origin.
 *
 *   GET /api/holidays?action=countries
 *     -> { countries: [{ code, name }] }  (sorted by name)
 *
 *   GET /api/holidays?action=events&country=US&year=2026
 *     -> { holidays: [{ date, name, countryCode }] }  (sorted by date)
 */
export async function GET(event: { request: Request }) {
  const url = new URL(event.request.url);
  const action = url.searchParams.get('action') || 'countries';

  const rateCheck = checkRateLimit(`holidays_${getClientIp(event.request)}`, 120, 60_000);
  if (!rateCheck.allowed) {
    return json(
      { success: false, error: 'Too many holiday requests. Please try again in a moment.' },
      { status: 429 }
    );
  }

  try {
    if (action === 'countries') {
      const res = await fetchUpstream(`${NAGER_BASE}/AvailableCountries`);
      if (!res.ok) {
        return json(
          { success: false, error: 'Holiday country catalog is temporarily unavailable.' },
          { status: 502 }
        );
      }
      const raw: unknown = await res.json();
      const countries = (Array.isArray(raw) ? raw : [])
        .map((c: unknown) => {
          const obj = c as Record<string, unknown> | null;
          if (!obj || typeof obj !== 'object') return null;
          const code = normalizeCountryCode(obj.key);
          const name = typeof obj.value === 'string' && obj.value.trim() ? obj.value.trim() : null;
          if (!code || !name) return null;
          return { code, name };
        })
        .filter((c): c is { code: string; name: string } => c !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      return json(
        { success: true, countries },
        { headers: { 'Cache-Control': 'public, max-age=21600, s-maxage=21600' } }
      );
    }

    if (action === 'events') {
      const country = normalizeCountryCode(url.searchParams.get('country'));
      const year = parseYear(url.searchParams.get('year'));
      if (!country || year === null) {
        return json(
          { success: false, error: 'Invalid country or year. Use country=XX (ISO 3166-1 alpha-2) and a year between 1900 and 2100.' },
          { status: 400 }
        );
      }

      const res = await fetchUpstream(`${NAGER_BASE}/PublicHolidays/${year}/${country}`);
      if (res.status === 404) {
        // No data for that code/year combination (the country changed code,
        // or the year is out of the upstream's range). Nothing scheduled is
        // a perfectly valid answer, so return an empty list.
        return json(
          { success: true, holidays: [] },
          { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
        );
      }
      if (!res.ok) {
        return json(
          { success: false, error: 'Holiday data is temporarily unavailable.' },
          { status: 502 }
        );
      }

      const raw: unknown = await res.json();
      const holidays: HolidayEntryApi[] = (Array.isArray(raw) ? raw : [])
        .map((h: unknown) => {
          const obj = h as Record<string, unknown> | null;
          if (!obj || typeof obj !== 'object') return null;
          const code = normalizeCountryCode(obj.countryCode);
          const name =
            typeof obj.name === 'string' && obj.name.trim()
              ? obj.name.trim()
              : typeof obj.localName === 'string' && obj.localName.trim()
                ? obj.localName.trim()
                : null;
          const date = isValidHolidayDate(obj.date) ? (obj.date as string) : null;
          if (!code || !name || !date) return null;
          return { date, name, countryCode: code };
        })
        .filter((h): h is HolidayEntryApi => h !== null)
        .sort((a, b) => a.date.localeCompare(b.date));

      return json(
        { success: true, holidays },
        { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
      );
    }

    return json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch {
    return json(
      { success: false, error: 'Holiday service could not be reached.' },
      { status: 502 }
    );
  }
}
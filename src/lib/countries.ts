// Public-holiday helpers shared by the server proxy (/api/holidays), the store,
// and the calendar UI. Everything here is pure and free of Solid/reactive state
// so it can be unit-tested in isolation.

import { CalendarEventItem } from './ical';

export const HOLIDAY_COLOR = '#a29bfe';

export interface CountryInfo {
  code: string; // ISO 3166-1 alpha-2, e.g. 'JP'
  name: string; // English display name, e.g. 'Japan'
}

export interface HolidayEntry {
  date: string; // YYYY-MM-DD
  name: string;
  countryCode: string; // ISO 3166-1 alpha-2
}

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Uppercases a raw country code and validates it as a 2-letter ISO code. */
export function normalizeCountryCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return COUNTRY_CODE_RE.test(code) ? code : null;
}

/** Alias of normalizeCountryCode kept for import clarity at validation sites. */
export function sanitizeCountryCode(raw: unknown): string | null {
  return normalizeCountryCode(raw);
}

/** Country flag emoji from an ISO 3166-1 alpha-2 code (regional indicators). */
export function countryFlagEmoji(code: string): string {
  const normalized = (code || '').trim().toUpperCase();
  if (!COUNTRY_CODE_RE.test(normalized)) return '🌍';
  const base = 0x1f1e6; // REGIONAL INDICATOR SYMBOL LETTER A
  const a = 'A'.charCodeAt(0);
  const upper = (c: string) => base + normalized.charCodeAt(c) - a;
  return String.fromCodePoint(upper(0), upper(1));
}

/** Does this string hold a real calendar date (YYYY-MM-DD)? */
export function isValidHolidayDate(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !ISO_DATE_RE.test(raw)) return false;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Converts one holiday entry into an all-day calendar event (or null if invalid). */
export function holidayEntryToEvent(entry: HolidayEntry): CalendarEventItem | null {
  if (!entry || typeof entry !== 'object') return null;
  const countryCode = normalizeCountryCode(entry.countryCode);
  const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : null;
  if (!countryCode || !name || !isValidHolidayDate(entry.date)) return null;

  const [y, m, d] = entry.date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

  return {
    id: `holiday-${countryCode}-${entry.date}`,
    title: name,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: true,
    type: 'event',
    completed: false,
    color: HOLIDAY_COLOR,
    _holiday: { countryCode }
  };
}

/** Builds de-duplicated holiday events from raw entries, dropping invalid ones. */
export function buildHolidayEvents(entries: HolidayEntry[]): CalendarEventItem[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const out: CalendarEventItem[] = [];
  for (const entry of entries) {
    const ev = holidayEntryToEvent(entry);
    if (!ev || seen.has(ev.id)) continue;
    seen.add(ev.id);
    out.push(ev);
  }
  return out;
}

/** Normalizes a raw catalog item ({ key, value }) from the Nager "AvailableCountries" feed. */
export function sanitizeCountry(raw: unknown): CountryInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const code = normalizeCountryCode(obj.key ?? obj.countryCode);
  const name = typeof obj.value === 'string' && obj.value.trim() ? obj.value.trim() : null;
  if (!code || !name) return null;
  return { code, name };
}

/** Normalizes a raw holiday row from the Nager "PublicHolidays" feed. */
export function sanitizeHolidayEntry(raw: unknown): HolidayEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
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
}
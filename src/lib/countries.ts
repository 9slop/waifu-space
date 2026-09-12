// Public-holiday helpers shared by the server proxy (/api/holidays), the store,
// and the calendar UI. Everything here is pure and free of Solid/reactive state
// so it can be unit-tested in isolation.

import { CalendarEventItem } from './ical';

export const HOLIDAY_COLOR = '#a29bfe';
/** Distinct pastel used for worldwide cultural events (Halloween, New Year's Eve, ...). */
export const CULTURE_COLOR = '#fd79a8';

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
  const display = normalized === 'UK' ? 'GB' : normalized; // unicode alias
  const base = 0x1f1e6; // REGIONAL INDICATOR SYMBOL LETTER A
  const a = 'A'.charCodeAt(0);
  const upper = (i: number) => base + display.charCodeAt(i) - a;
  return String.fromCodePoint(upper(0), upper(1));
}

/** Does this string hold a real calendar date (YYYY-MM-DD)? */
export function isValidHolidayDate(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !ISO_DATE_RE.test(raw)) return false;
  const [y, m, d] = raw.split('-').map(Number);
  // Parse as strict UTC so years < 100 (proleptic Gregorian) behave correctly.
  const date = new Date(`${raw}T00:00:00.000Z`);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
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

/** Normalizes a raw catalog item ({ key, value }) or the proxy shape ({ code, name }). */
export function sanitizeCountry(raw: unknown): CountryInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const code = normalizeCountryCode(obj.key ?? obj.countryCode ?? obj.code);
  const name =
    typeof (obj.value ?? obj.name) === 'string' && String(obj.value ?? obj.name).trim()
      ? String(obj.value ?? obj.name).trim()
      : null;
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

// ---------------------------------------------------------------------------
// Worldwide cultural holidays (Halloween, New Year's Eve, ...)
//
// These are deliberately NOT statutory public holidays of any single country,
// so Nager.Date never returns them. They are optional, opt-in, worldwide, and
// rendered as read-only all-day events with a 🎉 marker.
// ---------------------------------------------------------------------------

export type CulturalHolidayRule = { weekday: number; nth: number }; // e.g. 2nd Sunday

export interface CulturalHolidayDef {
  key: string; // stable id, e.g. 'halloween'
  name: string; // English display name used as the event title
  month: number; // 0-based month
  /** Fixed day of month (1-based). Provide either `day` or `rule`. */
  day?: number;
  /** Floating date rule: nth <weekday> of the month (0 = Sunday). */
  rule?: CulturalHolidayRule;
}

export const CULTURAL_HOLIDAYS: CulturalHolidayDef[] = [
  { key: 'new-years-eve', name: "New Year's Eve", month: 11, day: 31 },
  { key: 'valentines-day', name: "Valentine's Day", month: 1, day: 14 },
  { key: 'womens-day', name: "International Women's Day", month: 2, day: 8 },
  { key: 'st-patricks-day', name: "St. Patrick's Day", month: 2, day: 17 },
  { key: 'mothers-day', name: "Mother's Day", month: 4, rule: { weekday: 0, nth: 2 } },
  { key: 'fathers-day', name: "Father's Day", month: 5, rule: { weekday: 0, nth: 3 } },
  { key: 'april-fools', name: "April Fools' Day", month: 3, day: 1 },
  { key: 'earth-day', name: 'Earth Day', month: 3, day: 22 },
  { key: 'halloween', name: 'Halloween', month: 9, day: 31 },
  { key: 'christmas-eve', name: 'Christmas Eve', month: 11, day: 24 }
];

/** Resolves a cultural holiday to its date for a given year (optional: undefined). */
export function culturalHolidayDate(def: CulturalHolidayDef, year: number): Date | null {
  if (!def || typeof def !== 'object') return null;
  if (def.rule) {
    const { weekday, nth } = def.rule;
    const count = nth >= 1 ? nth : 1;
    let d = new Date(year, def.month, 1);
    const offset = (weekday - d.getDay() + 7) % 7;
    d.setDate(1 + offset + (count - 1) * 7);
    if (d.getMonth() !== def.month) return null; // impossible for nth <= 5
    return d;
  }
  if (typeof def.day === 'number' && def.day >= 1 && def.day <= 31) {
    return new Date(year, def.month, def.day);
  }
  return null;
}

/** Builds the read-only all-day events for every cultural holiday in the years. */
export function buildCulturalHolidayEvents(years: number[]): CalendarEventItem[] {
  if (!Array.isArray(years)) return [];
  const seen = new Set<string>();
  const out: CalendarEventItem[] = [];
  for (const y of years) {
    const year = Math.trunc(y);
    if (!Number.isFinite(year)) continue;
    for (const def of CULTURAL_HOLIDAYS) {
      const date = culturalHolidayDate(def, year);
      if (!date) continue;
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const id = `culture-${def.key}-${dateKey}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        title: def.name,
        start: date.toISOString(),
        end: new Date(yyyy, date.getMonth(), date.getDate() + 1, 0, 0, 0, 0).toISOString(),
        allDay: true,
        type: 'event',
        completed: false,
        color: CULTURE_COLOR,
        _holiday: { countryCode: '', culture: true }
      });
    }
  }
  return out;
}
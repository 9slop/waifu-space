// Form & input validation utilities shared by the store, modals, and settings.

import { normalizeCountryCode } from './countries';

export const EVENT_TITLE_MAX_LENGTH = 200;
export const SETTINGS_BLUR_MIN = 0;
export const SETTINGS_BLUR_MAX = 20;
export const SETTINGS_DIM_MIN = 0;
export const SETTINGS_DIM_MAX = 100;
export const TTS_PITCH_MIN = 0.5;
export const TTS_PITCH_MAX = 2;
export const TTS_RATE_MIN = 0.5;
export const TTS_RATE_MAX = 2;
export const MAX_SHOWCASE_ITEMS = 6;

export const EVENT_TYPES = ['event', 'task', 'birthday'] as const;
export const RECURRENCE_RULES = ['none', 'daily', 'weekly', 'monthly', 'weekdays'] as const;

export interface CalendarEventInput {
  title?: string;
  start?: string;
  end?: string;
  type?: string;
  insteadOfAllDay?: boolean;
  allDay?: boolean;
  recurrence?: string;
  color?: string;
}

export interface ValidationIssue {
  key: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Valid date-time string? Accepts ISO strings or browser-parsable date strings. */
export function isValidDateString(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  const d = new Date(raw);
  return !Number.isNaN(d.getTime());
}

function buildDate(raw: unknown): Date | null {
  if (!isValidDateString(raw)) return null;
  const d = new Date(raw as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isHexColor(raw: unknown): raw is string {
  return typeof raw === 'string' && HEX_COLOR_RE.test(raw.trim());
}

/**
 * Validates a calendar event payload (create or update). Any subset of fields
 * may be provided; fields that are absent are considered valid.
 */
export function validateCalendarEventInput(input: CalendarEventInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) {
      issues.push({ key: 'calendar.validation.titleRequired', message: 'Title is required.' });
    } else if (title.length > EVENT_TITLE_MAX_LENGTH) {
      issues.push({
        key: 'calendar.validation.titleTooLong',
        message: `Title must be ${EVENT_TITLE_MAX_LENGTH} characters or fewer.`
      });
    }
  }

  const start = buildDate(input.start);
  if (input.start !== undefined && !start) {
    issues.push({ key: 'calendar.validation.invalidStart', message: 'Start time is invalid.' });
  }

  const end = buildDate(input.end);
  if (input.end !== undefined && !end) {
    issues.push({ key: 'calendar.validation.invalidEnd', message: 'End time is invalid.' });
  }

  if (start && end && end.getTime() < start.getTime()) {
    issues.push({ key: 'calendar.validation.endBeforeStart', message: 'End time must be after the start time.' });
  }

  if (input.type !== undefined && !(EVENT_TYPES as readonly string[]).includes(input.type)) {
    issues.push({ key: 'calendar.validation.invalidType', message: 'Event type is invalid.' });
  }

  if (input.recurrence !== undefined && !(RECURRENCE_RULES as readonly string[]).includes(input.recurrence)) {
    issues.push({ key: 'calendar.validation.invalidRecurrence', message: 'Recurrence rule is invalid.' });
  }

  if (input.color !== undefined && input.color !== '' && !isHexColor(input.color)) {
    issues.push({ key: 'calendar.validation.invalidColor', message: 'Color must be a hex value.' });
  }

  return { ok: issues.length === 0, issues };
}

/** First message of a failed validation, or null when valid. */
export function firstValidationMessage(result: ValidationResult): string | null {
  return result.issues[0]?.message ?? null;
}

// ---------------------------------------------------------------------------
// Settings sanitization
// ---------------------------------------------------------------------------

export interface CleanSettings {
  language?: 'en' | 'ja';
  wallpaperId?: string;
  wallpaperType?: 'stock' | 'custom';
  customWallpaperUrl?: string;
  wallpaperBlur?: number;
  wallpaperDim?: number;
  sakuraParticles?: boolean;
  theme?: string;
  customAccent?: string;
  soundEffects?: boolean;
  ttsEnabled?: boolean;
  ttsVoice?: string;
  ttsPitch?: number;
  ttsRate?: number;
  llmProvider?: string;
  llmApiKey?: string;
  llmModel?: string;
  countryHolidays?: string[];
}

function toBool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

function toStr(raw: unknown, fallback: string): string {
  return typeof raw === 'string' ? raw : fallback;
}

/**
 * Sanitizes an arbitrary settings object into a safe, well-typed object.
 * Unknown or malformed values fall back to `fallback` (the current value).
 * Only keys present in `input` are returned; absent keys are skipped so a
 * partial update never clobbers unrelated settings.
 */
export function sanitizeSettings(input: Record<string, unknown>, fallback: CleanSettings = {}): CleanSettings {
  const out: CleanSettings = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);

  if (has('language')) out.language = input.language === 'ja' ? 'ja' : 'en';
  if (has('wallpaperId')) out.wallpaperId = toStr(input.wallpaperId, fallback.wallpaperId ?? 'sakura-shrine');
  if (has('wallpaperType')) out.wallpaperType = input.wallpaperType === 'custom' ? 'custom' : 'stock';
  if (has('customWallpaperUrl')) out.customWallpaperUrl = toStr(input.customWallpaperUrl, fallback.customWallpaperUrl ?? '');
  if (has('wallpaperBlur')) out.wallpaperBlur = clampNumber(Number(input.wallpaperBlur), SETTINGS_BLUR_MIN, SETTINGS_BLUR_MAX);
  if (has('wallpaperDim')) out.wallpaperDim = clampNumber(Number(input.wallpaperDim), SETTINGS_DIM_MIN, SETTINGS_DIM_MAX);
  if (has('sakuraParticles')) out.sakuraParticles = toBool(input.sakuraParticles, fallback.sakuraParticles ?? true);
  if (has('theme')) out.theme = toStr(input.theme, fallback.theme ?? 'sakura');
  if (has('customAccent')) out.customAccent = isHexColor(input.customAccent) ? (input.customAccent as string) : fallback.customAccent ?? '#ff6584';
  if (has('soundEffects')) out.soundEffects = toBool(input.soundEffects, fallback.soundEffects ?? true);
  if (has('ttsEnabled')) out.ttsEnabled = toBool(input.ttsEnabled, fallback.ttsEnabled ?? false);
  if (has('ttsVoice')) out.ttsVoice = toStr(input.ttsVoice, fallback.ttsVoice ?? '');
  if (has('ttsPitch')) out.ttsPitch = clampNumber(Number(input.ttsPitch), TTS_PITCH_MIN, TTS_PITCH_MAX);
  if (has('ttsRate')) out.ttsRate = clampNumber(Number(input.ttsRate), TTS_RATE_MIN, TTS_RATE_MAX);
  if (has('llmProvider')) out.llmProvider = toStr(input.llmProvider, fallback.llmProvider ?? 'none');
  if (has('llmApiKey')) out.llmApiKey = toStr(input.llmApiKey, fallback.llmApiKey ?? '');
  if (has('llmModel')) out.llmModel = toStr(input.llmModel, fallback.llmModel ?? '');
  if (has('countryHolidays')) {
    const seen = new Set<string>();
    const codes: string[] = [];
    if (Array.isArray(input.countryHolidays)) {
      for (const raw of input.countryHolidays) {
        const code = normalizeCountryCode(raw);
        if (code && !seen.has(code)) {
          seen.add(code);
          codes.push(code);
        }
        // Safety cap so a hostile/corrupt save can never balloon the list.
        if (codes.length >= 20) break;
      }
    }
    out.countryHolidays = codes;
  }

  return out;
}

/** Sanitizes the values for one-off settings updates (used by SettingsStudio). */
export function sanitizeSettingsUpdate(input: Record<string, unknown>): CleanSettings {
  return sanitizeSettings(input);
}
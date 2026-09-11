// State hydration schema validation & sanitization.
//
// localStorage / imported backup / cloud data is untrusted: it may be older,
// truncated, hand-edited, or produced by a newer build. `sanitizeRawState`
// validates each top-level slice against a schema and clamps corrupt values so
// `loadState` and backup imports can never crash or poison the UI.

import type { AppState, ChatMessage, RpgState, UserAccount } from './store';
import type { CalendarEventItem } from './ical';
import { PERSONALITIES } from './personality';
import {
  sanitizeSettings,
  isValidDateString,
  isHexColor,
  EVENT_TYPES,
  RECURRENCE_RULES,
  MAX_SHOWCASE_ITEMS
} from './validation';

export interface SanitizeResult {
  data: Partial<AppState>;
  issues: string[];
}

const VALID_TABS = ['main', 'calendar', 'rpg', 'settings'] as const;
const VALID_VIEWS = ['month', 'week', 'day'] as const;
const VALID_SENDERS = ['user', 'waifu'] as const;
const VALID_AVATAR_MODES = ['svg', 'custom'] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toStr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function toBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function toNonNegativeInt(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(0, Math.floor(v));
}

function toPositiveInt(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(1, Math.floor(v));
}

function toNonNegativeNum(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(0, v);
}

function dedupeStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string' && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function validDateString(v: unknown, fallback: string): string {
  return isValidDateString(v) ? (v as string) : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function syntheticId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeEvent(raw: unknown): CalendarEventItem | null {
  if (!isRecord(raw)) return null;
  const fallbackStart = nowIso();
  let start = validDateString(raw.start, fallbackStart);
  let end = validDateString(raw.end, start);

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (endMs < startMs) {
    // Never persist an event that ends before it starts.
    end = new Date(startMs + 3600000).toISOString();
  }

  const type = ((EVENT_TYPES as readonly string[]).includes(raw.type as string) ? raw.type : 'event') as CalendarEventItem['type'];
  const recurrence = ((RECURRENCE_RULES as readonly string[]).includes(raw.recurrence as string)
    ? raw.recurrence
    : 'none') as CalendarEventItem['recurrence'];

  return {
    id: toStr(raw.id, syntheticId('evt')),
    title: toStr(raw.title, 'Untitled Event'),
    start,
    end,
    allDay: toBool(raw.allDay, false),
    type,
    completed: toBool(raw.completed, false),
    color: isHexColor(raw.color) ? (raw.color as string) : '#ff6584',
    description: typeof raw.description === 'string' ? raw.description : undefined,
    location: typeof raw.location === 'string' ? raw.location : undefined,
    recurrence,
    ...(typeof raw._notified === 'boolean' ? { _notified: raw._notified } : {}),
    ...(typeof raw._rewarded === 'boolean' ? { _rewarded: raw._rewarded } : {})
  };
}

function sanitizeMessage(raw: unknown): ChatMessage | null {
  if (!isRecord(raw)) return null;
  const sender = (VALID_SENDERS as readonly string[]).includes(raw.sender as string) ? (raw.sender as ChatMessage['sender']) : 'waifu';
  return {
    id: toStr(raw.id, syntheticId('msg')),
    sender,
    text: toStr(raw.text, ''),
    timestamp: validDateString(raw.timestamp, nowIso()),
    ...(typeof raw.emotion === 'string' ? { emotion: raw.emotion } : {})
  };
}

function sanitizeUser(raw: unknown): UserAccount | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.username !== 'string') return null;
  const user: UserAccount = { id: raw.id, username: raw.username };
  if (typeof raw.email === 'string') user.email = raw.email;
  if (typeof raw.avatarUrl === 'string') user.avatarUrl = raw.avatarUrl;
  if (typeof raw.bio === 'string') user.bio = raw.bio;
  if (typeof raw.token === 'string') user.token = raw.token;
  return user;
}

function sanitizeRpg(raw: unknown): RpgState {
  const src = isRecord(raw) ? raw : {};
  const showcaseItems = dedupeStrings(src.showcaseItems).slice(0, MAX_SHOWCASE_ITEMS);
  const defenseStats = isRecord(src.defenseStats) ? src.defenseStats : {};
  return {
    coins: toNonNegativeInt(src.coins, 200),
    unlockedOutfits: dedupeStrings(src.unlockedOutfits),
    unlockedAccessories: dedupeStrings(src.unlockedAccessories),
    unlockedHairstyles: dedupeStrings(src.unlockedHairstyles),
    showcaseItems,
    claimedAffectionMilestones: Array.isArray(src.claimedAffectionMilestones)
      ? Array.from(new Set(src.claimedAffectionMilestones.filter(x => typeof x === 'number' && Number.isFinite(x) && x >= 0).map(x => Math.floor(x))))
      : [],
    defenseHighWave: toNonNegativeInt(src.defenseHighWave, 0),
    defenseStats: {
      totalVictories: toNonNegativeInt(defenseStats.totalVictories, 0),
      goblinsDefeated: toNonNegativeInt(defenseStats.goblinsDefeated, 0)
    }
  };
}

/**
 * Validates and cleans an arbitrary JSON-parsed value into a safe partial
 * `AppState`. Returns zeroed slices for missing keys so callers can simply
 * deep-merge the result over their defaults.
 */
export function sanitizeRawState(raw: unknown): SanitizeResult {
  const issues: string[] = [];
  if (!isRecord(raw) || Array.isArray(raw)) {
    return { data: {}, issues: ['Invalid root state value'] };
  }

  const data: Partial<AppState> = {};

  if ((VALID_TABS as readonly string[]).includes(raw.activeTab as string)) {
    data.activeTab = raw.activeTab as AppState['activeTab'];
  }

  if (raw.user === null || raw.user === undefined) {
    data.user = null;
  } else {
    data.user = sanitizeUser(raw.user);
  }

  if (isRecord(raw.waifu)) {
    const personaKeys = Object.keys(PERSONALITIES);
    const appearance = isRecord(raw.waifu.appearance) ? raw.waifu.appearance : {};
    data.waifu = {
      name: toStr(raw.waifu.name, 'Akari'),
      personality: personaKeys.includes(raw.waifu.personality as string) ? (raw.waifu.personality as string) : 'tsundere',
      appearance: {
        hairstyle: toStr(appearance.hairstyle, 'twintails'),
        hairColor: isHexColor(appearance.hairColor) ? (appearance.hairColor as string) : '#ff7597',
        eyeColor: isHexColor(appearance.eyeColor) ? (appearance.eyeColor as string) : '#4f86f7',
        skinTone: isHexColor(appearance.skinTone) ? (appearance.skinTone as string) : '#fff1eb',
        outfit: toStr(appearance.outfit, 'seifuku'),
        accessory: toStr(appearance.accessory, 'ribbon'),
        customAvatarUrl: toStr(appearance.customAvatarUrl, ''),
        avatarMode: (VALID_AVATAR_MODES as readonly string[]).includes(appearance.avatarMode as string)
          ? (appearance.avatarMode as 'svg' | 'custom')
          : 'svg'
      },
      mood: toStr(raw.waifu.mood, 'neutral'),
      bondLevel: toPositiveInt(raw.waifu.bondLevel, 1),
      bondExp: toNonNegativeNum(raw.waifu.bondExp, 0)
    };
  }

  data.rpg = sanitizeRpg(raw.rpg);

  if (isRecord(raw.calendar)) {
    const events = Array.isArray(raw.calendar.events)
      ? raw.calendar.events.map(sanitizeEvent).filter((e): e is CalendarEventItem => e !== null)
      : [];
    data.calendar = {
      view: (VALID_VIEWS as readonly string[]).includes(raw.calendar.view as string) ? (raw.calendar.view as AppState['calendar']['view']) : 'month',
      selectedDate: validDateString(raw.calendar.selectedDate, nowIso()),
      events,
      filterEvents: toBool(raw.calendar.filterEvents, true),
      filterTasks: toBool(raw.calendar.filterTasks, true),
      filterBirthdays: toBool(raw.calendar.filterBirthdays, true),
      searchQuery: toStr(raw.calendar.searchQuery, '')
    };
  }

  if (isRecord(raw.settings)) {
    data.settings = sanitizeSettings(raw.settings) as AppState['settings'];
  }

  if (isRecord(raw.chat)) {
    const messages = Array.isArray(raw.chat.messages)
      ? raw.chat.messages.map(sanitizeMessage).filter((m): m is ChatMessage => m !== null)
      : [];
    data.chat = {
      messages,
      suggestions: dedupeStrings(raw.chat.suggestions),
      isTyping: toBool(raw.chat.isTyping, false)
    };
  }

  return { data, issues };
}
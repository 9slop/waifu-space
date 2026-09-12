import { state, setState, saveState } from './store';
import en from '../locales/en.json';
import ja from '../locales/ja.json';

export type SupportedLanguage = 'en' | 'ja';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '' }
];

const dictionaries: Record<SupportedLanguage, any> = { en, ja };

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj) return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return typeof curr === 'string' ? curr : undefined;
}

/**
 * Reactive translation function.
 * Tracks state.settings.language reactively in SolidJS components.
 * If key is missing in target language, falls back to English, then to the key string itself.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const currentLang = (state?.settings?.language as SupportedLanguage) || 'en';
  const dict = dictionaries[currentLang] || dictionaries.en;
  
  let val = getNestedValue(dict, key);
  if (val === undefined && currentLang !== 'en') {
    val = getNestedValue(dictionaries.en, key);
  }
  if (val === undefined) {
    return key;
  }

  if (params) {
    for (const [paramKey, paramVal] of Object.entries(params)) {
      val = val.replaceAll(`{${paramKey}}`, String(paramVal));
    }
  }

  return val;
}

export function getLanguage(): SupportedLanguage {
  return (state?.settings?.language as SupportedLanguage) || 'en';
}

export function setLanguage(lang: SupportedLanguage) {
  setState('settings', 'language', lang);
  saveState();
}

export function getLocale(): string {
  return state?.settings?.language === 'ja' ? 'ja-JP' : 'en-US';
}

/** Localized tooltip for read-only holiday pills (country or worldwide cultural). */
export function holidayTooltip(h?: { countryCode: string; culture?: boolean } | null): string {
  const badge = t('calendar.holidays.badge');
  if (h?.culture) return `${t('calendar.holidays.culturalBadge')} · ${badge}`;
  return `${h?.countryCode ?? ''} · ${badge}`;
}

export function formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return d.toLocaleDateString(getLocale(), options);
}

export function formatTime(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return d.toLocaleTimeString(getLocale(), options);
}

export function getCosmeticName(id: string, fallbackName?: string): string {
  const translated = t(`items.${id}.name`);
  if (translated !== `items.${id}.name`) return translated;
  return fallbackName || id;
}

export function getCosmeticDesc(id: string, fallbackDesc?: string): string {
  const translated = t(`items.${id}.desc`);
  if (translated !== `items.${id}.desc`) return translated;
  return fallbackDesc || '';
}

export function getCategoryName(category: string): string {
  const translated = t(`categories.${category}`);
  if (translated !== `categories.${category}`) return translated;
  return category;
}

export function getRarityName(rarity: string): string {
  const translated = t(`rarities.${rarity}`);
  if (translated !== `rarities.${rarity}`) return translated;
  return rarity;
}

export function getPersonalityName(personality: string): string {
  const translated = t(`companion.personalities.${personality}`);
  if (translated !== `companion.personalities.${personality}`) return translated;
  return personality;
}

export function getMilestoneTitle(level: number, fallbackTitle?: string): string {
  const translated = t(`milestones.${level}.title`);
  if (translated !== `milestones.${level}.title`) return translated;
  return fallbackTitle || `Milestone Lv.${level}`;
}

export function getMilestoneDesc(level: number, params?: Record<string, string | number>, fallbackDesc?: string): string {
  const translated = t(`milestones.${level}.desc`, params);
  if (translated !== `milestones.${level}.desc`) return translated;
  return fallbackDesc || '';
}

export function getMilestoneRewardLabel(level: number, fallbackReward?: string): string {
  const translated = t(`milestones.${level}.reward`);
  if (translated !== `milestones.${level}.reward`) return translated;
  return fallbackReward || '';
}

export function getMoodName(mood: string): string {
  const translated = t(`moods.${mood}`);
  if (translated !== `moods.${mood}`) return translated;
  return mood;
}


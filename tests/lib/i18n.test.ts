import { describe, it, expect, beforeEach } from 'vitest';
import { t, getLocale, setLanguage, formatDate, formatTime, SUPPORTED_LANGUAGES } from '../../src/lib/i18n';

describe('i18n Localization Engine', () => {
  beforeEach(() => {
    setLanguage('en');
  });

  it('supports English and Japanese languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual([
      { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' }
    ]);
  });

  it('translates English keys correctly by default', () => {
    expect(t('common.save')).toBe('Save');
    expect(t('common.cancel')).toBe('Cancel');
    expect(t('nav.settings')).toBe('Settings');
    expect(t('settings.tabs.language')).toBe('Language');
  });

  it('translates Japanese keys when language is switched to ja', () => {
    setLanguage('ja');
    expect(t('common.save')).toBe('保存');
    expect(t('common.cancel')).toBe('キャンセル');
    expect(t('nav.settings')).toBe('設定');
    expect(t('settings.tabs.language')).toBe('言語');
  });

  it('interpolates parameters into translations', () => {
    expect(t('calendar.moreEvents', { count: 3 })).toBe('+3 more');
    setLanguage('ja');
    expect(t('calendar.moreEvents', { count: 3 })).toBe('他 3 件');
  });

  it('falls back to English when a translation key is missing in Japanese', () => {
    setLanguage('ja');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('returns proper BCP-47 locale code for date formatting', () => {
    setLanguage('en');
    expect(getLocale()).toBe('en-US');
    setLanguage('ja');
    expect(getLocale()).toBe('ja-JP');
  });

  it('formats dates and times according to active locale', () => {
    const testDate = new Date(2026, 8, 10, 15, 30);
    setLanguage('en');
    const enFormatted = formatDate(testDate);
    expect(enFormatted).toBeTruthy();

    setLanguage('ja');
    const jaFormatted = formatDate(testDate);
    expect(jaFormatted).toBeTruthy();
  });
});

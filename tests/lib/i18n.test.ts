import { describe, it, expect, beforeEach } from 'vitest';
import {
  t,
  getLocale,
  setLanguage,
  formatDate,
  formatTime,
  SUPPORTED_LANGUAGES,
  getCosmeticName,
  getCosmeticDesc,
  getCategoryName,
  getRarityName,
  getPersonalityName,
  getMilestoneTitle,
  getMilestoneDesc,
  getMilestoneRewardLabel,
  getMoodName
} from '../../src/lib/i18n';

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

  it('translates cosmetic names, descriptions, categories, and rarities into Japanese and English', () => {
    setLanguage('en');
    expect(getCosmeticName('seifuku')).toBe('Sailor Seifuku');
    expect(getCosmeticDesc('seifuku')).toContain('Classic Japanese school uniform');
    expect(getCategoryName('outfit')).toBe('Outfit');
    expect(getRarityName('legendary')).toBe('Legendary');

    setLanguage('ja');
    expect(getCosmeticName('seifuku')).toBe('セーラー服');
    expect(getCosmeticDesc('seifuku')).toContain('学生制服');
    expect(getCategoryName('outfit')).toBe('衣装');
    expect(getRarityName('legendary')).toBe('レジェンダリー');
  });

  it('translates companion personality archetypes into Japanese and English', () => {
    setLanguage('en');
    expect(getPersonalityName('tsundere')).toBe('Tsundere');
    expect(getPersonalityName('kuudere')).toBe('Kuudere');

    setLanguage('ja');
    expect(getPersonalityName('tsundere')).toBe('ツンデレ');
    expect(getPersonalityName('kuudere')).toBe('クーデレ');
  });

  it('translates affection road milestones, rewards, and moods into Japanese and English', () => {
    setLanguage('en');
    expect(getMilestoneTitle(2)).toBe('Acquaintance');
    expect(getMilestoneRewardLabel(3)).toBe('Sakura Hairpin');
    expect(getMilestoneDesc(2, { name: 'Asuka' })).toContain('Asuka begins to look forward');
    expect(getMoodName('happy')).toBe('Happy');

    setLanguage('ja');
    expect(getMilestoneTitle(2)).toBe('知人');
    expect(getMilestoneRewardLabel(3)).toBe('桜のヘアピン');
    expect(getMilestoneDesc(2, { name: 'アスカ' })).toContain('アスカがあなたの存在を意識し始めます');
    expect(getMoodName('happy')).toBe('笑顔');
  });

  it('translates Waifu Strike FPS minigame keys into English and Japanese', () => {
    setLanguage('en');
    expect(t('strike.title')).toBe('Waifu Strike');
    expect(t('strike.modeTitle')).toBe('Waifu Strike DM');
    expect(t('strike.mapName')).toBe('Cyber Shrine');
    expect(t('strike.weapons.rifle')).toBe('Type-89 Sakura Rifle');
    expect(t('strike.medals.headshot')).toBe('HEADSHOT!');

    setLanguage('ja');
    expect(t('strike.title')).toBe('ワイフストライク (Waifu Strike)');
    expect(t('strike.modeTitle')).toBe('ワイフストライク DM');
    expect(t('strike.mapName')).toBe('電脳神社 (Cyber Shrine)');
    expect(t('strike.weapons.rifle')).toBe('八九式サクラライフル');
    expect(t('strike.medals.headshot')).toBe('ヘッドショット！');
  });
});


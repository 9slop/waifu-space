import { createSignal, For, Show } from 'solid-js';
import { state, COSMETIC_CATALOG, RpgCosmeticItem, showToast } from '../lib/store';
import { t } from '../lib/i18n';
import { WaifuAvatar } from './WaifuAvatar';

export function ProfileShowcase() {
  const [copiedLink, setCopiedLink] = createSignal(false);

  const currentUser = () => {
    return state.user || {
      id: 'local_commander',
      username: 'SenpaiCommander',
      bio: t('profile.defaultBio'),
      avatarUrl: ''
    };
  };

  const getRarityClass = (rarity: string) => {
    switch (rarity) {
      case 'mystical': return 'rarity-mystical';
      case 'legendary': return 'rarity-legendary';
      case 'epic': return 'rarity-epic';
      case 'rare': return 'rarity-rare';
      default: return 'rarity-common';
    }
  };

  const showcaseItems = () => {
    return (state.rpg?.showcaseItems || []).map(id => COSMETIC_CATALOG.find(c => c.id === id)).filter(Boolean) as RpgCosmeticItem[];
  };

  const shareProfile = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/profile?user=${encodeURIComponent(currentUser().username)}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        showToast(t('profile.shareToast') || 'Profile link copied to clipboard!');
        setTimeout(() => setCopiedLink(false), 3000);
      });
    }
  };

  return (
    <div class="profile-showcase-container" data-testid="profile-showcase">
      {/* PROFILE HEADER HERO */}
      <div class="profile-hero-card">
        <div class="profile-avatar-wrapper">
          <div class="profile-avatar-circle">
            <span class="profile-avatar-emoji">🌸</span>
          </div>
          <div class="profile-badge-tier">
            <span>Lv. {state.waifu?.bondLevel || 1}</span>
          </div>
        </div>

        <div class="profile-main-info">
          <div class="profile-name-row">
            <h2>{currentUser().username}</h2>
            <button class="btn-share-profile" onClick={shareProfile}>
              {copiedLink() ? '✓ ' + t('common.done') : '🔗 ' + t('profile.share')}
            </button>
          </div>
          <p class="profile-bio">{currentUser().bio || t('profile.defaultBio')}</p>

          <div class="profile-stats-row">
            <div class="p-stat">
              <span class="p-stat-val">🪙 {state.rpg?.coins ?? 0}</span>
              <span class="p-stat-lbl">{t('rpg.dashboard.goldCoins')}</span>
            </div>
            <div class="p-stat">
              <span class="p-stat-val">🛡️ Wave {state.rpg?.defenseHighWave ?? 0}</span>
              <span class="p-stat-lbl">{t('rpg.dashboard.defenseHighScore')}</span>
            </div>
            <div class="p-stat">
              <span class="p-stat-val">👹 {state.rpg?.defenseStats?.goblinsDefeated ?? 0}</span>
              <span class="p-stat-lbl">{t('profile.goblinsKilled')}</span>
            </div>
            <div class="p-stat">
              <span class="p-stat-val">💖 Lv.{state.waifu?.bondLevel ?? 1}</span>
              <span class="p-stat-lbl">{t('companion.affectionLevel')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN: SHOWCASE DISPLAY CASE + WAIFU AVATAR */}
      <div class="profile-content-columns">
        {/* PUBLIC SHOWCASE CASE */}
        <div class="profile-showcase-box">
          <div class="box-header">
            <h3>🏆 {t('profile.showcaseTitle')}</h3>
            <span class="showcase-counter">{showcaseItems().length} / 6</span>
          </div>
          <p class="box-desc">{t('profile.showcaseDesc')}</p>

          <div class="profile-pedestals-grid">
            <For each={[0, 1, 2, 3, 4, 5]}>
              {index => {
                const item = () => showcaseItems()[index];
                return (
                  <div
                    class={`profile-pedestal ${item() ? getRarityClass(item()!.rarity) : 'empty'}`}
                    data-testid={`profile-showcase-slot-${index}`}
                  >
                    <Show when={item()} fallback={
                      <div class="pedestal-placeholder">
                        <span class="slot-num">#{index + 1}</span>
                        <span class="empty-hint">{t('profile.emptyShowcaseSlot')}</span>
                      </div>
                    }>
                      <div class="pedestal-filled">
                        <div class="pedestal-icon-wrapper">
                          <span class="pedestal-icon">{item()!.icon}</span>
                          <span class={`pedestal-rarity-chip ${getRarityClass(item()!.rarity)}`}>
                            {item()!.rarity}
                          </span>
                        </div>
                        <div class="pedestal-info">
                          <span class="pedestal-name">{item()!.name}</span>
                          <span class="pedestal-cat">{item()!.category}</span>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* COMPANION CARD */}
        <div class="profile-companion-card">
          <div class="box-header">
            <h3>✨ {t('profile.companionTitle')}</h3>
            <span class="companion-tag">{state.waifu?.name || 'Akari'}</span>
          </div>
          <div class="profile-waifu-preview">
            <WaifuAvatar
              appearance={state.waifu?.appearance}
              mood={state.waifu?.currentMood}
              scale={1.2}
            />
          </div>
          <div class="companion-details">
            <p><strong>{t('companion.personality')}:</strong> {state.waifu?.personality || 'tsundere'}</p>
            <p><strong>{t('companion.affectionLevel')}:</strong> {state.waifu?.bondLevel || 1}</p>
            <p><strong>{t('profile.currentOutfit')}:</strong> {state.waifu?.appearance?.outfit || 'seifuku'}</p>
            <p><strong>{t('profile.currentAccessory')}:</strong> {state.waifu?.appearance?.accessory || 'none'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

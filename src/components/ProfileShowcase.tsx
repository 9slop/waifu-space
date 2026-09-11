import { createSignal, createEffect, For, Show, onMount } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import {
  state,
  setState,
  saveState,
  COSMETIC_CATALOG,
  RpgCosmeticItem,
  showToast,
  isCosmeticUnlocked,
  toggleShowcaseItem,
  getUnlockedCosmeticsCount
} from '../lib/store';
import { t } from '../lib/i18n';
import { WaifuAvatar } from './WaifuAvatar';
import { SettingsStudio } from './SettingsStudio';

interface PublicProfileData {
  id: string;
  username: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
  stats: {
    coins: number;
    defenseHighWave: number;
    goblinsDefeated: number;
    totalVictories: number;
    bondLevel: number;
    cosmeticsUnlocked: number;
  };
  waifu: {
    name: string;
    personality: string;
    appearance: Record<string, any>;
  };
  showcaseItems: string[];
}

function getUrlParam(key: string): string | null {
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      return new URLSearchParams(window.location.search).get(key);
    } catch {
      return null;
    }
  }
  return null;
}

export function ProfileShowcase() {
  const [urlUser, setUrlUser] = createSignal<string | null>(getUrlParam('user') || getUrlParam('username'));
  const [copiedLink, setCopiedLink] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'showcase' | 'wardrobe' | 'inventory' | 'stats' | 'settings'>('showcase');

  const targetUser = () => {
    try {
      const [sp] = useSearchParams();
      return sp.user || sp.username || urlUser();
    } catch {
      return urlUser();
    }
  };

  const clearTargetUser = () => {
    setUrlUser(null);
    try {
      const [, ssp] = useSearchParams();
      ssp({ user: undefined, username: undefined });
    } catch {
      if (typeof window !== 'undefined' && window.history) {
        const url = new URL(window.location.href);
        url.searchParams.delete('user');
        url.searchParams.delete('username');
        window.history.replaceState({}, '', url.toString());
      }
    }
  };

  // Filters for Wardrobe & Inventory
  const [filterCategory, setFilterCategory] = createSignal<'all' | 'outfit' | 'accessory' | 'hairstyle'>('all');
  const [inventoryRarityFilter, setInventoryRarityFilter] = createSignal<'all' | 'common' | 'rare' | 'epic' | 'legendary' | 'mystical'>('all');

  // Public Profile Viewer state
  const [publicProfile, setPublicProfile] = createSignal<PublicProfileData | null>(null);
  const [isLoadingPublic, setIsLoadingPublic] = createSignal(false);
  const [publicError, setPublicError] = createSignal('');

  // Settings tab form state
  const [editBio, setEditBio] = createSignal('');
  const [editAvatarUrl, setEditAvatarUrl] = createSignal('');
  const [showFullSettings, setShowFullSettings] = createSignal(false);

  const isViewingPublic = () => {
    const target = targetUser();
    if (!target) return false;
    if (state.user && state.user.username.toLowerCase() === target.toLowerCase()) return false;
    return true;
  };

  createEffect(() => {
    const target = targetUser();
    if (isViewingPublic() && target) {
      fetchPublicProfile(target);
    } else {
      setPublicProfile(null);
      setPublicError('');
    }
  });

  onMount(() => {
    if (state.user) {
      setEditBio(state.user.bio || '');
      setEditAvatarUrl(state.user.avatarUrl || '');
    }
  });

  const fetchPublicProfile = async (username: string) => {
    setIsLoadingPublic(true);
    setPublicError('');
    try {
      const res = await fetch(`/api/profile?user=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (res.ok && data.success && data.profile) {
        setPublicProfile(data.profile);
      } else {
        setPublicError(data.error || t('profile.userNotFound'));
      }
    } catch {
      setPublicError(t('profile.userNotFound'));
    } finally {
      setIsLoadingPublic(false);
    }
  };

  const currentUser = () => {
    if (isViewingPublic() && publicProfile()) {
      return {
        id: publicProfile()!.id,
        username: publicProfile()!.username,
        bio: publicProfile()!.bio || t('profile.defaultBio'),
        avatarUrl: publicProfile()!.avatarUrl || ''
      };
    }
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
    if (isViewingPublic() && publicProfile()) {
      return (publicProfile()!.showcaseItems || [])
        .map(id => COSMETIC_CATALOG.find(c => c.id === id))
        .filter(Boolean) as RpgCosmeticItem[];
    }
    return (state.rpg?.showcaseItems || [])
      .map(id => COSMETIC_CATALOG.find(c => c.id === id))
      .filter(Boolean) as RpgCosmeticItem[];
  };

  const filteredCatalog = () => {
    if (filterCategory() === 'all') return COSMETIC_CATALOG;
    return COSMETIC_CATALOG.filter(item => item.category === filterCategory());
  };

  const ownedItems = () => {
    return COSMETIC_CATALOG.filter(item => {
      if (item.id === 'none') return false;
      if (!isCosmeticUnlocked(item.id)) return false;
      if (inventoryRarityFilter() !== 'all' && item.rarity !== inventoryRarityFilter()) return false;
      if (filterCategory() !== 'all' && item.category !== filterCategory()) return false;
      return true;
    });
  };

  const equipCosmetic = (item: RpgCosmeticItem) => {
    if (!isCosmeticUnlocked(item.id)) {
      showToast(t('rpg.toasts.lockedItem'));
      return;
    }

    if (item.category === 'outfit') {
      setState('waifu', 'appearance', 'outfit', item.id);
      showToast(t('rpg.toasts.equippedOutfit', { name: item.name }));
    } else if (item.category === 'accessory') {
      setState('waifu', 'appearance', 'accessory', item.id);
      showToast(t('rpg.toasts.equippedAccessory', { name: item.name }));
    } else if (item.category === 'hairstyle') {
      setState('waifu', 'appearance', 'hairstyle', item.id);
      showToast(t('rpg.toasts.equippedHairstyle', { name: item.name }));
    }
    saveState();
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

  const handleSaveProfileSettings = () => {
    if (state.user) {
      setState('user', 'bio', editBio());
      setState('user', 'avatarUrl', editAvatarUrl());
      saveState();
      showToast(t('settings.appearance.customSpriteUpdated') || 'Profile updated successfully!');
    }
  };

  const handleCustomAvatarUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = evt => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        setEditAvatarUrl(dataUrl);
        if (state.user) {
          setState('user', 'avatarUrl', dataUrl);
          saveState();
        }
        showToast(t('settings.appearance.customSpriteUpdated') || 'Avatar sprite updated!');
      }
    };
    reader.readAsDataURL(file);
  };

  const waifuInfo = () => {
    if (isViewingPublic() && publicProfile()) {
      return publicProfile()!.waifu;
    }
    return {
      name: state.waifu?.name || 'Akari',
      personality: state.waifu?.personality || 'tsundere',
      appearance: state.waifu?.appearance || {}
    };
  };

  const statsInfo = () => {
    if (isViewingPublic() && publicProfile()) {
      return publicProfile()!.stats;
    }
    return {
      coins: state.rpg?.coins ?? 0,
      defenseHighWave: state.rpg?.defenseHighWave ?? 0,
      goblinsDefeated: state.rpg?.defenseStats?.goblinsDefeated ?? 0,
      totalVictories: state.rpg?.defenseStats?.totalVictories ?? 0,
      bondLevel: state.waifu?.bondLevel ?? 1,
      cosmeticsUnlocked: getUnlockedCosmeticsCount()
    };
  };

  return (
    <div class="profile-showcase-container" data-testid="profile-showcase">
      {/* PUBLIC PROFILE BANNER (when visiting someone else's page) */}
      <Show when={isViewingPublic()}>
        <div class="public-profile-banner">
          <span>👀 {t('profile.publicProfileOf', { name: targetUser() })}</span>
          <button
            class="btn-back-profile"
            onClick={clearTargetUser}
          >
            ← {t('profile.backToMyProfile')}
          </button>
        </div>
      </Show>

      {/* ERROR / LOADING STATE FOR PUBLIC PROFILE */}
      <Show when={isViewingPublic() && isLoadingPublic()}>
        <div class="profile-loading-box">
          <span>🌸 Loading profile for @{targetUser()}...</span>
        </div>
      </Show>

      <Show when={isViewingPublic() && publicError()}>
        <div class="profile-error-box">
          <p>⚠️ {publicError()}</p>
          <button
            class="btn-back-profile"
            onClick={clearTargetUser}
          >
            {t('profile.backToMyProfile')}
          </button>
        </div>
      </Show>

      {/* MAIN PROFILE VIEW (shown when own profile or public profile loaded) */}
      <Show when={!isViewingPublic() || (publicProfile() && !isLoadingPublic())}>
        {/* PROFILE HEADER HERO */}
        <div class="profile-hero-card">
          <div class="profile-avatar-wrapper">
            <div class="profile-avatar-circle">
              <Show when={currentUser().avatarUrl} fallback={<span class="profile-avatar-emoji">🌸</span>}>
                <img src={currentUser().avatarUrl} alt={currentUser().username} class="profile-avatar-img" />
              </Show>
            </div>
            <div class="profile-badge-tier">
              <span>Lv. {statsInfo().bondLevel}</span>
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
                <span class="p-stat-val">🪙 {statsInfo().coins}</span>
                <span class="p-stat-lbl">{t('rpg.dashboard.goldCoins')}</span>
              </div>
              <div class="p-stat">
                <span class="p-stat-val">🛡️ Wave {statsInfo().defenseHighWave}</span>
                <span class="p-stat-lbl">{t('rpg.dashboard.defenseHighScore')}</span>
              </div>
              <div class="p-stat">
                <span class="p-stat-val">👹 {statsInfo().goblinsDefeated}</span>
                <span class="p-stat-lbl">{t('profile.goblinsKilled')}</span>
              </div>
              <div class="p-stat">
                <span class="p-stat-val">💖 Lv.{statsInfo().bondLevel}</span>
                <span class="p-stat-lbl">{t('companion.affectionLevel')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PROFILE NAVIGATION TABS (Own profile only) */}
        <Show when={!isViewingPublic()}>
          <div class="profile-tabs-nav" data-testid="profile-tabs-nav">
            <button
              class={`p-tab-btn ${activeTab() === 'showcase' ? 'active' : ''}`}
              onClick={() => setActiveTab('showcase')}
            >
              <span>🏆</span>
              <span>{t('profile.tabs.showcase')}</span>
            </button>
            <button
              class={`p-tab-btn ${activeTab() === 'wardrobe' ? 'active' : ''}`}
              onClick={() => setActiveTab('wardrobe')}
            >
              <span>👗</span>
              <span>{t('profile.tabs.wardrobe')}</span>
            </button>
            <button
              class={`p-tab-btn ${activeTab() === 'inventory' ? 'active' : ''}`}
              data-testid="profile-tab-inventory"
              onClick={() => setActiveTab('inventory')}
            >
              <span>🎒</span>
              <span>{t('profile.tabs.inventory')}</span>
            </button>
            <button
              class={`p-tab-btn ${activeTab() === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              <span>📊</span>
              <span>{t('profile.tabs.statistics')}</span>
            </button>
            <button
              class={`p-tab-btn ${activeTab() === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span>⚙️</span>
              <span>{t('profile.tabs.settings')}</span>
            </button>
          </div>
        </Show>

        {/* TAB 1: SHOWCASE & COMPANION PREVIEW (Also shown in public view) */}
        <Show when={isViewingPublic() || activeTab() === 'showcase'}>
          <div class="profile-content-columns">
            {/* PUBLIC SHOWCASE PEDESTALS */}
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
                            <Show when={!isViewingPublic()}>
                              <button
                                class="btn-remove-showcase"
                                title="Remove from showcase"
                                onClick={() => toggleShowcaseItem(item()!.id)}
                              >
                                ✕
                              </button>
                            </Show>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* COMPANION LIVE CARD */}
            <div class="profile-companion-card">
              <div class="box-header">
                <h3>✨ {t('profile.companionTitle')}</h3>
                <span class="companion-tag">{waifuInfo().name}</span>
              </div>
              <div class="profile-waifu-preview">
                <WaifuAvatar
                  appearance={waifuInfo().appearance}
                  mood="happy"
                  scale={1.2}
                />
              </div>
              <div class="companion-details">
                <p><strong>{t('companion.personality')}:</strong> {waifuInfo().personality}</p>
                <p><strong>{t('companion.affectionLevel')}:</strong> {statsInfo().bondLevel}</p>
                <p><strong>{t('profile.currentOutfit')}:</strong> {waifuInfo().appearance?.outfit || 'seifuku'}</p>
                <p><strong>{t('profile.currentAccessory')}:</strong> {waifuInfo().appearance?.accessory || 'none'}</p>
                <p><strong>{t('profile.currentHairstyle')}:</strong> {waifuInfo().appearance?.hairstyle || 'twintails'}</p>
              </div>
            </div>
          </div>
        </Show>

        {/* TAB 2: WARDROBE (Own profile only) */}
        <Show when={!isViewingPublic() && activeTab() === 'wardrobe'}>
          <div class="tab-pane wardrobe-pane">
            <div class="wardrobe-layout">
              {/* CATALOG GRID */}
              <div class="wardrobe-catalog">
                <div class="catalog-filters">
                  <button
                    class={`filter-btn ${filterCategory() === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterCategory('all')}
                  >
                    {t('rpg.wardrobe.allItems')}
                  </button>
                  <button
                    class={`filter-btn ${filterCategory() === 'outfit' ? 'active' : ''}`}
                    onClick={() => setFilterCategory('outfit')}
                  >
                    {t('rpg.wardrobe.outfits')}
                  </button>
                  <button
                    class={`filter-btn ${filterCategory() === 'accessory' ? 'active' : ''}`}
                    onClick={() => setFilterCategory('accessory')}
                  >
                    {t('rpg.wardrobe.accessories')}
                  </button>
                  <button
                    class={`filter-btn ${filterCategory() === 'hairstyle' ? 'active' : ''}`}
                    onClick={() => setFilterCategory('hairstyle')}
                  >
                    {t('rpg.wardrobe.hairstyles')}
                  </button>
                </div>

                <div class="cosmetics-grid">
                  <For each={filteredCatalog()}>
                    {item => {
                      const unlocked = () => isCosmeticUnlocked(item.id);
                      const isEquipped = () =>
                        (item.category === 'outfit' && state.waifu?.appearance?.outfit === item.id) ||
                        (item.category === 'accessory' && state.waifu?.appearance?.accessory === item.id) ||
                        (item.category === 'hairstyle' && state.waifu?.appearance?.hairstyle === item.id);

                      return (
                        <div class={`cosmetic-card ${getRarityClass(item.rarity)} ${unlocked() ? 'unlocked' : 'locked'}`}>
                          <div class="cosmetic-icon-wrap">
                            <span class="cosmetic-icon">{item.icon}</span>
                            <span class={`rarity-pill ${getRarityClass(item.rarity)}`}>
                              {item.rarity}
                            </span>
                          </div>

                          <div class="cosmetic-details">
                            <h4 class="cosmetic-name">{item.name}</h4>
                            <p class="cosmetic-desc">{item.description}</p>
                            <small class="cosmetic-source">Unlock: {item.description}</small>
                          </div>

                          <div class="cosmetic-btn-wrap">
                            <Show when={unlocked()}>
                              <button
                                class={`btn-equip ${isEquipped() ? 'equipped' : ''}`}
                                disabled={isEquipped()}
                                onClick={() => equipCosmetic(item)}
                              >
                                {isEquipped() ? t('rpg.wardrobe.equipped') : t('rpg.wardrobe.equip')}
                              </button>
                            </Show>
                            <Show when={!unlocked()}>
                              <span class="locked-badge">🔒 {t('rpg.wardrobe.locked')}</span>
                            </Show>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>

              {/* LIVE WAIFU PREVIEW */}
              <div class="wardrobe-preview-panel">
                <h3>{t('rpg.wardrobe.livePreview')}</h3>
                <div class="preview-avatar-box">
                  <WaifuAvatar scale={1.1} />
                </div>
                <div class="preview-active-specs">
                  <div><strong>{t('rpg.wardrobe.outfitLabel')}:</strong> {state.waifu?.appearance?.outfit || 'seifuku'}</div>
                  <div><strong>{t('rpg.wardrobe.accessoryLabel')}:</strong> {state.waifu?.appearance?.accessory || 'none'}</div>
                  <div><strong>{t('rpg.wardrobe.hairstyleLabel')}:</strong> {state.waifu?.appearance?.hairstyle || 'twintails'}</div>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* TAB 3: INVENTORY (Own profile only) */}
        <Show when={!isViewingPublic() && activeTab() === 'inventory'}>
          <div class="tab-pane inventory-pane" data-testid="inventory-pane">
            <div class="inventory-header-banner">
              <div>
                <h2>🎒 {t('rpg.inventory.title', { count: ownedItems().length })}</h2>
                <p>{t('rpg.inventory.subtitle')}</p>
              </div>
              <div class="showcase-summary-pill">
                <span>🏆 {t('rpg.inventory.showcaseSlots')}:</span>
                <strong>{(state.rpg?.showcaseItems || []).length} / 6</strong>
              </div>
            </div>

            {/* SHOWCASE DISPLAY CASE */}
            <div class="inventory-showcase-section">
              <div class="showcase-section-title">
                <h3>✨ {t('rpg.inventory.featuredShowcase')}</h3>
                <small>{t('rpg.inventory.showcaseHint')}</small>
              </div>

              <div class="showcase-slots-grid">
                <For each={[0, 1, 2, 3, 4, 5]}>
                  {index => {
                    const showcaseItemId = () => (state.rpg?.showcaseItems || [])[index];
                    const showcaseItem = () => showcaseItemId() ? COSMETIC_CATALOG.find(c => c.id === showcaseItemId()) : null;

                    return (
                      <div
                        class={`showcase-pedestal ${showcaseItem() ? getRarityClass(showcaseItem()!.rarity) : 'empty-slot'}`}
                        data-testid={`showcase-pedestal-${index}`}
                      >
                        <Show when={showcaseItem()} fallback={
                          <div class="empty-slot-content">
                            <span class="slot-num">#{index + 1}</span>
                            <small>{t('rpg.inventory.emptySlot')}</small>
                          </div>
                        }>
                          {item => (
                            <div class="showcase-item-content">
                              <span class="showcase-slot-icon">{item().icon}</span>
                              <div class="showcase-item-info">
                                <strong>{item().name}</strong>
                                <span class={`rarity-pill ${getRarityClass(item().rarity)}`}>{item().rarity}</span>
                              </div>
                              <button
                                class="btn-remove-showcase"
                                title="Remove from showcase"
                                onClick={() => toggleShowcaseItem(item().id)}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* INVENTORY FILTERS */}
            <div class="inventory-filters-row">
              <div class="category-filter-group">
                <span class="filter-group-label">{t('rpg.inventory.category')}:</span>
                <button
                  class={`filter-btn ${filterCategory() === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterCategory('all')}
                >
                  {t('rpg.wardrobe.allItems')}
                </button>
                <button
                  class={`filter-btn ${filterCategory() === 'outfit' ? 'active' : ''}`}
                  onClick={() => setFilterCategory('outfit')}
                >
                  {t('rpg.wardrobe.outfits')}
                </button>
                <button
                  class={`filter-btn ${filterCategory() === 'accessory' ? 'active' : ''}`}
                  onClick={() => setFilterCategory('accessory')}
                >
                  {t('rpg.wardrobe.accessories')}
                </button>
                <button
                  class={`filter-btn ${filterCategory() === 'hairstyle' ? 'active' : ''}`}
                  onClick={() => setFilterCategory('hairstyle')}
                >
                  {t('rpg.wardrobe.hairstyles')}
                </button>
              </div>

              <div class="rarity-filter-group">
                <span class="filter-group-label">{t('rpg.inventory.rarity')}:</span>
                {(['all', 'common', 'rare', 'epic', 'legendary', 'mystical'] as const).map(rarity => (
                  <button
                    class={`filter-btn filter-btn-rarity ${inventoryRarityFilter() === rarity ? 'active' : ''} ${rarity !== 'all' ? getRarityClass(rarity) : ''}`}
                    onClick={() => setInventoryRarityFilter(rarity)}
                  >
                    {rarity.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* OWNED ITEMS GRID */}
            <div class="inventory-items-grid">
              <Show when={ownedItems().length === 0}>
                <div class="empty-inventory-notice">
                  <span>📦</span>
                  <p>{t('rpg.inventory.noItemsFound')}</p>
                </div>
              </Show>

              <For each={ownedItems()}>
                {item => {
                  const inShowcase = () => (state.rpg?.showcaseItems || []).includes(item.id);
                  const isEquipped = () =>
                    (item.category === 'outfit' && state.waifu?.appearance?.outfit === item.id) ||
                    (item.category === 'accessory' && state.waifu?.appearance?.accessory === item.id) ||
                    (item.category === 'hairstyle' && state.waifu?.appearance?.hairstyle === item.id);

                  return (
                    <div class={`inventory-item-card ${getRarityClass(item.rarity)}`}>
                      <div class="card-top-row">
                        <span class="item-icon-big">{item.icon}</span>
                        <span class={`rarity-tag ${getRarityClass(item.rarity)}`}>{item.rarity}</span>
                      </div>

                      <div class="item-title-group">
                        <strong class="item-name">{item.name}</strong>
                        <p class="item-desc">{item.description}</p>
                      </div>

                      <div class="item-actions-row">
                        <button
                          class={`btn-equip-item ${isEquipped() ? 'equipped' : ''}`}
                          disabled={isEquipped()}
                          onClick={() => equipCosmetic(item)}
                        >
                          {isEquipped() ? `✨ ${t('common.equipped')}` : t('common.equip')}
                        </button>

                        <button
                          class={`btn-toggle-showcase ${inShowcase() ? 'active' : ''}`}
                          onClick={() => toggleShowcaseItem(item.id)}
                          title={inShowcase() ? 'Remove from Showcase' : 'Feature in Showcase'}
                        >
                          {inShowcase() ? '🏆 ' + t('rpg.inventory.featured') : '⭐ ' + t('rpg.inventory.showcaseBtn')}
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* TAB 4: STATISTICS (Own profile only) */}
        <Show when={!isViewingPublic() && activeTab() === 'stats'}>
          <div class="profile-stats-pane">
            <div class="stats-overview-grid">
              <div class="stats-card">
                <span class="stats-card-icon">🪙</span>
                <div class="stats-card-info">
                  <h3>{statsInfo().coins}</h3>
                  <p>{t('rpg.dashboard.goldCoins')}</p>
                </div>
              </div>
              <div class="stats-card">
                <span class="stats-card-icon">🛡️</span>
                <div class="stats-card-info">
                  <h3>Wave {statsInfo().defenseHighWave}</h3>
                  <p>{t('rpg.dashboard.defenseHighScore')}</p>
                </div>
              </div>
              <div class="stats-card">
                <span class="stats-card-icon">👹</span>
                <div class="stats-card-info">
                  <h3>{statsInfo().goblinsDefeated}</h3>
                  <p>{t('profile.goblinsKilled')}</p>
                </div>
              </div>
              <div class="stats-card">
                <span class="stats-card-icon">⚔️</span>
                <div class="stats-card-info">
                  <h3>{statsInfo().totalVictories}</h3>
                  <p>Defense Victories</p>
                </div>
              </div>
              <div class="stats-card">
                <span class="stats-card-icon">💖</span>
                <div class="stats-card-info">
                  <h3>Lv. {statsInfo().bondLevel}</h3>
                  <p>{t('companion.affectionLevel')}</p>
                </div>
              </div>
              <div class="stats-card">
                <span class="stats-card-icon">👗</span>
                <div class="stats-card-info">
                  <h3>{statsInfo().cosmeticsUnlocked} / {COSMETIC_CATALOG.length}</h3>
                  <p>{t('rpg.dashboard.cosmeticsUnlocked')}</p>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* TAB 5: SETTINGS (Own profile only) */}
        <Show when={!isViewingPublic() && activeTab() === 'settings'}>
          <div class="profile-settings-pane">
            <div class="profile-edit-card">
              <h3>⚙️ {t('profile.editProfile')}</h3>
              
              <div class="setting-row">
                <div class="setting-label">
                  <label>{t('profile.displayName')}</label>
                  <small>Your public commander handle</small>
                </div>
                <input
                  type="text"
                  class="profile-input"
                  value={currentUser().username}
                  disabled={true}
                  title="Username is permanent"
                />
              </div>

              <div class="setting-row">
                <div class="setting-label">
                  <label>{t('profile.bio')}</label>
                  <small>A brief description displayed to other players</small>
                </div>
                <textarea
                  class="profile-textarea"
                  value={editBio()}
                  onInput={e => setEditBio(e.currentTarget.value)}
                  placeholder={t('profile.defaultBio')}
                  rows={3}
                />
              </div>

              <div class="setting-row">
                <div class="setting-label">
                  <label>{t('profile.avatar')}</label>
                  <small>Custom avatar image file or web URL</small>
                </div>
                <div class="avatar-upload-group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomAvatarUpload}
                  />
                  <input
                    type="text"
                    class="profile-input"
                    placeholder="https://..."
                    value={editAvatarUrl()}
                    onInput={e => setEditAvatarUrl(e.currentTarget.value)}
                  />
                </div>
              </div>

              <div class="profile-edit-actions">
                <button class="btn-save-profile" onClick={handleSaveProfileSettings}>
                  💾 Save Profile Changes
                </button>
                <button
                  class="btn-toggle-app-settings"
                  onClick={() => setShowFullSettings(!showFullSettings())}
                >
                  {showFullSettings() ? '▲ Hide Full App Settings' : '▼ Open App Settings (Theme, Wallpaper, Voice)'}
                </button>
              </div>
            </div>

            {/* EXPANDABLE FULL APP SETTINGS */}
            <Show when={showFullSettings()}>
              <div class="embedded-settings-studio">
                <SettingsStudio />
              </div>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}

import { createSignal, Show, For } from 'solid-js';
import {
  state,
  setState,
  COSMETIC_CATALOG,
  AFFECTION_MILESTONES,
  claimAffectionReward,
  isCosmeticUnlocked,
  toggleShowcaseItem,
  getUnlockedCosmeticsCount,
  getBondExpNeeded,
  showToast,
  RpgCosmeticItem
} from '../lib/store';
import { WaifuDefenseGame } from './WaifuDefenseGame';
import { LootboxModal } from './LootboxModal';
import { WaifuAvatar } from './WaifuAvatar';
import { t } from '../lib/i18n';

export function RpgHub() {
  const [activeTab, setActiveTab] = createSignal<'defense' | 'gacha' | 'affection' | 'wardrobe' | 'inventory'>('defense');
  const [filterCategory, setFilterCategory] = createSignal<'all' | 'outfit' | 'accessory' | 'hairstyle'>('all');
  const [inventoryRarityFilter, setInventoryRarityFilter] = createSignal<'all' | 'common' | 'rare' | 'epic' | 'legendary' | 'mystical'>('all');

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

  const currentCoins = () => state.rpg?.coins ?? 0;
  const currentHighWave = () => state.rpg?.defenseHighWave ?? 0;
  const unlockedCount = () => getUnlockedCosmeticsCount();

  return (
    <div class="rpg-hub-container">
      {/* RPG TOP STATS DASHBOARD */}
      <div class="rpg-dashboard-header">
        <div class="rpg-profile-card">
          <div class="rpg-avatar-small">
            <span class="avatar-ring-icon">🌸</span>
          </div>
          <div class="rpg-profile-info">
            <h3>{state.waifu?.name || 'Companion'}</h3>
            <div class="rpg-bars-group">
              <div class="rpg-bar-item">
                <div class="bar-header">
                  <span>🌟 {t('rpg.dashboard.bondLevel', { level: state.waifu?.bondLevel || 1 })}</span>
                  <small>{state.waifu?.bondExp || 0} / {getBondExpNeeded(state.waifu?.bondLevel || 1)} XP</small>
                </div>
                <div class="stat-progress-bar">
                  <div
                    class="progress-fill exp-fill"
                    style={{ width: `${Math.min(100, ((state.waifu?.bondExp || 0) / getBondExpNeeded(state.waifu?.bondLevel || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div class="rpg-bar-item">
                <div class="bar-header">
                  <span>💖 {t('rpg.dashboard.affectionLevel', { level: state.waifu?.bondLevel || 1 })}</span>
                  <small>{t('rpg.dashboard.unlockedTier', { current: state.rpg?.claimedAffectionMilestones?.length || 0, total: AFFECTION_MILESTONES.length })}</small>
                </div>
                <div class="stat-progress-bar">
                  <div
                    class="progress-fill affection-fill"
                    style={{ width: `${Math.min(100, ((state.rpg?.claimedAffectionMilestones?.length || 0) / AFFECTION_MILESTONES.length) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="rpg-stats-grid">
          <div class="rpg-stat-chip">
            <span class="chip-icon">🪙</span>
            <div class="chip-content">
              <span class="chip-label">{t('rpg.dashboard.goldCoins')}</span>
              <strong class="chip-val">{currentCoins()}</strong>
            </div>
          </div>

          <div class="rpg-stat-chip">
            <span class="chip-icon">🛡️</span>
            <div class="chip-content">
              <span class="chip-label">{t('rpg.dashboard.defenseHighScore')}</span>
              <strong class="chip-val">{t('rpg.dashboard.defenseScoreWave', { wave: currentHighWave() })}</strong>
            </div>
          </div>

          <div class="rpg-stat-chip">
            <span class="chip-icon">👗</span>
            <div class="chip-content">
              <span class="chip-label">{t('rpg.dashboard.cosmeticsUnlocked')}</span>
              <strong class="chip-val">{unlockedCount()} / {COSMETIC_CATALOG.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* RPG NAVIGATION TABS */}
      <div class="rpg-navigation-tabs">
        <button
          class={`rpg-tab-btn ${activeTab() === 'defense' ? 'active' : ''}`}
          onClick={() => setActiveTab('defense')}
        >
          <span>⚔️</span>
          <span>{t('rpg.tabs.defense')}</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'gacha' ? 'active' : ''}`}
          onClick={() => setActiveTab('gacha')}
        >
          <span>🎁</span>
          <span>{t('rpg.tabs.gacha')}</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'affection' ? 'active' : ''}`}
          onClick={() => setActiveTab('affection')}
        >
          <span>💖</span>
          <span>{t('rpg.tabs.affection')}</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'wardrobe' ? 'active' : ''}`}
          onClick={() => setActiveTab('wardrobe')}
        >
          <span>👗</span>
          <span>{t('rpg.tabs.wardrobe')}</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'inventory' ? 'active' : ''}`}
          data-testid="rpg-tab-inventory"
          onClick={() => setActiveTab('inventory')}
        >
          <span>🎒</span>
          <span>{t('rpg.tabs.inventory')}</span>
        </button>
      </div>

      {/* TAB CONTENT */}
      <div class="rpg-content-body">
        {/* 1. TOWER DEFENSE GAMEMODE */}
        <Show when={activeTab() === 'defense'}>
          <div class="tab-pane">
            <WaifuDefenseGame />
          </div>
        </Show>

        {/* 2. GACHA & CHESTS */}
        <Show when={activeTab() === 'gacha'}>
          <div class="tab-pane">
            <LootboxModal />
          </div>
        </Show>

        {/* 3. AFFECTION ROAD */}
        <Show when={activeTab() === 'affection'}>
          <div class="tab-pane">
            <div class="affection-road-container">
              <div class="road-header">
                <h2>💖 {t('rpg.affectionRoad.title')}</h2>
                <p>
                  {t('rpg.affectionRoad.subtitle', { name: state.waifu?.name || 'your companion' })}
                </p>
              </div>

              <div class="milestones-track">
                <For each={AFFECTION_MILESTONES}>
                  {milestone => {
                    const isClaimed = () => (state.rpg?.claimedAffectionMilestones || []).includes(milestone.level);
                    const canClaim = () => !isClaimed() && (state.waifu?.bondLevel || 1) >= milestone.level;
                    const isLocked = () => (state.waifu?.bondLevel || 1) < milestone.level;

                    return (
                      <div class={`milestone-card ${isClaimed() ? 'claimed' : canClaim() ? 'can-claim' : 'locked'}`}>
                        <div class="milestone-badge">
                          <span class="badge-icon">{milestone.icon}</span>
                          <span class="badge-lvl">Lv {milestone.level}</span>
                        </div>

                        <div class="milestone-content">
                          <h4 class="milestone-title">{milestone.title}</h4>
                          <p class="milestone-desc">{milestone.description}</p>
                          <div class="milestone-reward-tags">
                            <Show when={milestone.rewardType === 'coins'}>
                              <span class="tag-coin">🪙 +{milestone.rewardValue} Coins</span>
                            </Show>
                            <Show when={milestone.rewardType === 'cosmetic'}>
                              <span class="tag-cosmetic">
                                ✨ {milestone.rewardLabel}
                              </span>
                            </Show>
                          </div>
                        </div>

                        <div class="milestone-actions">
                          <Show when={isClaimed()}>
                            <span class="status-claimed">✅ {t('rpg.affectionRoad.claimed')}</span>
                          </Show>
                          <Show when={canClaim()}>
                            <button
                              class="btn-claim"
                              onClick={() => claimAffectionReward(milestone.level)}
                            >
                              🎁 {t('rpg.affectionRoad.claimBtn')}
                            </button>
                          </Show>
                          <Show when={isLocked()}>
                            <span class="status-locked">🔒 {t('rpg.affectionRoad.needsLevel', { level: milestone.level })}</span>
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>
        </Show>

        {/* 4. WARDROBE & CATALOG */}
        <Show when={activeTab() === 'wardrobe'}>
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
                  <WaifuAvatar />
                </div>
                <div class="preview-active-specs">
                  <div><strong>{t('rpg.wardrobe.outfitLabel')}</strong> {state.waifu?.appearance?.outfit || 'seifuku'}</div>
                  <div><strong>{t('rpg.wardrobe.accessoryLabel')}</strong> {state.waifu?.appearance?.accessory || 'none'}</div>
                  <div><strong>{t('rpg.wardrobe.hairstyleLabel')}</strong> {state.waifu?.appearance?.hairstyle || 'twintails'}</div>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* 5. INVENTORY & SHOWCASE TAB */}
        <Show when={activeTab() === 'inventory'}>
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
      </div>
    </div>
  );
}

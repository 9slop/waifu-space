import { createSignal, Show, For } from 'solid-js';
import {
  state,
  setState,
  COSMETIC_CATALOG,
  AFFECTION_MILESTONES,
  claimAffectionReward,
  isCosmeticUnlocked,
  showToast,
  RpgCosmeticItem
} from '../lib/store';
import { WaifuDefenseGame } from './WaifuDefenseGame';
import { LootboxModal } from './LootboxModal';
import { WaifuAvatar } from './WaifuAvatar';

export function RpgHub() {
  const [activeTab, setActiveTab] = createSignal<'defense' | 'gacha' | 'affection' | 'wardrobe'>('defense');
  const [filterCategory, setFilterCategory] = createSignal<'all' | 'outfit' | 'accessory'>('all');

  const equipCosmetic = (item: RpgCosmeticItem) => {
    if (!isCosmeticUnlocked(item.id)) {
      showToast('This item is locked! Unlock it via Lootboxes or Affection milestones.');
      return;
    }

    if (item.category === 'outfit') {
      setState('waifu', 'appearance', 'outfit', item.id);
      showToast(`Equipped outfit: ${item.name}! ✨`);
    } else if (item.category === 'accessory') {
      setState('waifu', 'appearance', 'accessory', item.id);
      showToast(`Equipped accessory: ${item.name}! ✨`);
    }
  };

  const getRarityClass = (rarity: string) => {
    switch (rarity) {
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

  return (
    <div class="rpg-hub-container">
      {/* RPG TOP STATS DASHBOARD */}
      <div class="rpg-dashboard-header">
        <div class="rpg-profile-card">
          <div class="rpg-avatar-small">
            <span class="avatar-ring-icon">🌸</span>
          </div>
          <div class="rpg-profile-info">
            <h3>{state.waifu.name}</h3>
            <div class="rpg-bars-group">
              <div class="rpg-bar-item">
                <div class="bar-header">
                  <span>🌟 Waifu Level {state.waifu.bondLevel}</span>
                  <small>{state.waifu.bondExp} / {state.waifu.bondLevel * 100} XP</small>
                </div>
                <div class="stat-progress-bar">
                  <div
                    class="progress-fill exp-fill"
                    style={{ width: `${Math.min(100, (state.waifu.bondExp / (state.waifu.bondLevel * 100)) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div class="rpg-bar-item">
                <div class="bar-header">
                  <span>💖 Affection Level {state.waifu.affectionLevel}</span>
                  <small>{state.waifu.affection} / {state.waifu.affectionLevel * 100} Pts</small>
                </div>
                <div class="stat-progress-bar">
                  <div
                    class="progress-fill affection-fill"
                    style={{ width: `${Math.min(100, (state.waifu.affection / (state.waifu.affectionLevel * 100)) * 100)}%` }}
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
              <span class="chip-label">Gold Coins</span>
              <strong class="chip-val">{state.rpg.coins}</strong>
            </div>
          </div>

          <div class="rpg-stat-chip">
            <span class="chip-icon">🛡️</span>
            <div class="chip-content">
              <span class="chip-label">Defense High Score</span>
              <strong class="chip-val">Wave {state.rpg.defenseHighScore}</strong>
            </div>
          </div>

          <div class="rpg-stat-chip">
            <span class="chip-icon">👗</span>
            <div class="chip-content">
              <span class="chip-label">Cosmetics Collected</span>
              <strong class="chip-val">{state.rpg.unlockedCosmetics.length} / {COSMETIC_CATALOG.length}</strong>
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
          <span>Waifu Defense</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'gacha' ? 'active' : ''}`}
          onClick={() => setActiveTab('gacha')}
        >
          <span>🎁</span>
          <span>Gacha Chests</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'affection' ? 'active' : ''}`}
          onClick={() => setActiveTab('affection')}
        >
          <span>💖</span>
          <span>Affection Road</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'wardrobe' ? 'active' : ''}`}
          onClick={() => setActiveTab('wardrobe')}
        >
          <span>👗</span>
          <span>Wardrobe & Catalog</span>
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
                <h2>💖 Affection Road Milestones</h2>
                <p>
                  Deepen your bond with {state.waifu.name} by chatting, poking, completing tasks, and defending her shrine!
                </p>
              </div>

              <div class="milestones-track">
                <For each={AFFECTION_MILESTONES}>
                  {milestone => {
                    const isClaimed = () => state.rpg.claimedMilestones.includes(milestone.level);
                    const canClaim = () => !isClaimed() && state.waifu.affectionLevel >= milestone.level;
                    const isLocked = () => state.waifu.affectionLevel < milestone.level;

                    return (
                      <div class={`milestone-card ${isClaimed() ? 'claimed' : canClaim() ? 'can-claim' : 'locked'}`}>
                        <div class="milestone-badge">
                          <span class="badge-icon">💖</span>
                          <span class="badge-lvl">Lv {milestone.level}</span>
                        </div>

                        <div class="milestone-content">
                          <h4 class="milestone-title">{milestone.title}</h4>
                          <p class="milestone-desc">{milestone.description}</p>
                          <div class="milestone-reward-tags">
                            <span class="tag-coin">🪙 +{milestone.coinReward} Coins</span>
                            <Show when={milestone.cosmeticReward}>
                              <span class="tag-cosmetic">
                                ✨ {COSMETIC_CATALOG.find(c => c.id === milestone.cosmeticReward)?.name || milestone.cosmeticReward}
                              </span>
                            </Show>
                          </div>
                        </div>

                        <div class="milestone-actions">
                          <Show when={isClaimed()}>
                            <span class="status-claimed">✅ Claimed</span>
                          </Show>
                          <Show when={canClaim()}>
                            <button
                              class="btn-claim"
                              onClick={() => claimAffectionReward(milestone.level)}
                            >
                              🎁 Claim!
                            </button>
                          </Show>
                          <Show when={isLocked()}>
                            <span class="status-locked">🔒 Needs Lv {milestone.level}</span>
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
                    All Items
                  </button>
                  <button
                    class={`filter-btn ${filterCategory() === 'outfit' ? 'active' : ''}`}
                    onClick={() => setFilterCategory('outfit')}
                  >
                    Outfits
                  </button>
                  <button
                    class={`filter-btn ${filterCategory() === 'accessory' ? 'active' : ''}`}
                    onClick={() => setFilterCategory('accessory')}
                  >
                    Accessories
                  </button>
                </div>

                <div class="cosmetics-grid">
                  <For each={filteredCatalog()}>
                    {item => {
                      const unlocked = () => isCosmeticUnlocked(item.id);
                      const isEquipped = () =>
                        (item.category === 'outfit' && state.waifu.appearance.outfit === item.id) ||
                        (item.category === 'accessory' && state.waifu.appearance.accessory === item.id);

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
                            <small class="cosmetic-source">Source: {item.source}</small>
                          </div>

                          <div class="cosmetic-btn-wrap">
                            <Show when={unlocked()}>
                              <button
                                class={`btn-equip ${isEquipped() ? 'equipped' : ''}`}
                                disabled={isEquipped()}
                                onClick={() => equipCosmetic(item)}
                              >
                                {isEquipped() ? 'Equipped ✨' : 'Equip'}
                              </button>
                            </Show>
                            <Show when={!unlocked()}>
                              <span class="locked-badge">🔒 Locked</span>
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
                <h3>Live Preview</h3>
                <div class="preview-avatar-box">
                  <WaifuAvatar />
                </div>
                <div class="preview-active-specs">
                  <div><strong>Outfit:</strong> {state.waifu.appearance.outfit}</div>
                  <div><strong>Accessory:</strong> {state.waifu.appearance.accessory}</div>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

import { createSignal, Show, For } from 'solid-js';
import {
  state,
  COSMETIC_CATALOG,
  AFFECTION_MILESTONES,
  claimAffectionReward,
  getUnlockedCosmeticsCount,
  getBondExpNeeded
} from '../lib/store';
import { WaifuDefenseGame } from './WaifuDefenseGame';
import { LootboxModal } from './LootboxModal';
import { t } from '../lib/i18n';
import { defenseGameActive, pendingDefenseTab, setPendingDefenseTab } from '../lib/defense-bridge';

export function RpgHub() {
  const [activeTab, setActiveTab] = createSignal<'defense' | 'gacha' | 'affection'>('defense');

  // Intercept tab switches while a defense run is in progress so the game
  // (and the player's progress) is never silently discarded.
  const handleTabSwitch = (next: 'defense' | 'gacha' | 'affection') => {
    if (next === activeTab()) return;
    if (next !== 'defense' && activeTab() === 'defense' && defenseGameActive()) {
      setPendingDefenseTab(next);
      return;
    }
    setActiveTab(next);
  };

  const confirmLeaveDefense = () => {
    const next = pendingDefenseTab();
    if (next) {
      setActiveTab(next as any);
      setPendingDefenseTab(null);
    }
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
          onClick={() => handleTabSwitch('defense')}
        >
          <span>⚔️</span>
          <span>{t('rpg.tabs.defense')}</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'gacha' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('gacha')}
        >
          <span>🎁</span>
          <span>{t('rpg.tabs.gacha')}</span>
        </button>

        <button
          class={`rpg-tab-btn ${activeTab() === 'affection' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('affection')}
        >
          <span>💖</span>
          <span>{t('rpg.tabs.affection')}</span>
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
      </div>

      {/* TAB-SWITCH WARNING: an active defense run would be lost */}
      <Show when={pendingDefenseTab()}>
        <div class="defense-leave-overlay" data-testid="defense-leave-modal">
          <div class="defense-leave-modal">
            <h3>⚠️ {t('defense.confirmLeaveTitle')}</h3>
            <p>{t('defense.confirmLeaveDesc')}</p>
            <div class="defense-leave-actions">
              <button class="btn-stay" onClick={() => setPendingDefenseTab(null)}>
                🎮 {t('defense.stayInGame')}
              </button>
              <button class="btn-leave" onClick={confirmLeaveDefense}>
                🏃 {t('defense.leaveAnyway')}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

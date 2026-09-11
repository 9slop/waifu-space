import { createSignal, Show, For } from 'solid-js';
import { state, setState, openLootbox, RpgCosmeticItem, showToast, isCosmeticUnlocked, gainBondExp, unlockCosmetic } from '../lib/store';
import { t } from '../lib/i18n';
import { onActivateKey } from '../lib/accessibility';

export function LootboxModal() {
  const [selectedChest, setSelectedChest] = createSignal<'standard' | 'royal'>('standard');
  const [isOpening, setIsOpening] = createSignal(false);
  const [revealedItem, setRevealedItem] = createSignal<RpgCosmeticItem | null>(null);
  const [duplicateCompensation, setDuplicateCompensation] = createSignal<number | null>(null);
  const [history, setHistory] = createSignal<Array<{ item: RpgCosmeticItem; wasDup: boolean; date: string }>>([]);

  const userCoins = () => state.rpg?.coins ?? 0;

  const handleOpenChest = async () => {
    const cost = selectedChest() === 'standard' ? 100 : 250;
    if (userCoins() < cost) {
      showToast(t('gacha.notEnoughCoins', { cost, balance: userCoins() }));
      return;
    }

    setIsOpening(true);
    setRevealedItem(null);
    setDuplicateCompensation(null);

    try {
      const token = state.user?.token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const allUnlocked = [
        ...(state.rpg?.unlockedOutfits || []),
        ...(state.rpg?.unlockedAccessories || []),
        ...(state.rpg?.unlockedHairstyles || [])
      ];

      const res = await fetch('/api/gacha/roll', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          boxType: selectedChest(),
          currentCoins: userCoins(),
          unlockedItemIds: allUnlocked
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          const item = data.result.item;
          setRevealedItem(item);

          if (data.result.isDuplicate) {
            setDuplicateCompensation(data.result.duplicateCoins);
          }

          // Apply state update from verified server outcome
          if (typeof data.newCoins === 'number') {
            setState('rpg', 'coins', data.newCoins);
          }
          if (data.result.duplicateExp) {
            gainBondExp(data.result.duplicateExp);
          }
          if (!data.result.isDuplicate) {
            const cat = item.category === 'outfit' ? 'outfits' : item.category === 'accessory' ? 'accessories' : 'hairstyles';
            unlockCosmetic(cat, item.id);
          }

          setHistory(prev => [
            { item, wasDup: data.result.isDuplicate, date: new Date().toLocaleTimeString() },
            ...prev.slice(0, 7)
          ]);
          setIsOpening(false);
          return;
        }
      }
    } catch {
      // Local fallback in case server endpoint is unreachable in client tests
    }

    // Fallback locally
    setTimeout(() => {
      const result = openLootbox(selectedChest());
      if (result) {
        setRevealedItem(result.item);
        if (result.isDuplicate) {
          setDuplicateCompensation(result.duplicateCoins);
        }
        setHistory(prev => [
          { item: result.item, wasDup: result.isDuplicate, date: new Date().toLocaleTimeString() },
          ...prev.slice(0, 7)
        ]);
      }
      setIsOpening(false);
    }, 800);
  };

  const equipItem = (item: RpgCosmeticItem) => {
    if (item.category === 'outfit') {
      setState('waifu', 'appearance', 'outfit', item.id);
      showToast(t('rpg.toasts.equippedOutfit', { name: item.name }));
    } else if (item.category === 'accessory') {
      setState('waifu', 'appearance', 'accessory', item.id);
      showToast(t('rpg.toasts.equippedAccessory', { name: item.name }));
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

  return (
    <div class="lootbox-system-card" role="region" aria-labelledby="lootbox-modal-title">
      <div class="lootbox-header">
        <div class="lootbox-title-group">
          <h2 id="lootbox-modal-title">🎁 {t('gacha.title')}</h2>
          <p class="lootbox-subtitle">
            {t('gacha.subtitle')}
          </p>
        </div>
        <div class="lootbox-coin-display">
          <span>{t('gacha.yourBalance')}</span>
          <strong class="coin-val">🪙 {userCoins()}</strong>
        </div>
      </div>

      {/* CHEST SELECTION */}
      <div class="chest-options-grid">
        <div
          class={`chest-card ${selectedChest() === 'standard' ? 'selected' : ''}`}
          role="button"
          tabindex="0"
          aria-pressed={selectedChest() === 'standard'}
          aria-label={t('gacha.silverChest')}
          onClick={() => setSelectedChest('standard')}
          onKeyDown={e => onActivateKey(e, () => setSelectedChest('standard'))}
        >
          <div class="chest-badge standard-badge">{t('gacha.regular')}</div>
          <div class="chest-icon">📦</div>
          <div class="chest-name">{t('gacha.silverChest')}</div>
          <div class="chest-rates">{t('gacha.silverRates')}</div>
          <div class="chest-cost">
            <span>{t('gacha.price')}</span> <strong>🪙 100</strong>
          </div>
        </div>

        <div
          class={`chest-card royal-card ${selectedChest() === 'royal' ? 'selected' : ''}`}
          role="button"
          tabindex="0"
          aria-pressed={selectedChest() === 'royal'}
          aria-label={t('gacha.royalChest')}
          onClick={() => setSelectedChest('royal')}
          onKeyDown={e => onActivateKey(e, () => setSelectedChest('royal'))}
        >
          <div class="chest-badge royal-badge">{t('gacha.highRarityGuaranteed')}</div>
          <div class="chest-icon">✨👑✨</div>
          <div class="chest-name">{t('gacha.royalChest')}</div>
          <div class="chest-rates">{t('gacha.royalRates')}</div>
          <div class="chest-cost">
            <span>{t('gacha.price')}</span> <strong>🪙 250</strong>
          </div>
        </div>
      </div>

      {/* ACTION AREA */}
      <div class="chest-action-center">
        <button
          class="btn-open-chest"
          disabled={isOpening() || userCoins() < (selectedChest() === 'standard' ? 100 : 250)}
          onClick={handleOpenChest}
        >
          {isOpening() ? (
            <span class="opening-spinner">🔮 {t('gacha.unlocking')}</span>
          ) : (
            <span>
              {selectedChest() === 'standard' ? t('gacha.openSilver') : t('gacha.openRoyal')}
            </span>
          )}
        </button>
      </div>

      {/* OPENING REVEAL ANIMATION */}
      <Show when={isOpening()}>
        <div class="chest-animation-stage">
          <div class="chest-vortex"></div>
          <div class="bouncing-chest">
            {selectedChest() === 'standard' ? '📦' : '👑'}
          </div>
          <div class="opening-status-text">{t('gacha.animationText')}</div>
        </div>
      </Show>

      {/* REVEALED ITEM CARD */}
      <Show when={revealedItem()}>
        {item => (
          <div class={`revealed-item-modal ${getRarityClass(item().rarity)}`} aria-live="polite">
            <div class="revealed-glow-ray"></div>
            <div class="revealed-header">
              <span class={`rarity-tag ${getRarityClass(item().rarity)}`}>
                {item().rarity.toUpperCase()}
              </span>
              <span class="category-tag">{item().category.toUpperCase()}</span>
            </div>

            <div class="revealed-icon">{item().icon}</div>
            <h3 class="revealed-name">{item().name}</h3>
            <p class="revealed-desc">{item().description}</p>

            <Show when={duplicateCompensation() !== null}>
              <div class="duplicate-banner">
                ♻️ {t('gacha.alreadyOwned', { coins: duplicateCompensation()! })}
              </div>
            </Show>

            <div class="revealed-actions">
              <button
                class="btn-equip-revealed"
                onClick={() => equipItem(item())}
              >
                ✨ {t('gacha.equipNow')}
              </button>
              <button
                class="btn-dismiss-revealed"
                onClick={() => {
                  setRevealedItem(null);
                  setDuplicateCompensation(null);
                }}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </Show>

      {/* RECENT PULLS HISTORY */}
      <Show when={history().length > 0}>
        <div class="lootbox-history-section">
          <h4>{t('gacha.recentPulls')}</h4>
          <div class="history-pills">
            <For each={history()}>
              {entry => (
                <div class={`history-pill ${getRarityClass(entry.item.rarity)}`}>
                  <span>{entry.item.icon}</span>
                  <span class="pill-name">{entry.item.name}</span>
                  <Show when={entry.wasDup}>
                    <span class="dup-indicator">({t('gacha.dup')})</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

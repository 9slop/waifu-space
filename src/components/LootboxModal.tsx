import { createSignal, Show, For } from 'solid-js';
import { state, setState, openLootbox, RpgCosmeticItem, showToast, isCosmeticUnlocked } from '../lib/store';

export function LootboxModal() {
  const [selectedChest, setSelectedChest] = createSignal<'standard' | 'royal'>('standard');
  const [isOpening, setIsOpening] = createSignal(false);
  const [revealedItem, setRevealedItem] = createSignal<RpgCosmeticItem | null>(null);
  const [duplicateCompensation, setDuplicateCompensation] = createSignal<number | null>(null);
  const [history, setHistory] = createSignal<Array<{ item: RpgCosmeticItem; wasDup: boolean; date: string }>>([]);

  const handleOpenChest = () => {
    const cost = selectedChest() === 'standard' ? 100 : 250;
    if (state.rpg.coins < cost) {
      showToast(`Not enough coins! You need ${cost} 🪙 (Have: ${state.rpg.coins} 🪙)`);
      return;
    }

    setIsOpening(true);
    setRevealedItem(null);
    setDuplicateCompensation(null);

    // Simulate mystery chest opening animation delay
    setTimeout(() => {
      const result = openLootbox(selectedChest());
      if (result) {
        setRevealedItem(result.item);
        if (result.duplicate) {
          setDuplicateCompensation(result.compensation);
        }
        setHistory(prev => [
          { item: result.item, wasDup: result.duplicate, date: new Date().toLocaleTimeString() },
          ...prev.slice(0, 7)
        ]);
      }
      setIsOpening(false);
    }, 1200);
  };

  const equipItem = (item: RpgCosmeticItem) => {
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

  return (
    <div class="lootbox-system-card">
      <div class="lootbox-header">
        <div class="lootbox-title-group">
          <h2>🎁 Gacha & Mystery Chests</h2>
          <p class="lootbox-subtitle">
            Spend earned gold coins to unlock rare outfits, celestial accessories, and secret styles!
          </p>
        </div>
        <div class="lootbox-coin-display">
          <span>Your Balance:</span>
          <strong class="coin-val">🪙 {state.rpg.coins}</strong>
        </div>
      </div>

      {/* CHEST SELECTION */}
      <div class="chest-options-grid">
        <div
          class={`chest-card ${selectedChest() === 'standard' ? 'selected' : ''}`}
          onClick={() => setSelectedChest('standard')}
        >
          <div class="chest-badge standard-badge">Regular</div>
          <div class="chest-icon">📦</div>
          <div class="chest-name">Silver Blossom Chest</div>
          <div class="chest-rates">Common: 50% | Rare: 35% | Epic: 12% | Legendary: 3%</div>
          <div class="chest-cost">
            <span>Price:</span> <strong>🪙 100</strong>
          </div>
        </div>

        <div
          class={`chest-card royal-card ${selectedChest() === 'royal' ? 'selected' : ''}`}
          onClick={() => setSelectedChest('royal')}
        >
          <div class="chest-badge royal-badge">High Rarity Guaranteed</div>
          <div class="chest-icon">✨👑✨</div>
          <div class="chest-name">Celestial Royal Chest</div>
          <div class="chest-rates">Rare: 45% | Epic: 38% | Legendary: 17%</div>
          <div class="chest-cost">
            <span>Price:</span> <strong>🪙 250</strong>
          </div>
        </div>
      </div>

      {/* ACTION AREA */}
      <div class="chest-action-center">
        <button
          class="btn-open-chest"
          disabled={isOpening() || state.rpg.coins < (selectedChest() === 'standard' ? 100 : 250)}
          onClick={handleOpenChest}
        >
          {isOpening() ? (
            <span class="opening-spinner">🔮 Unlocking Mystery Wardrobe...</span>
          ) : (
            <span>
              Open {selectedChest() === 'standard' ? 'Silver Chest (100🪙)' : 'Celestial Chest (250🪙)'}
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
          <div class="opening-status-text">Gathering starlight & magical fibers...</div>
        </div>
      </Show>

      {/* REVEALED ITEM CARD */}
      <Show when={revealedItem()}>
        {item => (
          <div class={`revealed-item-modal ${getRarityClass(item().rarity)}`}>
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
                ♻️ Already owned! Converted to <strong>+{duplicateCompensation()} 🪙 Coins</strong>!
              </div>
            </Show>

            <div class="revealed-actions">
              <button
                class="btn-equip-revealed"
                onClick={() => equipItem(item())}
              >
                ✨ Equip Now
              </button>
              <button
                class="btn-dismiss-revealed"
                onClick={() => {
                  setRevealedItem(null);
                  setDuplicateCompensation(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Show>

      {/* RECENT PULLS HISTORY */}
      <Show when={history().length > 0}>
        <div class="lootbox-history-section">
          <h4>Recent Pulls</h4>
          <div class="history-pills">
            <For each={history()}>
              {entry => (
                <div class={`history-pill ${getRarityClass(entry.item.rarity)}`}>
                  <span>{entry.item.icon}</span>
                  <span class="pill-name">{entry.item.name}</span>
                  <Show when={entry.wasDup}>
                    <span class="dup-indicator">(Dup 🪙)</span>
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

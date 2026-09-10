import { describe, it, expect, beforeEach } from 'vitest';
import {
  state,
  setState,
  loadState,
  saveState,
  gainBondExp,
  addCoins,
  spendCoins,
  unlockCosmetic,
  isCosmeticUnlocked,
  getUnlockedCosmeticsCount,
  claimAffectionReward,
  openLootbox,
  recordDefenseWaveVictory,
  addCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  toggleTask,
  DEFAULT_STATE,
  DEFAULT_RPG,
  STORAGE_KEY,
  COSMETIC_CATALOG,
  AFFECTION_MILESTONES
} from '../../src/lib/store';

describe('Global Store & RPG State (store.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset state to deep copy of default state
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  describe('Economy & Coin Transactions', () => {
    it('adds coins correctly to player balance', () => {
      const initial = state.rpg.coins;
      addCoins(150);
      expect(state.rpg.coins).toBe(initial + 150);
    });

    it('spends coins when balance is sufficient and denies when insufficient', () => {
      setState('rpg', 'coins', 100);

      const success = spendCoins(40);
      expect(success).toBe(true);
      expect(state.rpg.coins).toBe(60);

      const fail = spendCoins(200);
      expect(fail).toBe(false);
      expect(state.rpg.coins).toBe(60);
    });
  });

  describe('Bond Level & XP Progression', () => {
    it('increases bond XP and levels up when reaching threshold', () => {
      setState('waifu', 'bondLevel', 1);
      setState('waifu', 'bondExp', 0);
      const initialCoins = state.rpg.coins;

      // Level 1 threshold is 1 * 50 = 50 XP
      gainBondExp(60);

      expect(state.waifu.bondLevel).toBe(2);
      expect(state.waifu.bondExp).toBe(10); // 60 - 50 = 10
      expect(state.rpg.coins).toBeGreaterThan(initialCoins); // Level up coin reward
    });
  });

  describe('Cosmetics Catalog & Unlocks', () => {
    it('correctly checks default unlocked cosmetics', () => {
      expect(isCosmeticUnlocked('seifuku')).toBe(true);
      expect(isCosmeticUnlocked('none')).toBe(true);
      expect(isCosmeticUnlocked('outfits', 'seifuku')).toBe(true);
      expect(isCosmeticUnlocked('accessories', 'ribbon')).toBe(true);
    });

    it('unlocks new cosmetic and reflects in unlocked count', () => {
      const initialCount = getUnlockedCosmeticsCount();
      expect(isCosmeticUnlocked('armor')).toBe(false);

      unlockCosmetic('outfits', 'armor');

      expect(isCosmeticUnlocked('armor')).toBe(true);
      expect(getUnlockedCosmeticsCount()).toBe(initialCount + 1);
    });
  });

  describe('Lootbox & Gacha Mechanism', () => {
    it('fails to open chest when coins are insufficient', () => {
      setState('rpg', 'coins', 10);
      const result = openLootbox('standard');
      expect(result).toBeNull();
    });

    it('opens standard chest when coins are sufficient and returns valid result', () => {
      setState('rpg', 'coins', 500);
      const result = openLootbox('standard');

      expect(result).not.toBeNull();
      expect(result?.item).toBeDefined();
      expect(COSMETIC_CATALOG.some(c => c.id === result?.item.id)).toBe(true);
      expect(state.rpg.coins).toBeLessThan(500);
    });

    it('handles duplicate drops by awarding compensation coins', () => {
      setState('rpg', 'coins', 500);
      // Force all items unlocked
      COSMETIC_CATALOG.forEach(c => {
        if (c.category === 'outfit') unlockCosmetic('outfits', c.id);
        else if (c.category === 'accessory') unlockCosmetic('accessories', c.id);
        else if (c.category === 'hairstyle') unlockCosmetic('hairstyles', c.id);
      });

      const result = openLootbox('royal');
      expect(result?.isDuplicate).toBe(true);
      expect(result?.duplicateCoins).toBeGreaterThan(0);
    });
  });

  describe('Affection Road Milestones', () => {
    it('denies claiming milestone if bond level is below requirement', () => {
      setState('waifu', 'bondLevel', 1);
      const claimed = claimAffectionReward(3);
      expect(claimed).toBe(false);
      expect(state.rpg.claimedAffectionMilestones).not.toContain(3);
    });

    it('claims milestone and grants rewards when level is met', () => {
      setState('waifu', 'bondLevel', 3);
      const initialCoins = state.rpg.coins;

      const claimed = claimAffectionReward(3);
      expect(claimed).toBe(true);
      expect(state.rpg.claimedAffectionMilestones).toContain(3);

      // Cannot claim twice
      const claimAgain = claimAffectionReward(3);
      expect(claimAgain).toBe(false);
    });
  });

  describe('Waifu Defense Victory Recording', () => {
    it('records wave victory, updates high score and statistics', () => {
      const initialCoins = state.rpg.coins;

      recordDefenseWaveVictory(3, 100, 80, 15);

      expect(state.rpg.defenseHighWave).toBe(3);
      expect(state.rpg.defenseStats.totalVictories).toBe(1);
      expect(state.rpg.defenseStats.goblinsDefeated).toBe(15);
      expect(state.rpg.coins).toBe(initialCoins + 100);
    });
  });

  describe('Calendar & Task Actions', () => {
    it('adds, updates, toggles, and deletes calendar events', () => {
      const newEv = addCalendarEvent({
        title: 'Test Sprint Review',
        type: 'task',
        start: new Date().toISOString()
      });

      expect(state.calendar.events.some(e => e.id === newEv.id)).toBe(true);

      updateCalendarEvent(newEv.id, { title: 'Updated Sprint Review' });
      const updated = state.calendar.events.find(e => e.id === newEv.id);
      expect(updated?.title).toBe('Updated Sprint Review');

      expect(updated?.completed).toBe(false);
      toggleTask(newEv.id);
      expect(state.calendar.events.find(e => e.id === newEv.id)?.completed).toBe(true);

      deleteCalendarEvent(newEv.id);
      expect(state.calendar.events.some(e => e.id === newEv.id)).toBe(false);
    });
  });

  describe('LocalStorage Hydration & Migration', () => {
    it('persists and loads state correctly from localStorage', () => {
      addCoins(350);
      unlockCosmetic('outfits', 'armor');
      saveState();

      // Clear state in memory
      setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
      expect(state.rpg.coins).toBe(DEFAULT_RPG.coins);

      loadState();
      expect(state.rpg.coins).toBe(DEFAULT_RPG.coins + 350);
      expect(isCosmeticUnlocked('armor')).toBe(true);
    });

    it('safely handles legacy or incomplete localStorage data without crashing', () => {
      // Set legacy data without rpg property
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        waifu: { name: 'Legacy Akari' }
      }));

      expect(() => loadState()).not.toThrow();
      expect(state.waifu.name).toBe('Legacy Akari');
      expect(state.rpg).toBeDefined();
      expect(Array.isArray(state.rpg.unlockedOutfits)).toBe(true);
      expect(state.rpg.coins).toBe(DEFAULT_RPG.coins);
    });
  });
});

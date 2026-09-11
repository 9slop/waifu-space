import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  pokeAvatar,
  headpatWaifu,
  loadCloudProgress,
  resetAccountProgress,
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

      // Level 1 threshold is 1 * 60 = 60 XP
      gainBondExp(60);

      expect(state.waifu.bondLevel).toBe(2);
      expect(state.waifu.bondExp).toBe(0);
      expect(state.rpg.coins).toBe(initialCoins + 2 * 20); // Level 2 level-up bonus: 40 coins
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
      // Startup from a fresh level 1: wave reward (100) + bond level-up bonus (2 * 20)
      expect(state.rpg.coins).toBe(initialCoins + 140);
      expect(state.waifu.bondLevel).toBe(2);
      expect(state.waifu.bondExp).toBe(20);
    });

    it('uses the shared defense formula by default and clamps out-of-range waves', () => {
      setState('waifu', 'bondLevel', 100);
      setState('waifu', 'bondExp', 0);
      setState('rpg', 'coins', 0);

      recordDefenseWaveVictory(500); // wave clamps to 200
      expect(state.rpg.defenseHighWave).toBe(200);
      expect(state.rpg.coins).toBe(15 + 200 * 8); // getDefenseCoinsReward(200)
    });
  });

  describe('Interaction Cooldowns & Rewards', () => {
    it('rewards poke but blocks another poke while on cooldown', () => {
      setState('rpg', 'coins', 100);
      setState('waifu', 'bondExp', 0);
      setState('waifu', 'bondLevel', 1);

      pokeAvatar();
      const expAfterFirst = state.waifu.bondExp;
      const coinsAfterFirst = state.rpg.coins;
      expect(coinsAfterFirst).toBe(100 + 2);
      expect(expAfterFirst).toBe(4);

      // Immediate second poke is on cooldown -> no additional rewards
      pokeAvatar();
      expect(state.waifu.bondExp).toBe(expAfterFirst);
      expect(state.rpg.coins).toBe(coinsAfterFirst);
    });

    it('rewards headpat independently of the poke cooldown', () => {
      setState('rpg', 'coins', 100);
      setState('waifu', 'bondExp', 0);

      pokeAvatar(); // consumes poke cooldown
      setState('rpg', 'coins', 100);
      setState('waifu', 'bondExp', 0);

      headpatWaifu();
      expect(state.rpg.coins).toBe(100 + 3);
      expect(state.waifu.bondExp).toBe(6);
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

    it('only rewards the first completion of a task, not toggle farming', () => {
      const task = addCalendarEvent({
        title: 'Gym Session',
        type: 'task',
        start: new Date().toISOString()
      });
      const initialCoins = state.rpg.coins;

      toggleTask(task.id); // first completion -> reward
      expect(state.rpg.coins).toBe(initialCoins + 15);

      const coinsAfterFirst = state.rpg.coins;
      toggleTask(task.id); // un-complete
      toggleTask(task.id); // complete again -> no second reward
      expect(state.rpg.coins).toBe(coinsAfterFirst);
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

  describe('Fresh Player Defaults & Account Reset', () => {
    it('defaults a brand-new player to bond level 1 with no XP and starter coins', () => {
      expect(DEFAULT_STATE.waifu.bondLevel).toBe(1);
      expect(DEFAULT_STATE.waifu.bondExp).toBe(0);
      expect(state.waifu.bondLevel).toBe(1);
      expect(state.waifu.bondExp).toBe(0);
      expect(state.rpg.coins).toBe(DEFAULT_RPG.coins);
    });

    it('resetAccountProgress wipes all carried-over progress back to the fresh defaults', () => {
      // Simulate a returning player with real progress left in the session
      setState('user', { id: 'old', username: 'test123', token: 'ws_old' });
      setState('waifu', 'bondLevel', 12);
      setState('waifu', 'bondExp', 45);
      setState('rpg', 'coins', 3450);
      unlockCosmetic('outfits', 'armor');
      addCalendarEvent({ title: 'Old Account Event', type: 'task', start: new Date().toISOString() });
      toggleTask('evt-1');

      resetAccountProgress();

      expect(state.user).toBeNull();
      expect(state.waifu.bondLevel).toBe(1);
      expect(state.waifu.bondExp).toBe(0);
      expect(state.rpg.coins).toBe(DEFAULT_RPG.coins);
      expect(isCosmeticUnlocked('armor')).toBe(false);
      expect(state.rpg.defenseHighWave).toBe(0);
      // New accounts start with an empty calendar - no demo events/tasks.
      expect(state.calendar.events).toEqual([]);
    });

    it('keeps a newly registered account at starter values after loading cloud progress', async () => {
      // Leftover high values from a previous account
      setState('user', { id: 'old', username: 'test123', token: 'ws_old' });
      setState('waifu', 'bondLevel', 12);
      setState('waifu', 'bondExp', 45);
      setState('rpg', 'coins', 3450);

      // Registration resets to a clean slate before the fresh cloud snapshot loads
      resetAccountProgress();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          progress: {
            coins: 200,
            bond_level: 1,
            bond_exp: 0,
            waifu_name: 'Akari',
            waifu_personality: 'tsundere',
            worn_outfit: 'seifuku',
            worn_accessory: 'none',
            worn_hairstyle: 'twintails',
            appearance_data: {},
            settings_data: {},
            claimed_milestones: [],
            defense_high_wave: 0,
            defense_victories: 0,
            goblins_defeated: 0
          },
          showcaseItems: [],
          inventory: []
        })
      }));

      await loadCloudProgress('ws_fresh');

      expect(state.rpg.coins).toBe(200);
      expect(state.waifu.bondLevel).toBe(1);
      expect(state.waifu.bondExp).toBe(0);
      expect(state.rpg.unlockedOutfits).toEqual(DEFAULT_RPG.unlockedOutfits);
      expect(state.rpg.showcaseItems).toEqual(DEFAULT_RPG.showcaseItems);

      vi.unstubAllGlobals();
    });
  });

  describe('Cloud Sync (Supabase progress load)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      setState('user', null);
    });

    it('merges cloud progress, inventory, and showcase into local state', async () => {
      setState('user', { id: 'u1', username: 'Cloudy', token: 'ws_cloud' });
      setState('waifu', 'bondLevel', 1);
      setState('rpg', 'coins', 200);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          progress: {
            coins: 5000,
            bond_level: 6,
            bond_exp: 40,
            waifu_name: 'Rin',
            waifu_personality: 'kuudere',
            worn_outfit: 'kimono',
            worn_accessory: 'flower_pin',
            worn_hairstyle: 'wavy',
            appearance_data: { hairColor: '#1a1a2e' },
            settings_data: { theme: 'tokyo' },
            claimed_milestones: [2],
            defense_high_wave: 12,
            defense_victories: 3,
            goblins_defeated: 55
          },
          showcaseItems: ['kimono'],
          inventory: [
            { item_id: 'kimono', category: 'outfit' },
            { item_id: 'cat_ears', category: 'accessory' },
            { item_id: 'wavy', category: 'hairstyle' }
          ]
        })
      }));

      await loadCloudProgress('ws_cloud');

      expect(state.rpg.coins).toBe(5000);
      expect(state.waifu.bondLevel).toBe(6);
      expect(state.waifu.name).toBe('Rin');
      expect(state.waifu.appearance.outfit).toBe('kimono');
      expect(state.rpg.defenseHighWave).toBe(12);
      expect(state.rpg.unlockedOutfits).toContain('kimono');
      expect(state.rpg.unlockedAccessories).toContain('cat_ears');
      expect(state.rpg.unlockedHairstyles).toContain('wavy');
      expect(state.rpg.showcaseItems).toEqual(['kimono']);
    });

    it('does not clobber a richer local balance with the default 200 snapshot', async () => {
      setState('user', { id: 'u1', username: 'Rich', token: 'ws_cloud' });
      setState('rpg', 'coins', 1500);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, progress: { coins: 200 }, inventory: [], showcaseItems: [] })
      }));

      await loadCloudProgress('ws_cloud');
      expect(state.rpg.coins).toBe(1500);
    });

    it('keeps the larger balance when the cloud holds a stellar higher-than-default snapshot', async () => {
      setState('user', { id: 'u1', username: 'Earner', token: 'ws_cloud' });
      setState('rpg', 'coins', 1000);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, progress: { coins: 350 }, inventory: [], showcaseItems: [] })
      }));

      await loadCloudProgress('ws_cloud');
      expect(state.rpg.coins).toBe(1000);
    });

    it('adopts the cloud balance when the cloud is ahead of the local save', async () => {
      setState('user', { id: 'u1', username: 'CloudAhead', token: 'ws_cloud' });
      setState('rpg', 'coins', 400);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, progress: { coins: 900 }, inventory: [], showcaseItems: [] })
      }));

      await loadCloudProgress('ws_cloud');
      expect(state.rpg.coins).toBe(900);
    });

    it('does nothing when there is no valid session token', async () => {
      vi.stubGlobal('fetch', vi.fn());
      setState('rpg', 'coins', 777);

      await loadCloudProgress(undefined);
      await loadCloudProgress('');

      expect(state.rpg.coins).toBe(777);
      expect((fetch as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });
  });
});

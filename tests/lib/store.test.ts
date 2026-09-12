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
  getEventsForDate,
  getOccurrenceForDate,
  moveCalendarEvent,
  dateKeyOf,
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

  describe('Recurring Event Occurrence Overrides', () => {
    beforeEach(() => {
      setState('calendar', 'events', []);
    });

    const localIso = (y: number, m: number, d: number, h = 0, min = 0): string =>
      new Date(y, m, d, h, min, 0, 0).toISOString();

    const addDailyTask = (day: number): ReturnType<typeof addCalendarEvent> =>
      addCalendarEvent({
        title: 'Daily Kanji Rep',
        type: 'task',
        start: localIso(2026, 8, day, 18),
        end: localIso(2026, 8, day, 18, 30),
        recurrence: 'daily'
      });

    it('attaches a parentId + local dateKey to every occurrence', () => {
      const ev = addCalendarEvent({ title: 'One Shots', type: 'event', start: localIso(2026, 8, 10, 9) });
      const occ = getOccurrenceForDate(ev, new Date(2026, 8, 10, 12));
      expect(occ.parentId).toBe(ev.id);
      expect(occ.dateKey).toBe('2026-09-10');
      expect(dateKeyOf(new Date(2026, 8, 10, 12))).toBe('2026-09-10');

      const moved = getOccurrenceForDate(ev, new Date(2026, 8, 15, 12));
      expect(moved.dateKey).toBe('2026-09-15');
      expect(moved.start).toBe(localIso(2026, 8, 15, 9));
    });

    it('toggling one occurrence does not complete the rest of the series', () => {
      const task = addDailyTask(10);
      const dayA = () => getEventsForDate(state.calendar.events, new Date(2026, 8, 10, 12));
      const dayB = () => getEventsForDate(state.calendar.events, new Date(2026, 8, 11, 12));
      expect(dayA()[0].completed).toBe(false);
      expect(dayB()[0].completed).toBe(false);

      toggleTask(task.id, '2026-09-10');

      expect(dayA()[0].completed).toBe(true);
      expect(dayB()[0].completed).toBe(false);
      // The base event itself is untouched.
      expect(state.calendar.events.find(e => e.id === task.id)?.completed).toBe(false);
    });

    it('rewards each occurrence once, but never twice for the same occurrence', () => {
      const task = addDailyTask(10);
      const initialCoins = state.rpg.coins;

      toggleTask(task.id, '2026-09-10');
      expect(state.rpg.coins).toBe(initialCoins + 15);

      const coinsAfterFirst = state.rpg.coins;
      toggleTask(task.id, '2026-09-10'); // un-complete
      toggleTask(task.id, '2026-09-10'); // re-complete -> no second reward
      expect(state.rpg.coins).toBe(coinsAfterFirst);

      // A different day is a fresh occurrence and rewards again.
      toggleTask(task.id, '2026-09-11');
      expect(state.rpg.coins).toBe(coinsAfterFirst + 15);
    });

    it('updating one occurrence only affects that occurrence', () => {
      const task = addDailyTask(10);
      updateCalendarEvent(task.id, { title: 'Renamed Just Today' }, '2026-09-15');

      expect(getEventsForDate(state.calendar.events, new Date(2026, 8, 15, 12))[0].title).toBe('Renamed Just Today');
      expect(getEventsForDate(state.calendar.events, new Date(2026, 8, 16, 12))[0].title).toBe('Daily Kanji Rep');
      // Series stays intact.
      expect(state.calendar.events.find(e => e.id === task.id)?.title).toBe('Daily Kanji Rep');
    });

    it('updating the series without a dateKey changes the whole series', () => {
      const task = addDailyTask(10);
      updateCalendarEvent(task.id, { title: 'Series-Wide' });

      expect(getEventsForDate(state.calendar.events, new Date(2026, 8, 15, 12))[0].title).toBe('Series-Wide');
      expect(getEventsForDate(state.calendar.events, new Date(2026, 8, 16, 12))[0].title).toBe('Series-Wide');
    });

    it('deleting one occurrence hides only that day but keeps the series', () => {
      const task = addDailyTask(10);
      deleteCalendarEvent(task.id, '2026-09-15');

      expect(getEventsForDate(state.calendar.events, new Date(2026, 8, 15, 12))).toHaveLength(0);
      expect(getEventsForDate(state.calendar.events, new Date(2026, 8, 16, 12))).toHaveLength(1);
      expect(state.calendar.events.find(e => e.id === task.id)).toBeDefined();
    });

    it('deleting the series removes its events and all of its overrides', () => {
      const task = addDailyTask(10);
      deleteCalendarEvent(task.id, '2026-09-15');
      deleteCalendarEvent(task.id, '2026-09-16');
      expect(state.calendar.occurrenceOverrides.filter(o => o.parentId === task.id)).toHaveLength(2);

      deleteCalendarEvent(task.id);

      expect(state.calendar.events.some(e => e.id === task.id)).toBe(false);
      expect(state.calendar.occurrenceOverrides.some(o => o.parentId === task.id)).toBe(false);
    });

    it('moving an occurrence relocates only that instance to the new day', () => {
      const task = addDailyTask(10);
      expect(getEventsForDate(state.calendar.events, new Date(2026, 8, 12, 12))).toHaveLength(1);

      const moved = moveCalendarEvent(
        task.id,
        '2026-09-12',
        localIso(2026, 8, 13, 14),
        localIso(2026, 8, 13, 15)
      );
      expect(moved).toBe(true);

      const day12 = getEventsForDate(state.calendar.events, new Date(2026, 8, 12, 12));
      const day13 = getEventsForDate(state.calendar.events, new Date(2026, 8, 13, 12));
      expect(day12).toHaveLength(0);
      expect(day13).toHaveLength(1);
      expect(day13[0].start).toBe(localIso(2026, 8, 13, 14));
      expect(day13[0].end).toBe(localIso(2026, 8, 13, 15));

      // A fresh date in the same series still renders normally.
      expect(getEventsForDate(state.calendar.events, new Date(2026, 8, 14, 12))).toHaveLength(1);
    });

    it('rescheduling within the same day updates the time without deleting it', () => {
      const task = addDailyTask(10);
      moveCalendarEvent(task.id, '2026-09-12', localIso(2026, 8, 12, 20), localIso(2026, 8, 12, 21));

      const day12 = getEventsForDate(state.calendar.events, new Date(2026, 8, 12, 12));
      expect(day12).toHaveLength(1);
      expect(day12[0].start).toBe(localIso(2026, 8, 12, 20));
    });

    it('ignores occurrence paths for non-recurring events', () => {
      const ev = addCalendarEvent({ title: 'Single', type: 'event', start: localIso(2026, 8, 10, 9) });
      // A per-occurrence delete on a non-recurring event falls back to the
      // full delete path instead of creating an orphan override.
      deleteCalendarEvent(ev.id, '2026-09-10');
      expect(state.calendar.events.some(e => e.id === ev.id)).toBe(false);
      expect(state.calendar.occurrenceOverrides).toHaveLength(0);
    });
  });

  describe('LocalStorage Hydration & Migration', () => {
    it('persists and loads client state correctly from localStorage while excluding game state', () => {
      addCoins(350);
      unlockCosmetic('outfits', 'armor');
      saveState();

      // Clear state in memory
      setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
      expect(state.rpg.coins).toBe(DEFAULT_RPG.coins);

      loadState();
      // Game state (coins, cosmetics) is server-authoritative and not persisted in localStorage
      expect(state.rpg.coins).toBe(DEFAULT_RPG.coins);
      expect(isCosmeticUnlocked('armor')).toBe(false);
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

    it('restores the selected holiday countries from cloud settings_data', async () => {
      setState('user', { id: 'u1', username: 'CloudSettings', token: 'ws_cloud' });
      setState('settings', 'countryHolidays', []);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          progress: { coins: 200, settings_data: { theme: 'neon', countryHolidays: ['JP', 'GB', 'ZZ', 'de'] } },
          inventory: [],
          showcaseItems: []
        })
      }));

      await loadCloudProgress('ws_cloud');

      // The same sanitizer is used everywhere, so codes are uppercased and
      // invalid entries are dropped before they reach the local state.
      expect(state.settings.theme).toBe('neon');
      expect(state.settings.countryHolidays).toEqual(['JP', 'GB', 'ZZ', 'DE']);
    });

    it('adopts the server calendar list when the cloud has calendar items', async () => {
      setState('user', { id: 'u1', username: 'CloudCal', token: 'ws_cloud' });
      setState('calendar', 'events', []);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          progress: { coins: 200 },
          inventory: [],
          showcaseItems: [],
          calendarItems: [
            { id: 'c1', title: 'Cloud Sunset', start: '2026-09-12T19:00:00Z', end: '2026-09-12T20:00:00Z', allDay: false, type: 'event', completed: false, color: '#6c5ce7', recurrence: 'none' },
            { id: 'c2', title: 'Kanji Rep', start: '2026-09-12T18:00:00Z', end: '2026-09-12T18:30:00Z', allDay: false, type: 'task', completed: true, color: 'not-a-hex', recurrence: 'daily' }
          ]
        })
      }));

      await loadCloudProgress('ws_cloud');

      expect(state.calendar.events).toHaveLength(2);
      expect(state.calendar.events.map(e => e.id)).toEqual(['c1', 'c2']);
      expect(state.calendar.events[0].title).toBe('Cloud Sunset');
      // Invalid hex is sanitized to the default color.
      expect(state.calendar.events[1].color).toBe('#ff6584');
      expect(state.calendar.events[1].completed).toBe(true);
    });

    it('keeps the local calendar when the cloud has no calendar items', async () => {
      setState('user', { id: 'u1', username: 'LocalCal', token: 'ws_cloud' });
      setState('calendar', 'events', [{ id: 'local-1', title: 'Local Event', start: new Date().toISOString(), end: new Date().toISOString(), allDay: false, type: 'event', completed: false, color: '#ff6584', recurrence: 'none' }]);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, progress: { coins: 200 }, inventory: [], showcaseItems: [], calendarItems: [] })
      }));

      await loadCloudProgress('ws_cloud');

      expect(state.calendar.events.map(e => e.id)).toEqual(['local-1']);
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

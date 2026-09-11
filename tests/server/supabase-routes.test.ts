import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  state: {
    configured: true,
    client: null as any | null,
    db: {
      profiles: [] as any[],
      user_progress: [] as any[],
      user_showcase: [] as any[],
      user_inventory: [] as any[],
      calendar_items: [] as any[],
      action_logs: [] as any[],
      leaderboard_view: [] as any[]
    },
    signUpCalls: [] as any[],
    signInCalls: [] as any[]
  }
}));

vi.mock('../../src/lib/server/supabase', () => ({
  isSupabaseConfigured: () => mocks.state.configured,
  getSupabaseServerClient: () => mocks.state.client
}));

import { POST as registerPOST } from '../../src/routes/api/auth/register';
import { POST as loginPOST } from '../../src/routes/api/auth/login';
import { POST as syncPOST, GET as syncGET } from '../../src/routes/api/sync/progress';
import { POST as rollPOST } from '../../src/routes/api/gacha/roll';
import { GET as leaderboardGET } from '../../src/routes/api/leaderboard';
import { createSessionToken } from '../../src/lib/server/auth';
import { COSMETIC_CATALOG } from '../../src/lib/store';

function randomId(): string {
  return crypto.randomUUID();
}

/**
 * Builds an in-memory fake Supabase client whose behaviour mirrors the surface
 * the API routes use: auth.signUp / signInWithPassword and chainable table
 * queries (select / eq / ilike / order / limit / maybeSingle / single / insert /
 * upsert / delete).
 */
function buildFakeClient() {
  const db = mocks.state.db;

  const notFound = { data: null, error: { message: 'No rows returned' } };

  const chains: Record<string, any> = {};

  for (const table of Object.keys(db)) {
    chains[table] = buildTable(table);
  }

  function buildTable(table: string) {
    const exec = (filters: Array<(row: any) => boolean>, mode: 'read' | 'delete') => {
      if (mode === 'delete') {
        db[table] = (db[table] || []).filter(row => !filters.some(f => f(row)));
        return { data: null, error: null };
      }
      let rows = (db[table] || []).slice();
      for (const f of filters) rows = rows.filter(r => f(r));
      return { data: rows, error: null };
    };

    return function makeQuery(state: {
      filters: Array<(row: any) => boolean>;
      orderBy?: { col: string; asc: boolean };
      limit?: number;
      mode: 'read' | 'delete' | 'insert' | 'upsert';
      pending?: any[];
    } = { filters: [], orderBy: undefined, limit: undefined, mode: 'read', pending: undefined }) {
      const q = {
        select() {
          return q;
        },
        eq(col: string, val: any) {
          return chains[table]({ ...state, filters: [...state.filters, (row: any) => row && row[col] === val] });
        },
        ilike(col: string, val: any) {
          return chains[table]({
            ...state,
            filters: [...state.filters, (row: any) => row && String(row[col])?.toLowerCase() === String(val).toLowerCase()]
          });
        },
        order(col: string, opts?: { ascending?: boolean }) {
          return chains[table]({
            ...state,
            orderBy: { col, asc: opts?.ascending !== false }
          });
        },
        limit(n: number) {
          return chains[table]({ ...state, limit: n });
        },
        maybeSingle() {
          const res = exec(state.filters, 'read');
          const first = res.data?.[0] ?? null;
          return Promise.resolve({ data: first, error: first === null ? notFound.error : null });
        },
        single() {
          const res = exec(state.filters, 'read');
          const first = res.data?.[0] ?? null;
          return Promise.resolve({ data: first, error: first === null ? notFound.error : null });
        },
        insert(rows: any | any[]) {
          const list = Array.isArray(rows) ? rows : [rows];
          db[table] = (db[table] || []).concat(list.map(r => ({ ...r })));
          return Promise.resolve({ data: list, error: null });
        },
        upsert(rows: any | any[]) {
          const list = Array.isArray(rows) ? rows : [rows];
          const src = db[table] || (db[table] = []);
          for (const row of list) {
            const keyCol = table === 'user_progress' ? 'user_id' : 'id';
            const idx = src.findIndex(r => r[keyCol] === row[keyCol]);
            if (idx >= 0) src[idx] = { ...src[idx], ...row };
            else src.push({ ...row });
          }
          return Promise.resolve({ data: list, error: null });
        },
        delete() {
          return chains[table]({ ...state, mode: 'delete' });
        },
        then(onFulfilled: (v: any) => any) {
          if (state.mode === 'delete') return Promise.resolve(exec(state.filters, 'delete')).then(onFulfilled);
          let rows = exec(state.filters, 'read').data;
          if (state.orderBy) {
            const { col, asc } = state.orderBy!;
            rows = [...rows].sort((a, b) => (asc ? (a[col] ?? 0) - (b[col] ?? 0) : (b[col] ?? 0) - (a[col] ?? 0)));
          }
          if (state.limit !== undefined) rows = rows.slice(0, state.limit);
          return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
        }
      };
      return q;
    };
  }

  const auth = {
    signUp: vi.fn(async ({ email }: { email: string }) => {
      const user = { id: randomId(), email, email_confirmed_at: new Date().toISOString() };
      mocks.state.signUpCalls.push({ email });
      return { data: { user, session: null }, error: null };
    }),
    signInWithPassword: vi.fn(async ({ email }: { email: string }) => {
      mocks.state.signInCalls.push({ email });
      const profile = (db.profiles || []).find(p => p.email === email);
      const user = profile
        ? { id: profile.id, email: profile.email }
        : { id: randomId(), email };
      return { data: { user, session: {} }, error: null };
    })
  };

  return {
    auth,
    from: (table: string) => chains[table]?.() ?? chains[table]
  } as unknown as SupabaseClient;
}

function req(url: string, init?: RequestInit): { request: Request } {
  return { request: new Request(url, init) };
}

describe('Supabase-backed API routes (regression guard)', () => {
  beforeEach(() => {
    mocks.state.configured = true;
    mocks.state.signUpCalls = [];
    mocks.state.signInCalls = [];
    for (const key of Object.keys(mocks.state.db)) {
      mocks.state.db[key] = [];
    }
    mocks.state.client = buildFakeClient();
  });

  describe('register', () => {
    it('writes the account to Supabase (auth + profile + progress), NOT the local fallback', async () => {
      const res = await registerPOST(
        req('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'CloudKnight', email: 'cloud@waifuspace.moe', password: 'Passw0rd!' })
        })
      );

      const data = await res.json();
      expect(data.success).toBe(true);
      // Supabase users get UUIDs; the in-memory fallback would produce "usr_..."
      expect(data.user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(data.user.id.startsWith('usr_')).toBe(false);

      expect(mocks.state.signUpCalls).toHaveLength(1);
      expect(mocks.state.signUpCalls[0].email).toBe('cloud@waifuspace.moe');

      expect(mocks.state.db.profiles).toHaveLength(1);
      expect(mocks.state.db.profiles[0]).toMatchObject({ id: data.user.id, username: 'CloudKnight', email: 'cloud@waifuspace.moe' });

      expect(mocks.state.db.user_progress).toHaveLength(1);
      expect(mocks.state.db.user_progress[0]).toMatchObject({ user_id: data.user.id, coins: 200, bond_level: 1, bond_exp: 0 });
    });

    it('rejects duplicate usernames with 409 before creating an orphan auth user', async () => {
      const first = await registerPOST(
        req('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'DupUser', email: 'dup1@waifuspace.moe', password: 'Passw0rd!' })
        })
      );
      expect(first.status).toBe(200);

      const second = await registerPOST(
        req('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'dupuser', email: 'dup2@waifuspace.moe', password: 'Passw0rd!' })
        })
      );
      expect(second.status).toBe(409);
      const data = await second.json();
      expect(data.success).toBe(false);
      // No second auth signup happened for the duplicate username
      expect(mocks.state.signUpCalls).toHaveLength(1);
      expect(mocks.state.db.profiles).toHaveLength(1);
    });
  });

  describe('login', () => {
    it('resolves the username to the account email stored in Supabase', async () => {
      // Register with a real personal email (not the @waifuspace.moe default)
      await registerPOST(
        req('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'HeroKid', email: 'hero@gmail.com', password: 'Passw0rd!' })
        })
      );

      const res = await loginPOST(
        req('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'herokid', password: 'Passw0rd!' })
        })
      );

      expect(res.status).toBe(200);
      // signInWithPassword must receive the real email, not just username@waifuspace.moe
      expect(mocks.state.signInCalls).toHaveLength(1);
      expect(mocks.state.signInCalls[0].email).toBe('hero@gmail.com');

      const data = await res.json();
      expect(data.user.username).toBe('HeroKid');
    });

    it('falls back to username@waifuspace.moe when no profile row exists', async () => {
      const res = await loginPOST(
        req('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'GhostLogin', password: 'Passw0rd!' })
        })
      );
      expect(res.status).toBe(200);
      expect(mocks.state.signInCalls).toHaveLength(1);
      expect(mocks.state.signInCalls[0].email).toBe('ghostlogin@waifuspace.moe');
    });

    it('is skipped entirely (no fallback user) when Supabase is not configured', async () => {
      mocks.state.configured = false;
      mocks.state.client = null;
      // No local user named this either, so login must fail cleanly
      const res = await loginPOST(
        req('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'Nobody', password: 'Passw0rd!' })
        })
      );
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('sync/progress', () => {
    const userId = '83a2f9db-6a0e-4f5b-bcc4-9d0ee2d11abc';
    const token = createSessionToken({ id: userId, username: 'Syncer', email: 'syncer@waifuspace.moe' });

    it('upserts progress and replaces showcase slots', async () => {
      const res = await syncPOST(
        req('http://localhost/api/sync/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            waifu: { name: 'Neo', personality: 'kuudere', bondExp: 500, bondLevel: 7, appearance: { outfit: 'kimono', accessory: 'flower_pin', hairstyle: 'wavy', hairColor: '#fff', eyeColor: '#000', skinTone: '#fff', customAvatarUrl: '', avatarMode: 'svg' } },
            rpg: {
              coins: 3400,
              defenseHighWave: 18,
              defenseStats: { totalVictories: 9, goblinsDefeated: 132 },
              claimedAffectionMilestones: [2, 3],
              showcaseItems: ['kimono', 'flower_pin']
            },
            settings: { theme: 'tokyo' }
          })
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const progress = mocks.state.db.user_progress.find(p => p.user_id === userId);
      expect(progress).toBeDefined();
      expect(progress.coins).toBe(3400);
      expect(progress.bond_level).toBe(7);
      expect(progress.waifu_name).toBe('Neo');
      expect(progress.defense_high_wave).toBe(18);
      expect(progress.goblins_defeated).toBe(132);
      expect(progress.claimed_milestones).toEqual([2, 3]);
      expect(progress.settings_data).toEqual({ theme: 'tokyo' });

      const showcase = mocks.state.db.user_showcase.filter(s => s.user_id === userId);
      expect(showcase.map(s => s.item_id)).toEqual(['kimono', 'flower_pin']);
    });

    it('persists unlocked inventory into user_inventory', async () => {
      mocks.state.db.user_progress.push({ user_id: userId, coins: 200 });

      const res = await syncPOST(
        req('http://localhost/api/sync/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            waifu: { name: 'Neo', personality: 'kuudere', bondExp: 0, bondLevel: 1, appearance: {} },
            rpg: {
              coins: 200,
              unlockedOutfits: ['seifuku', 'kimono'],
              unlockedAccessories: ['ribbon', 'cat_ears'],
              unlockedHairstyles: ['twintails'],
              claimedAffectionMilestones: [],
              defenseStats: {},
              showcaseItems: []
            },
            settings: {}
          })
        })
      );
      expect(res.status).toBe(200);

      const inventory = mocks.state.db.user_inventory.filter(r => r.user_id === userId);
      const byCategory = (cat: string) => inventory.filter(r => r.category === cat).map(r => r.item_id).sort();
      expect(byCategory('outfit')).toEqual(['kimono', 'seifuku']);
      expect(byCategory('accessory')).toEqual(['cat_ears', 'ribbon']);
      expect(byCategory('hairstyle')).toEqual(['twintails']);
      expect(inventory.every(r => r.rarity !== 'none')).toBe(true);
    });

    it('coins are increase-only: a stale client cannot roll back the server balance', async () => {
      mocks.state.db.user_progress.push({ user_id: userId, coins: 1000, bond_level: 1 });

      const res = await syncPOST(
        req('http://localhost/api/sync/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            waifu: { name: 'OldClient', personality: 'tsundere', bondExp: 0, bondLevel: 1, appearance: {} },
            rpg: { coins: 5, claimedAffectionMilestones: [], defenseStats: {}, showcaseItems: [] },
            settings: {}
          })
        })
      );
      expect(res.status).toBe(200);

      const progress = mocks.state.db.user_progress.find(p => p.user_id === userId);
      expect(progress.coins).toBe(1000); // NOT rolled back to 5
    });

    it('filters claimed milestones that the current bond level does not grant', async () => {
      const res = await syncPOST(
        req('http://localhost/api/sync/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            waifu: { name: 'Cheater', personality: 'tsundere', bondExp: 0, bondLevel: 3, appearance: {} },
            rpg: { coins: 50, claimedAffectionMilestones: [2, 99, 3], defenseStats: {}, showcaseItems: [] },
            settings: {}
          })
        })
      );
      expect(res.status).toBe(200);

      const progress = mocks.state.db.user_progress.find(p => p.user_id === userId);
      expect(progress.claimed_milestones).toEqual([2, 3]);
    });

    it('ignores inventory and showcase items that are not in the catalog', async () => {
      const res = await syncPOST(
        req('http://localhost/api/sync/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            waifu: { name: 'Forger', personality: 'tsundere', bondExp: 0, bondLevel: 1, appearance: {} },
            rpg: {
              coins: 100,
              unlockedOutfits: ['seifuku', 'totally_fake_item'],
              unlockedAccessories: [],
              unlockedHairstyles: [],
              claimedAffectionMilestones: [],
              defenseStats: {},
              showcaseItems: ['seifuku', 'fake_showcase', 'none']
            },
            settings: {}
          })
        })
      );
      expect(res.status).toBe(200);

      const inventory = mocks.state.db.user_inventory.filter(r => r.user_id === userId);
      expect(inventory.map(r => r.item_id)).toEqual(['seifuku']);

      // 'fake_showcase' is not in the catalog and is dropped; 'none' is a valid
      // catalog id so it is preserved.
      const showcase = mocks.state.db.user_showcase.filter(s => s.user_id === userId);
      expect(showcase.map(s => s.item_id)).toEqual(['seifuku', 'none']);
    });

    it('returns progress + inventory + showcase on GET', async () => {
      mocks.state.db.user_progress.push({
        user_id: userId,
        coins: 777,
        bond_exp: 0,
        bond_level: 5,
        waifu_name: 'Neo',
        waifu_personality: 'kuudere',
        worn_outfit: 'kimono',
        worn_accessory: 'flower_pin',
        worn_hairstyle: 'wavy',
        appearance_data: {},
        settings_data: {},
        claimed_milestones: [2],
        defense_high_wave: 12,
        defense_victories: 3,
        goblins_defeated: 40
      });
      mocks.state.db.user_showcase.push({ user_id: userId, slot_index: 0, item_id: 'kimono' });
      mocks.state.db.user_inventory.push({ user_id: userId, item_id: 'kimono', category: 'outfit', rarity: 'rare' });

      const res = await syncGET(
        req('http://localhost/api/sync/progress', { headers: { Authorization: `Bearer ${token}` } })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.progress.coins).toBe(777);
      expect(data.progress.bond_level).toBe(5);
      expect(data.inventory.map((i: any) => i.item_id)).toEqual(['kimono']);
      expect(data.showcaseItems).toEqual(['kimono']);
    });

    it('replaces calendar_items on POST and sanitizes/validates invalid rows', async () => {
      mocks.state.db.calendar_items.push({ user_id: userId, item_id: 'stale', title: 'Old' });

      const res = await syncPOST(
        req('http://localhost/api/sync/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            waifu: { name: 'Neo', personality: 'kuudere', bondExp: 0, bondLevel: 1, appearance: {} },
            rpg: { coins: 200, claimedAffectionMilestones: [], defenseStats: {}, showcaseItems: [] },
            settings: {},
            calendar: [
              { id: 'evt-1', title: 'Sprint Review', start: '2026-09-10T10:00:00Z', end: '2026-09-10T11:00:00Z', allDay: false, type: 'event', completed: false, color: '#ff6584', description: 'sync', location: 'Room 4', recurrence: 'none' },
              { id: 'task-1', title: 'Study Kanji', start: '2026-09-10T18:00:00Z', end: '2026-09-10T18:30:00Z', allDay: false, type: 'task', completed: true, color: '#00cec9', recurrence: 'daily' },
              { id: 'bad-1', title: '', start: 'not-a-date' },
              { id: 'bad-2', title: 'Bad Color', start: '2026-09-10T09:00:00Z', type: 'event', color: 'not-a-hex', recurrence: 'fortnightly' }
            ]
          })
        })
      );
      expect(res.status).toBe(200);

      const rows = mocks.state.db.calendar_items.filter(r => r.user_id === userId);
      expect(rows.map(r => r.item_id).sort((a, b) => a.localeCompare(b))).toEqual(['bad-2', 'evt-1', 'task-1']);
      expect(rows.find(r => r.item_id === 'bad-2')).toMatchObject({ color: '#ff6584', recurrence: 'none', type: 'event' });
      expect(rows.find(r => r.item_id === 'task-1').completed).toBe(true);
      expect(rows.find(r => r.item_id === 'evt-1')).toMatchObject({
        title: 'Sprint Review',
        start_at: '2026-09-10T10:00:00.000Z',
        description: 'sync',
        location: 'Room 4'
      });
    });

    it('returns calendar_items on GET mapped back to event shape', async () => {
      mocks.state.db.user_progress.push({ user_id: userId, coins: 200, bond_level: 1 });
      mocks.state.db.calendar_items.push({
        user_id: userId,
        item_id: 'cloud-ev-1',
        title: 'Cloud Synced Dinner',
        start_at: '2026-09-12T19:00:00.000Z',
        end_at: '2026-09-12T20:00:00.000Z',
        all_day: false,
        type: 'event',
        completed: false,
        color: '#6c5ce7',
        description: 'from the cloud',
        location: 'Cafe',
        recurrence: 'weekly'
      });

      const res = await syncGET(
        req('http://localhost/api/sync/progress', { headers: { Authorization: `Bearer ${token}` } })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.calendarItems).toHaveLength(1);
      expect(data.calendarItems[0]).toEqual({
        id: 'cloud-ev-1',
        title: 'Cloud Synced Dinner',
        start: '2026-09-12T19:00:00.000Z',
        end: '2026-09-12T20:00:00.000Z',
        allDay: false,
        type: 'event',
        completed: false,
        color: '#6c5ce7',
        description: 'from the cloud',
        location: 'Cafe',
        recurrence: 'weekly'
      });
    });

    it('rejects requests without a valid session', async () => {
      const res = await syncGET(req('http://localhost/api/sync/progress', {}));
      expect(res.status).toBe(401);
    });
  });

  describe('gacha/roll (server-authoritative)', () => {
    const userId = '5a7f9d4c-8e61-4a3b-bc2d-1a2b3c4d5e6f';
    const token = createSessionToken({ id: userId, username: 'Roller', email: 'roller@waifuspace.moe' });

    it('deducts the cost from the DB balance, inserts the item, and audits the roll', async () => {
      mocks.state.db.user_progress.push({ user_id: userId, coins: 500 });

      const res = await rollPOST(
        req('http://localhost/api/gacha/roll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ boxType: 'standard', currentCoins: 999999, unlockedItemIds: [] })
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isDuplicate).toBe(false);

      // Uses the DB balance (500) as source of truth - NOT the forged 999999.
      // Standard chest costs 120, so DB coins end at 380.
      const progress = mocks.state.db.user_progress.find(p => p.user_id === userId);
      expect(progress.coins).toBe(380);

      // Newly unlocked item persisted to inventory
      expect(mocks.state.db.user_inventory.filter(r => r.user_id === userId).length).toBe(1);

      // Audit trail written
      const logs = mocks.state.db.action_logs.filter(r => r.user_id === userId);
      expect(logs).toHaveLength(1);
      expect(logs[0].action_type).toBe('lootbox_open');
      expect(logs[0].details.box_type).toBe('standard');
      expect(logs[0].details.item_id).toBe(data.result.item.id);
      expect(logs[0].details.is_duplicate).toBe(false);
    });

    it('grants duplicate compensation from the DB balance and does not insert a new item', async () => {
      mocks.state.db.user_progress.push({ user_id: userId, coins: 500 });
      // Pre-unlock every cosmetic so the roll is always a duplicate
      mocks.state.db.user_inventory = COSMETIC_CATALOG.filter(c => c.id !== 'none').map(c => ({
        user_id: userId,
        item_id: c.id,
        category: c.category,
        rarity: c.rarity
      }));

      const res = await rollPOST(
        req('http://localhost/api/gacha/roll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ boxType: 'standard', currentCoins: 0, unlockedItemIds: [] })
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isDuplicate).toBe(true);

      // 500 - 120 + duplicate compensation (>=25 for common) => 405+
      const progress = mocks.state.db.user_progress.find(p => p.user_id === userId);
      expect(progress.coins).toBeGreaterThanOrEqual(405);
      expect(progress.coins).toBeLessThan(580);

      // No new inventory row added on a duplicate
      expect(mocks.state.db.user_inventory.filter(r => r.user_id === userId).length)
        .toBe(COSMETIC_CATALOG.filter(c => c.id !== 'none').length);

      const logs = mocks.state.db.action_logs.filter(r => r.user_id === userId);
      expect(logs).toHaveLength(1);
      expect(logs[0].details.is_duplicate).toBe(true);
    });

    it('rejects a roll when the DB balance is below the chest cost', async () => {
      mocks.state.db.user_progress.push({ user_id: userId, coins: 50 });

      const res = await rollPOST(
        req('http://localhost/api/gacha/roll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ boxType: 'royal', currentCoins: 999999, unlockedItemIds: [] })
        })
      );

      expect(res.status).toBe(400);
      // No action log from a rejected roll
      expect(mocks.state.db.action_logs.filter(r => r.user_id === userId)).toHaveLength(0);
    });
  });

  describe('leaderboard', () => {
    it('returns entries sorted by the requested filter when Supabase has data', async () => {
      mocks.state.db.leaderboard_view = [
        { username: 'Abe', defense_high_wave: 10, bond_level: 2, goblins_defeated: 50, coins: 100 },
        { username: 'Char', defense_high_wave: 30, bond_level: 5, goblins_defeated: 90, coins: 400 },
        { username: 'Bob', defense_high_wave: 30, bond_level: 9, goblins_defeated: 30, coins: 700 },
        { username: 'Dan', defense_high_wave: 20, bond_level: 4, goblins_defeated: 120, coins: 250 }
      ];

      const wave = await leaderboardGET(req('http://localhost/api/leaderboard?sort=wave'));
      const waveData = await wave.json();
      expect(waveData.entries.map((e: any) => e.username)).toEqual(['Char', 'Bob', 'Dan', 'Abe']);

      const bond = await leaderboardGET(req('http://localhost/api/leaderboard?sort=bond'));
      const bondData = await bond.json();
      expect(bondData.entries.map((e: any) => e.username)).toEqual(['Bob', 'Char', 'Dan', 'Abe']);

      const goblins = await leaderboardGET(req('http://localhost/api/leaderboard?sort=goblins'));
      const goblinsData = await goblins.json();
      expect(goblinsData.entries.map((e: any) => e.username)).toEqual(['Dan', 'Char', 'Abe', 'Bob']);

      expect(waveData.entries[0].rank).toBe(1);
    });

    it('falls back to the demo board when Supabase has no data', async () => {
      const res = await leaderboardGET(req('http://localhost/api/leaderboard'));
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.entries.length).toBeGreaterThan(0);
      expect(data.entries.map((e: any) => e.username)).toContain('SakuraEmpress');
    });
  });
});
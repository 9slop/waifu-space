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
import { GET as leaderboardGET } from '../../src/routes/api/leaderboard';
import { createSessionToken } from '../../src/lib/server/auth';

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

    it('rejects requests without a valid session', async () => {
      const res = await syncGET(req('http://localhost/api/sync/progress', {}));
      expect(res.status).toBe(401);
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
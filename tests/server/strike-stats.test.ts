import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: {
    configured: true,
    client: null as any | null,
    db: {
      user_progress: [] as any[],
      action_logs: [] as any[]
    }
  }
}));

vi.mock('../../src/lib/server/supabase', () => ({
  isSupabaseConfigured: () => mocks.state.configured,
  getSupabaseServerClient: () => mocks.state.client
}));

import { POST as strikeStatsPOST } from '../../src/routes/api/strike/stats';
import { createSessionToken, SESSION_COOKIE_NAME } from '../../src/lib/server/auth';

function buildFakeClient() {
  const db = mocks.state.db;

  return {
    from: (table: string) => {
      const state = {
        filters: [] as Array<(r: any) => boolean>,
        selectFields: '*',
        updateData: null as any,
        insertData: null as any
      };

      const builder: any = {
        select: (fields: string) => {
          state.selectFields = fields;
          return builder;
        },
        eq: (col: string, val: any) => {
          state.filters.push((r: any) => r[col] === val);
          return builder;
        },
        single: async () => {
          const rows = (db as any)[table] || [];
          const match = rows.find((r: any) => state.filters.every(f => f(r)));
          if (!match) return { data: null, error: { message: 'Not found' } };
          return { data: { ...match }, error: null };
        },
        update: (data: any) => {
          state.updateData = data;
          return {
            eq: async (col: string, val: any) => {
              const rows = (db as any)[table] || [];
              const idx = rows.findIndex((r: any) => r[col] === val && state.filters.every(f => f(r)));
              if (idx !== -1) {
                rows[idx] = { ...rows[idx], ...data };
                return { data: rows[idx], error: null };
              }
              return { data: null, error: null };
            }
          };
        },
        insert: async (data: any) => {
          const rows = (db as any)[table] || [];
          const record = Array.isArray(data) ? data : [data];
          rows.push(...record);
          return { data: record, error: null };
        }
      };

      return builder;
    }
  };
}

describe('POST /api/strike/stats', () => {
  beforeEach(() => {
    mocks.state.configured = true;
    mocks.state.db.user_progress = [];
    mocks.state.db.action_logs = [];
    mocks.state.client = buildFakeClient();
  });

  it('rejects non-object or missing request body', async () => {
    const req = new Request('http://localhost/api/strike/stats', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' }
    });

    const res = await strikeStatsPOST({ request: req });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid payload');
  });

  it('handles guest / unauthenticated player sessions gracefully', async () => {
    const req = new Request('http://localhost/api/strike/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        durationSeconds: 120,
        kills: 10,
        deaths: 4,
        headshots: 3,
        bestStreak: 5,
        damageDealt: 1200
      })
    });

    const res = await strikeStatsPOST({ request: req });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.authenticated).toBe(false);
    expect(data.kills).toBe(10);
    expect(data.headshots).toBe(3);
    // 10 kills * 8 + streak bonus 25 = 105
    expect(data.coinsEarned).toBe(105);
    // 10 kills * 15 + 3 hs * 10 + streak bonus 50 = 230
    expect(data.expEarned).toBe(230);
  });

  it('anti-tamper clamps implausible kill rates and invalid streaks', async () => {
    const req = new Request('http://localhost/api/strike/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        durationSeconds: 10, // 10 seconds cannot have 100 kills (limit: max(10, 10 * 1.5) = 15)
        kills: 100,
        deaths: 2,
        headshots: 50,
        bestStreak: 80,
        damageDealt: 99999
      })
    });

    const res = await strikeStatsPOST({ request: req });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    // Clamped to 15
    expect(data.kills).toBe(15);
    expect(data.headshots).toBeLessThanOrEqual(15);
    expect(data.bestStreak).toBeLessThanOrEqual(15);
  });

  it('records match to database and updates progress for authenticated user', async () => {
    const userId = 'user_strike_test_1';
    mocks.state.db.user_progress.push({
      user_id: userId,
      coins: 100,
      bond_exp: 50,
      settings_data: {
        waifuStrike: {
          kills: 20,
          deaths: 10,
          headshots: 5,
          bestStreak: 4,
          matches: 2
        }
      }
    });

    const token = createSessionToken({ id: userId, username: 'TestSoldier' });
    const req = new Request('http://localhost/api/strike/stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `${SESSION_COOKIE_NAME}=${token}`
      },
      body: JSON.stringify({
        durationSeconds: 180,
        kills: 8,
        deaths: 3,
        headshots: 4,
        bestStreak: 6,
        damageDealt: 950
      })
    });

    const res = await strikeStatsPOST({ request: req });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.authenticated).toBe(true);

    // Coins: 100 + (8 * 8 + 25) = 100 + 89 = 189
    expect(data.newCoins).toBe(189);
    // Exp: 50 + (8 * 15 + 4 * 10 + 50) = 50 + (120 + 40 + 50) = 260
    expect(data.newBondExp).toBe(260);

    // Verify DB user_progress was updated
    const saved = mocks.state.db.user_progress.find(p => p.user_id === userId);
    expect(saved.coins).toBe(189);
    expect(saved.bond_exp).toBe(260);
    expect(saved.settings_data.waifuStrike.kills).toBe(28);
    expect(saved.settings_data.waifuStrike.deaths).toBe(13);
    expect(saved.settings_data.waifuStrike.headshots).toBe(9);
    expect(saved.settings_data.waifuStrike.bestStreak).toBe(6); // max(4, 6)
    expect(saved.settings_data.waifuStrike.matches).toBe(3);

    // Verify action_logs audit log
    expect(mocks.state.db.action_logs.length).toBe(1);
    expect(mocks.state.db.action_logs[0].action_type).toBe('strike_match_complete');
    expect(mocks.state.db.action_logs[0].user_id).toBe(userId);
  });
});

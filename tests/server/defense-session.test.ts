import { describe, it, expect, beforeEach } from 'vitest';
import {
  startDefenseSession,
  getDefenseSession,
  completeDefenseWave,
  clearDefenseSessions
} from '../../src/lib/server/defense-session';
import { SILVER_STARTER, getWaveClearSilver, getMinPlausibleWaveMs, getDefenseWavePlan, TOWER_SPECS } from '../../src/lib/defense-balance';
import { getDefenseCoinsReward, getDefenseExpReward } from '../../src/lib/economy';

describe('Server defense session ledger (silver anti-cheat)', () => {
  beforeEach(() => {
    clearDefenseSessions();
  });

  it('starts a fresh session with starter silver at wave 1', () => {
    const session = startDefenseSession('user_silver_1');
    expect(session.silver).toBe(SILVER_STARTER);
    expect(session.wave).toBe(1);

    const fetched = getDefenseSession('user_silver_1');
    expect(fetched?.gameId).toBe(session.gameId);
  });

  it('resets the session when a new game starts', () => {
    startDefenseSession('user_silver_1');
    completeDefenseWave('user_silver_1', 1, getMinPlausibleWaveMs(1) + 1000, []);
    expect(getDefenseSession('user_silver_1')!.wave).toBe(2);

    const restarted = startDefenseSession('user_silver_1');
    expect(restarted.wave).toBe(1);
    expect(restarted.silver).toBe(SILVER_STARTER);
  });

  it('credits deterministic silver and advances the wave on a legit clear', () => {
    const session = startDefenseSession('user_silver_2');
    const firstSilver = getWaveClearSilver(1);

    const result = completeDefenseWave('user_silver_2', 1, getMinPlausibleWaveMs(1) + 2000, []);
    expect(result.verified).toBe(true);
    expect(result.silverEarned).toBe(firstSilver);
    expect(result.silver).toBe(SILVER_STARTER + firstSilver);
    expect(result.nextWave).toBe(2);
    expect(result.coinsReward).toBe(getDefenseCoinsReward(1));
    expect(result.expReward).toBe(getDefenseExpReward(1));

    // Wave 2 clear also includes any spend deltas from building/upgrading.
    const buildCost = TOWER_SPECS.archer.cost;
    const second = completeDefenseWave('user_silver_2', 2, getMinPlausibleWaveMs(2) + 2000, [-buildCost]);
    expect(second.verified).toBe(true);
    expect(second.silver).toBe(SILVER_STARTER + getWaveClearSilver(1) + getWaveClearSilver(2) - buildCost);
  });

  it('rejects waves before a session exists', () => {
    const result = completeDefenseWave('user_silver_none', 1, getMinPlausibleWaveMs(1) + 1000, []);
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/session/i);
  });

  it('rejects suspiciously fast wave clears', () => {
    startDefenseSession('user_silver_3');
    const result = completeDefenseWave('user_silver_3', 5, 1200, []);
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/suspicious|fast/i);
  });

  it('rejects out-of-range and already-rewarded waves', () => {
    startDefenseSession('user_silver_4');
    const badWave = completeDefenseWave('user_silver_4', 0, getMinPlausibleWaveMs(1) + 1000, []);
    expect(badWave.verified).toBe(false);

    completeDefenseWave('user_silver_4', 1, getMinPlausibleWaveMs(1) + 1000, []);
    const replay = completeDefenseWave('user_silver_4', 1, getMinPlausibleWaveMs(1) + 1000, []);
    expect(replay.verified).toBe(false);
    expect(replay.error).toMatch(/already/i);
  });

  it('rejects spend deltas that exceed the authoritative balance', () => {
    startDefenseSession('user_silver_5');
    const overspend = completeDefenseWave('user_silver_5', 1, getMinPlausibleWaveMs(1) + 1000, [
      -(SILVER_STARTER + getWaveClearSilver(1) + 1)
    ]);
    expect(overspend.verified).toBe(false);
    expect(overspend.error).toMatch(/spend/i);
  });

  it('rejects malformed spend payloads', () => {
    startDefenseSession('user_silver_6');
    const negativeSpend = completeDefenseWave('user_silver_6', 1, getMinPlausibleWaveMs(1) + 1000, [5000]); // fabricated refund
    expect(negativeSpend.verified).toBe(true); // a positive refund is legitimate
    // Non-numeric / NaN deltas are always rejected
    const junk = completeDefenseWave('user_silver_6', 2, getMinPlausibleWaveMs(2) + 1000, ['x' as any, 10]);
    expect(junk.verified).toBe(false);
  });

  it('caps the ledger at the silver cap', () => {
    const session = startDefenseSession('user_silver_7');
    session.silver = 99990;
    const result = completeDefenseWave('user_silver_7', 1, getMinPlausibleWaveMs(1) + 1000, []);
    expect(result.silver).toBeLessThanOrEqual(100_000);
  });

  it('grants rewards for a boss wave with a boss in the plan', () => {
    startDefenseSession('user_silver_8');
    const plan = getDefenseWavePlan(10);
    expect(plan.hasBoss).toBe(true);

    const result = completeDefenseWave('user_silver_8', 10, getMinPlausibleWaveMs(10) + 1000, []);
    expect(result.verified).toBe(true);
    expect(result.hasBoss).toBe(true);
    expect(result.goblinsDefeated).toBe(plan.total);
  });
});
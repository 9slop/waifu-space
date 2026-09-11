import { describe, it, expect } from 'vitest';
import {
  TOWER_SPECS,
  ENEMY_SPECS,
  getDefenseWavePlan,
  getWaveClearSilver,
  getTowerUpgradeCost,
  getTowerBuildCost,
  getTowerRefund,
  getEnemyHp,
  getEnemySilver,
  SILVER_STARTER,
  MAX_DEFENSE_WAVE,
  MAX_TOWER_LEVEL
} from '../../src/lib/defense-balance';

describe('Defense balance & deterministic wave plan', () => {
  it('starts every game with a fixed silver allowance', () => {
    expect(SILVER_STARTER).toBeGreaterThan(0);
  });

  it('keeps all four tower types buildable at different silver costs', () => {
    const costs = Object.values(TOWER_SPECS).map(s => s.cost);
    expect(new Set(costs).size).toBe(4);
    costs.forEach(c => expect(c).toBeGreaterThan(0));
  });

  it('escalates upgrade costs so late upgrades are expensive', () => {
    const archer = getTowerUpgradeCost('archer', 1);
    const archerL2 = getTowerUpgradeCost('archer', 2);
    const archerL3 = getTowerUpgradeCost('archer', 3);
    expect(archerL2).toBeGreaterThan(archer);
    expect(archerL3).toBeGreaterThan(archerL2);
  });

  it('sells towers for a partial refund of the base cost', () => {
    expect(getTowerRefund('archer', 1)).toBeLessThan(getTowerBuildCost('archer'));
    expect(getTowerRefund('archer', 1)).toBeGreaterThan(0);
  });

  it('scales enemy HP and silver rewards with the wave number', () => {
    const scoutHp1 = getEnemyHp('scout', 1);
    const scoutHp10 = getEnemyHp('scout', 10);
    const scoutSilver1 = getEnemySilver('scout', 1);
    const scoutSilver10 = getEnemySilver('scout', 10);
    expect(scoutHp10).toBeGreaterThan(scoutHp1);
    expect(scoutSilver10).toBeGreaterThan(scoutSilver1);
  });

  it('has more than the original four enemy types', () => {
    expect(Object.keys(ENEMY_SPECS).length).toBeGreaterThan(4);
    expect(ENEMY_SPECS.runner).toBeDefined();
    expect(ENEMY_SPECS.shielder).toBeDefined();
  });

  it('spawns a boss on every 10th wave and not in between', () => {
    for (let wave = 1; wave <= 30; wave++) {
      const plan = getDefenseWavePlan(wave);
      if (wave % 10 === 0) {
        expect(plan.hasBoss).toBe(true);
        expect(plan.enemyCounts.boss).toBe(1);
      } else {
        expect(plan.hasBoss).toBe(false);
        expect(plan.enemyCounts.boss).toBe(0);
      }
    }
  });

  it('produces a deterministic scripted spawn list per wave', () => {
    const a = getDefenseWavePlan(7);
    const b = getDefenseWavePlan(7);
    expect(a.spawns).toEqual(b.spawns);
    expect(a.enemyCounts).toEqual(b.enemyCounts);
    expect(a.total).toBe(a.spawns.length);
    expect(a.enemyCounts.scout + a.enemyCounts.runner + a.enemyCounts.warrior + a.enemyCounts.shaman + a.enemyCounts.shielder + a.enemyCounts.brute + a.enemyCounts.boss).toBe(a.total);
  });

  it('adds more enemies as waves progress', () => {
    expect(getDefenseWavePlan(12).total).toBeGreaterThan(getDefenseWavePlan(1).total);
  });

  it('computes a deterministic silver value for a cleared wave', () => {
    const silver5 = getWaveClearSilver(5);
    const silver5Again = getWaveClearSilver(5);
    expect(silver5).toBe(silver5Again);
    expect(silver5).toBeGreaterThan(0);

    // Wave 5 has no boss; each planned enemy plus the clear bonus.
    const plan = getDefenseWavePlan(5);
    const expected = plan.spawns.reduce((sum, type) => sum + getEnemySilver(type, 5), 0) + 30 + 5 * 10;
    expect(silver5).toBe(expected);
  });

  it('clamps waves to the valid range', () => {
    expect(getDefenseWavePlan(0).wave).toBe(1);
    expect(getDefenseWavePlan(99999).wave).toBe(MAX_DEFENSE_WAVE);
  });

  it('caps max tower level at 5 and scales upgrade costs up to level 5', () => {
    expect(MAX_TOWER_LEVEL).toBe(5);
    for (let lv = 1; lv < MAX_TOWER_LEVEL; lv++) {
      expect(getTowerUpgradeCost('archer', lv + 1)).toBeGreaterThan(getTowerUpgradeCost('archer', lv));
    }
  });

  it('spawns mini-bosses every 10 waves starting from wave 5 (5, 15, 25)', () => {
    for (const w of [5, 15, 25, 35]) {
      const plan = getDefenseWavePlan(w);
      expect(plan.hasMiniBoss).toBe(true);
      expect(plan.enemyCounts.miniboss).toBe(1);
      expect(plan.hasBoss).toBe(false);
    }
    for (const w of [1, 2, 3, 4, 6, 7, 8, 9, 10, 20]) {
      const plan = getDefenseWavePlan(w);
      expect(plan.hasMiniBoss).toBe(false);
      expect(plan.enemyCounts.miniboss).toBe(0);
    }
  });

  it('scales enemy HP aggressively at high waves with compound scaling', () => {
    const hp5 = getEnemyHp('scout', 5);
    const hp15 = getEnemyHp('scout', 15);
    const hp25 = getEnemyHp('scout', 25);
    // Late-game scaling accelerates beyond linear additions
    expect(hp15 - hp5).toBeGreaterThan(0);
    expect(hp25 - hp15).toBeGreaterThan(hp15 - hp5);
  });
});
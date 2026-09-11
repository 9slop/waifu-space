// Defense game balance & deterministic wave plan.
// Shared by the client (WaifuDefenseGame) and the server (defense session ledger)
// so anti-cheat validation and gameplay always agree.
//
// Silver is a gamemode-only currency that resets each new game start (never
// between waves). Coins remain the global, out-of-game currency.

export type TowerType = 'archer' | 'frost' | 'thunder' | 'sanctuary';
export type EnemyType = 'scout' | 'runner' | 'warrior' | 'shaman' | 'shielder' | 'brute' | 'boss';

export const MAX_DEFENSE_WAVE = 200;
export const SILVER_STARTER = 120;
export const SILVER_CAP = 100_000;

// ─── Towers (costs are in SILVER) ────────────────────────────────────────────

export interface TowerSpec {
  cost: number;
  range: number;
  damage: number;
  cd: number; // ms
  icon: string;
  role: 'attack' | 'support';
}

export const TOWER_SPECS: Record<TowerType, TowerSpec> = {
  archer: { cost: 50, range: 120, damage: 18, cd: 600, icon: '🏹', role: 'attack' },
  frost: { cost: 70, range: 110, damage: 10, cd: 1000, icon: '❄️', role: 'attack' },
  thunder: { cost: 110, range: 140, damage: 42, cd: 1500, icon: '⚡', role: 'attack' },
  sanctuary: { cost: 85, range: 100, damage: 5, cd: 2000, icon: '🌸', role: 'support' }
};

export function getTowerBuildCost(type: TowerType): number {
  return TOWER_SPECS[type].cost;
}

/** Escalating upgrade cost so upgrading is a real investment decision. */
export function getTowerUpgradeCost(type: TowerType, level: number): number {
  const lv = Math.max(1, Math.floor(level));
  return Math.round(TOWER_SPECS[type].cost * 1.2 * lv);
}

export function getTowerRefund(type: TowerType, level: number): number {
  const lv = Math.max(1, Math.floor(level));
  return Math.round(TOWER_SPECS[type].cost * 0.6 * lv);
}

// ─── Enemies ─────────────────────────────────────────────────────────────────

export interface EnemySpec {
  hpBase: number;
  hpPerWave: number;
  speed: number;
  silverBase: number;
  silverPerWave: number;
  shrineDamage: number;
  radius: number;
  color: string;
  icon: string;
}

export const ENEMY_SPECS: Record<EnemyType, EnemySpec> = {
  scout: { hpBase: 40, hpPerWave: 11, speed: 0.9, silverBase: 4, silverPerWave: 1, shrineDamage: 8, radius: 12, color: '#2e7d32', icon: '👺' },
  runner: { hpBase: 28, hpPerWave: 8, speed: 1.45, silverBase: 5, silverPerWave: 1, shrineDamage: 6, radius: 10, color: '#00897b', icon: '💨' },
  warrior: { hpBase: 85, hpPerWave: 22, speed: 0.55, silverBase: 10, silverPerWave: 2, shrineDamage: 12, radius: 13, color: '#e65100', icon: '🧌' },
  shaman: { hpBase: 130, hpPerWave: 28, speed: 0.45, silverBase: 14, silverPerWave: 3, shrineDamage: 10, radius: 13, color: '#4a148c', icon: '🧙' },
  shielder: { hpBase: 210, hpPerWave: 42, speed: 0.34, silverBase: 16, silverPerWave: 3, shrineDamage: 18, radius: 15, color: '#546e7a', icon: '🛡️' },
  brute: { hpBase: 320, hpPerWave: 60, speed: 0.3, silverBase: 20, silverPerWave: 4, shrineDamage: 20, radius: 16, color: '#bf360c', icon: '🗿' },
  boss: { hpBase: 1300, hpPerWave: 280, speed: 0.22, silverBase: 80, silverPerWave: 15, shrineDamage: 40, radius: 22, color: '#b71c1c', icon: '👹' }
};

export function getEnemyHp(type: EnemyType, wave: number): number {
  const spec = ENEMY_SPECS[type];
  return Math.round(spec.hpBase + spec.hpPerWave * wave);
}

export function getEnemySilver(type: EnemyType, wave: number): number {
  const spec = ENEMY_SPECS[type];
  return spec.silverBase + spec.silverPerWave * wave;
}

// ─── Wave clear silver bonus ─────────────────────────────────────────────────

export const SILVER_WAVE_BONUS_BASE = 30;
export const SILVER_WAVE_BONUS_PER_WAVE = 10;

export function getWaveClearSilverBonus(wave: number): number {
  return SILVER_WAVE_BONUS_BASE + wave * SILVER_WAVE_BONUS_PER_WAVE;
}

// ─── Deterministic wave plan ─────────────────────────────────────────────────

export interface DefenseWavePlan {
  wave: number;
  spawns: EnemyType[];
  enemyCounts: Record<EnemyType, number>;
  hasBoss: boolean;
  total: number;
}

/**
 * Every wave is deterministically scripted from its number alone, so the server
 * can validate kills / rewards against the exact same plan the client runs.
 * A boss appears on every 10th wave (10, 20, 30 ...).
 */
export function getDefenseWavePlan(wave: number): DefenseWavePlan {
  const safeWave = Math.max(1, Math.min(MAX_DEFENSE_WAVE, Math.floor(wave || 1)));
  const count = 4 + Math.ceil(safeWave * 2.5);

  const spawns: EnemyType[] = [];
  for (let i = 0; i < count; i++) {
    let type: EnemyType = 'scout';
    if (safeWave >= 3 && i % 3 === 1) type = 'warrior';
    else if (safeWave >= 2 && i % 4 === 2) type = 'runner';
    else if (safeWave >= 5 && i % 5 === 4) type = 'shaman';
    else if (safeWave >= 6 && i % 4 === 3) type = 'shielder';
    else if (safeWave >= 8 && i % 6 === 5) type = 'brute';
    spawns.push(type);
  }

  const hasBoss = safeWave % 10 === 0;
  if (hasBoss) spawns.push('boss');

  const enemyCounts: Record<EnemyType, number> = {
    scout: 0,
    runner: 0,
    warrior: 0,
    shaman: 0,
    shielder: 0,
    brute: 0,
    boss: 0
  };
  spawns.forEach(t => {
    enemyCounts[t] += 1;
  });

  return { wave: safeWave, spawns, enemyCounts, hasBoss, total: spawns.length };
}

/**
 * Total silver a cleared wave is worth on the server: the per-enemy kill value
 * of every planned enemy plus the wave-clear bonus. Deterministic, so the server
 * never trusts the client's reported kill count.
 */
export function getWaveClearSilver(wave: number): number {
  const plan = getDefenseWavePlan(wave);
  let total = getWaveClearSilverBonus(wave);
  for (const type of plan.spawns) {
    total += getEnemySilver(type, wave);
  }
  return total;
}

/** Minimum plausible duration for a wave clear, used by anti-cheat validation. */
export function getMinPlausibleWaveMs(wave: number): number {
  const safeWave = Math.max(1, Math.min(MAX_DEFENSE_WAVE, Math.floor(wave || 1)));
  return Math.max(2500, safeWave * 800);
}
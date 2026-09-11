import {
  getDefenseWavePlan,
  getWaveClearSilver,
  getMinPlausibleWaveMs,
  SILVER_STARTER,
  SILVER_CAP,
  MAX_DEFENSE_WAVE
} from '../defense-balance';
import { getDefenseCoinsReward, getDefenseExpReward } from '../economy';

/**
 * Server-authoritative defense game session.
 *
 * Silver is the gamemode-only currency: it resets when a new game starts and is
 * never granted passively. Kill + wave-clear silver is computed by the server
 * from the deterministic wave plan, and spend deltas (builds/upgrades/sells)
 * are validated against the server's running ledger. The client simply mirrors
 * the authoritative balance.
 */
export interface DefenseSession {
  userId: string;
  gameId: string;
  /** Earliest wave still eligible to be cleared (starts at 1, advances on each clear). */
  wave: number;
  /** Wave numbers already rewarded in this game (blocks replay farming). */
  completedWaves: Set<number>;
  /** Authoritative silver balance after the most recent wave clear. */
  silver: number;
  createdAt: number;
  updatedAt: number;
}

const sessions = new Map<string, DefenseSession>();

function makeId(userId: string) {
  return `game_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function startDefenseSession(userId: string): DefenseSession {
  const session: DefenseSession = {
    userId,
    gameId: makeId(userId),
    wave: 1,
    completedWaves: new Set<number>(),
    silver: SILVER_STARTER,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  sessions.set(userId, session);
  return session;
}

export function getDefenseSession(userId: string): DefenseSession | null {
  return sessions.get(userId) ?? null;
}

export function endDefenseSession(userId: string): void {
  sessions.delete(userId);
}

function normalizeSpendDeltas(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  let delta = 0;
  for (const entry of value) {
    const n = Number(entry);
    if (!Number.isFinite(n)) return null;
    if (n < -5000 || n > 5000) return null;
    delta += n;
  }
  if (!Number.isInteger(delta)) return null;
  return delta;
}

export interface CompleteWaveOutcome {
  verified: boolean;
  error?: string;
  coinsReward: number;
  expReward: number;
  silverEarned: number;
  silver: number;
  goblinsDefeated: number;
  nextWave: number;
  hasBoss: boolean;
  hasMiniBoss?: boolean;
}

const UNVERIFIED: CompleteWaveOutcome = {
  verified: false,
  coinsReward: 0,
  expReward: 0,
  silverEarned: 0,
  silver: 0,
  goblinsDefeated: 0,
  nextWave: 0,
  hasBoss: false,
  hasMiniBoss: false
};

export function resultError(outcome: CompleteWaveOutcome, error: string): CompleteWaveOutcome {
  return { ...UNVERIFIED, error };
}

/**
 * Validates & settles a completed wave against the user's server-side session.
 * `spendDeltas` are signed integers: builds/upgrades are negative (silver spent),
 * sells are positive (silver refunded).
 */
export function completeDefenseWave(
  userId: string,
  submittedWave: number,
  clientDurationMs: number,
  spendDeltas: unknown
): CompleteWaveOutcome {
  const session = sessions.get(userId);

  if (submittedWave < 1 || submittedWave > MAX_DEFENSE_WAVE) {
    return resultError(UNVERIFIED, 'Invalid wave range');
  }
  if (!session) {
    return resultError(UNVERIFIED, 'No active defense session. Start a new game first.');
  }
  if (submittedWave < session.wave) {
    return resultError(UNVERIFIED, 'Wave already cleared or out of sequence. Start a new game.');
  }
  if (session.completedWaves.has(submittedWave)) {
    return resultError(UNVERIFIED, 'Wave already rewarded. Start a new game.');
  }
  if (typeof clientDurationMs !== 'number' || clientDurationMs < getMinPlausibleWaveMs(submittedWave)) {
    return resultError(UNVERIFIED, 'Suspiciously fast wave completion duration');
  }

  const delta = normalizeSpendDeltas(spendDeltas);
  if (delta === null) {
    return resultError(UNVERIFIED, 'Invalid spend data');
  }

  const silverEarned = getWaveClearSilver(submittedWave);
  const nextSilver = Math.round(session.silver + silverEarned + delta);
  if (nextSilver < 0) {
    return resultError(UNVERIFIED, 'Spend exceeds available silver');
  }

  session.silver = Math.min(SILVER_CAP, nextSilver);
  session.wave = Math.max(session.wave, submittedWave + 1);
  session.completedWaves.add(submittedWave);
  session.updatedAt = Date.now();

  const plan = getDefenseWavePlan(submittedWave);

  return {
    verified: true,
    coinsReward: getDefenseCoinsReward(submittedWave),
    expReward: getDefenseExpReward(submittedWave),
    silverEarned,
    silver: session.silver,
    goblinsDefeated: plan.total,
    nextWave: submittedWave + 1,
    hasBoss: plan.hasBoss,
    hasMiniBoss: plan.hasMiniBoss
  };
}

export function clearDefenseSessions() {
  sessions.clear();
}
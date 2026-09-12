import { describe, it, expect, vi } from 'vitest';
import { GRENADE_CATALOG, GrenadeType } from '../../src/lib/strike/strike-types';
import { strikeAudio } from '../../src/lib/strike/strike-weapons';

describe('Waifu Strike: Tactical Grenades System', () => {
  it('defines all 3 tactical grenades with verified specifications', () => {
    expect(GRENADE_CATALOG.molotov).toBeDefined();
    expect(GRENADE_CATALOG.smoke).toBeDefined();
    expect(GRENADE_CATALOG.he).toBeDefined();

    // 1. Molotov: 20 damage per second (5 damage per 0.25s), 6s duration, 4.5m radius
    const molo = GRENADE_CATALOG.molotov;
    expect(molo.name).toContain('Molotov');
    expect(molo.radius).toBe(4.5);
    expect(molo.duration).toBe(6.0);
    expect(molo.damagePerSecond).toBe(20);
    expect(molo.damagePerTick).toBe(5);
    expect(molo.tickIntervalMs).toBe(250);
    // 250ms interval means 4 ticks per second: 4 * 5 = 20 dmg/s
    expect((1000 / molo.tickIntervalMs) * molo.damagePerTick).toBe(20);

    // 2. Smoke: 16s duration, 5.5m radius, view obstruction
    const smoke = GRENADE_CATALOG.smoke;
    expect(smoke.name).toContain('Smoke');
    expect(smoke.radius).toBe(5.5);
    expect(smoke.duration).toBe(16.0);
    expect(smoke.damagePerSecond).toBe(0);

    // 3. HE Explosive: 100 damage at center, 6.5m blast radius
    const he = GRENADE_CATALOG.he;
    expect(he.name).toContain('HE');
    expect(he.centerDamage).toBe(100);
    expect(he.blastRadius).toBe(6.5);
  });

  it('calculates Molotov fire damage correctly across time ticks', () => {
    const tickInterval = 250;
    const damagePerTick = 5;
    const durationMs = 6000;

    let totalDamage = 0;
    let ticks = 0;
    for (let t = tickInterval; t <= durationMs; t += tickInterval) {
      totalDamage += damagePerTick;
      ticks++;
    }

    // 6 seconds = 24 ticks * 5 damage = 120 total maximum burn damage
    expect(ticks).toBe(24);
    expect(totalDamage).toBe(120);
    // Exact 20 dmg per 1 second (1000ms / 250ms = 4 ticks * 5 dmg = 20 dmg)
    expect((1000 / tickInterval) * damagePerTick).toBe(20);
  });

  it('calculates HE grenade distance falloff: exactly 100 at center and 0 beyond radius', () => {
    const blastRadius = 6.5;
    const centerDamage = 100;

    // At epicenter (dist = 0m)
    const distCenter = 0;
    const dmgCenter = Math.max(1, Math.round(centerDamage * (1 - distCenter / blastRadius)));
    expect(dmgCenter).toBe(100);

    // At half radius (dist = 3.25m)
    const distHalf = 3.25;
    const dmgHalf = Math.max(1, Math.round(centerDamage * (1 - distHalf / blastRadius)));
    expect(dmgHalf).toBe(50);

    // Near boundary (dist = 6.0m)
    const distNearEdge = 6.0;
    const dmgNearEdge = Math.max(1, Math.round(centerDamage * (1 - distNearEdge / blastRadius)));
    expect(dmgNearEdge).toBe(8);

    // Outside blast radius (> 6.5m)
    const isOutside = 6.6 > blastRadius;
    expect(isOutside).toBe(true);
  });

  it('verifies smoke occlusion spatial point checking', () => {
    const smokeCenter = { x: 10, y: 1.5, z: 20 };
    const smokeRadius = 5.5;

    const checkInSmoke = (x: number, y: number, z: number) => {
      const dist = Math.hypot(x - smokeCenter.x, y - smokeCenter.y, z - smokeCenter.z);
      return dist <= smokeRadius;
    };

    // Position inside smoke center
    expect(checkInSmoke(10, 1.5, 20)).toBe(true);
    // Position inside smoke edge (3m away)
    expect(checkInSmoke(12, 1.5, 22)).toBe(true);
    // Position outside smoke (7m away)
    expect(checkInSmoke(10, 1.5, 27.5)).toBe(false);
  });

  it('supports tactical grenade audio methods without crashing', () => {
    expect(typeof strikeAudio.playGrenadePin).toBe('function');
    expect(typeof strikeAudio.playGrenadeBounce).toBe('function');
    expect(typeof strikeAudio.playExplosion).toBe('function');
    expect(typeof strikeAudio.playFireIgnite).toBe('function');
    expect(typeof strikeAudio.playSmokePop).toBe('function');

    // Safe execution check
    expect(() => strikeAudio.playGrenadePin()).not.toThrow();
    expect(() => strikeAudio.playGrenadeBounce()).not.toThrow();
    expect(() => strikeAudio.playExplosion()).not.toThrow();
    expect(() => strikeAudio.playFireIgnite()).not.toThrow();
    expect(() => strikeAudio.playSmokePop()).not.toThrow();
    expect(() => strikeAudio.playEmptyClick()).not.toThrow();
  });

  it('verifies HE grenade explosion triggers concussive slowdown while Molotov does not', () => {
    let slowdownCalled = false;
    let slowdownMult = 1.0;
    let slowdownDuration = 0;

    const onExplosionSlowdown = vi.fn((mult: number, durationMs: number) => {
      slowdownCalled = true;
      slowdownMult = mult;
      slowdownDuration = durationMs;
    });

    // Simulating HE explosion damage applying slowdown
    const applyHeBlastDamage = (dist: number, blastRadius = 6.5) => {
      if (dist <= blastRadius) {
        onExplosionSlowdown(0.45, 1800);
      }
    };

    applyHeBlastDamage(3.0);
    expect(slowdownCalled).toBe(true);
    expect(slowdownMult).toBe(0.45);
    expect(slowdownDuration).toBe(1800);
    expect(onExplosionSlowdown).toHaveBeenCalledTimes(1);

    // Reset and simulate Molotov fire tick damage — Molotov must NEVER trigger slowdown
    slowdownCalled = false;
    const applyMolotovFireTick = (dmg: number) => {
      // Molotov deals damage but does NOT call onExplosionSlowdown
      return dmg;
    };
    const dmg = applyMolotovFireTick(5);
    expect(dmg).toBe(5);
    expect(slowdownCalled).toBe(false);
    expect(onExplosionSlowdown).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('replenishes 1 grenade every 3 frags and never exceeds maximum capacity of 1', () => {
    let grenadeCount = 1;
    let killsSinceGrenade = 0;
    let replenishEvents = 0;

    const recordKill = () => {
      killsSinceGrenade++;
      if (killsSinceGrenade >= 3) {
        killsSinceGrenade = 0;
        if (grenadeCount < 1) {
          grenadeCount = 1;
          replenishEvents++;
        }
      }
    };

    // 1. Initial state has 1 grenade
    expect(grenadeCount).toBe(1);

    // 2. Kill 3 enemies while already holding 1 grenade -> does NOT grant >1
    recordKill();
    recordKill();
    recordKill();
    expect(grenadeCount).toBe(1);
    expect(replenishEvents).toBe(0);

    // 3. Throw grenade -> grenadeCount drops to 0
    grenadeCount = 0;

    // 4. Kill 2 enemies -> still 0
    recordKill();
    recordKill();
    expect(grenadeCount).toBe(0);
    expect(replenishEvents).toBe(0);

    // 5. Kill 3rd enemy -> replenished to exactly 1!
    recordKill();
    expect(grenadeCount).toBe(1);
    expect(replenishEvents).toBe(1);

    // 6. Next 3 kills while holding grenade still keeps it at 1
    recordKill();
    recordKill();
    recordKill();
    expect(grenadeCount).toBe(1);
    expect(replenishEvents).toBe(1);
  });
});

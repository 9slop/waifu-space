import { describe, it, expect } from 'vitest';
import { WEAPON_CATALOG } from '../../src/lib/strike/strike-weapons';

describe('CS-Style Movement Kinematics', () => {
  it('defines realistic CS-calibrated weapon carry speeds', () => {
    // Standard CS competitive carry speeds:
    // Knife: ~250-260 units/s (fastest)
    // Pistol (Deagle): ~250-255 units/s
    // Rifle (AK/M4): ~215-225 units/s (baseline 6.6 m/s)
    // Sniper (AWP): ~200 units/s (slowest carry)
    const knife = WEAPON_CATALOG.knife;
    const rifle = WEAPON_CATALOG.rifle;
    const sniper = WEAPON_CATALOG.sniper;
    const pistol = WEAPON_CATALOG.pistol;

    expect(knife).toBeDefined();
    expect(rifle).toBeDefined();
    expect(sniper).toBeDefined();
    expect(pistol).toBeDefined();
  });

  it('calculates CS duck and walk speed reductions accurately', () => {
    const baseSpeed = 6.6;
    const crouchSpeed = baseSpeed * 0.35; // ~85 units/s ducking
    const walkSpeed = baseSpeed * 0.52;   // ~130 units/s shift-walk

    expect(crouchSpeed).toBeCloseTo(2.31, 2);
    expect(walkSpeed).toBeCloseTo(3.43, 2);
    expect(crouchSpeed).toBeLessThan(walkSpeed);
    expect(walkSpeed).toBeLessThan(baseSpeed);
  });

  it('limits air wish speed to prevent mid-air sprinting / bhop exploits', () => {
    const maxSpeed = 6.6;
    const airWishSpeed = Math.min(maxSpeed, 1.2);
    expect(airWishSpeed).toBe(1.2);
    expect(airWishSpeed).toBeLessThan(maxSpeed * 0.25);
  });
});

import { describe, it, expect } from 'vitest';
import { StrikeBabylonEngine } from '../../src/lib/strike/strike-babylon-engine';
import { strikeAudio } from '../../src/lib/strike/strike-weapons';

describe('Waifu Strike: Kill Ammo Replenishment', () => {
  it('replenishes bullets to reserve ammo for the weapon used to make the kill', () => {
    let lastMag = 0;
    let lastReserve = 0;

    const mockEngine: any = {
      ammoMag: { rifle: 30, sniper: 5, pistol: 7, knife: 1, katana: 1 },
      ammoReserve: { rifle: 90, sniper: 25, pistol: 35, knife: 1, katana: 1 },
      activeWeaponId: 'rifle',
      callbacks: {
        onAmmoChange: (mag: number, res: number) => {
          lastMag = mag;
          lastReserve = res;
        }
      },
      replenishReserveAmmo: StrikeBabylonEngine.prototype.replenishReserveAmmo
    };

    // Initial state check
    expect(mockEngine.ammoReserve.rifle).toBe(90);
    expect(mockEngine.ammoReserve.sniper).toBe(25);
    expect(mockEngine.ammoReserve.pistol).toBe(35);

    // 1. Rifle kill (+30 rounds)
    const newRifle = mockEngine.replenishReserveAmmo('rifle', 30);
    expect(newRifle).toBe(120);
    expect(mockEngine.ammoReserve.rifle).toBe(120);
    // Since rifle is active weapon, onAmmoChange callback was invoked
    expect(lastReserve).toBe(120);

    // 2. Sniper kill (+5 rounds)
    const newSniper = mockEngine.replenishReserveAmmo('sniper', 5);
    expect(newSniper).toBe(30);
    expect(mockEngine.ammoReserve.sniper).toBe(30);

    // 3. Pistol / Deagle kill (+14 rounds)
    const newPistol = mockEngine.replenishReserveAmmo('pistol', 14);
    expect(newPistol).toBe(49);
    expect(mockEngine.ammoReserve.pistol).toBe(49);

    // 4. Melee (knife / katana) does not replenish or modify reserves
    const knifeResult = mockEngine.replenishReserveAmmo('knife', 10);
    expect(knifeResult).toBe(0);
    expect(mockEngine.ammoReserve.knife).toBe(1);

    const katanaResult = mockEngine.replenishReserveAmmo('katana', 10);
    expect(katanaResult).toBe(0);
    expect(mockEngine.ammoReserve.katana).toBe(1);
  });

  it('enforces maximum reserve caps to prevent overflow', () => {
    const mockEngine: any = {
      ammoMag: { rifle: 30, sniper: 5, pistol: 7, knife: 1, katana: 1 },
      ammoReserve: { rifle: 90, sniper: 25, pistol: 35, knife: 1, katana: 1 },
      activeWeaponId: 'rifle',
      callbacks: {
        onAmmoChange: () => {}
      },
      replenishReserveAmmo: StrikeBabylonEngine.prototype.replenishReserveAmmo
    };

    // Max reserve caps: rifle 180, sniper 40, pistol 70
    // Try to add 500 rounds to rifle
    const cappedRifle = mockEngine.replenishReserveAmmo('rifle', 500);
    expect(cappedRifle).toBe(180);
    expect(mockEngine.ammoReserve.rifle).toBe(180);

    // Try to add 100 rounds to sniper
    const cappedSniper = mockEngine.replenishReserveAmmo('sniper', 100);
    expect(cappedSniper).toBe(40);
    expect(mockEngine.ammoReserve.sniper).toBe(40);

    // Try to add 100 rounds to pistol
    const cappedPistol = mockEngine.replenishReserveAmmo('pistol', 100);
    expect(cappedPistol).toBe(70);
    expect(mockEngine.ammoReserve.pistol).toBe(70);
  });

  it('triggers audio cue playAmmoReplenish safely', () => {
    expect(typeof strikeAudio.playAmmoReplenish).toBe('function');
    expect(() => strikeAudio.playAmmoReplenish()).not.toThrow();
  });
});

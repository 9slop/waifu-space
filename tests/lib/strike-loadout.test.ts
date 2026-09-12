import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOADOUT,
  PlayerLoadout,
  DEFAULT_KEYBINDINGS,
  GRENADE_CATALOG,
  GrenadeType
} from '../../src/lib/strike/strike-types';
import { WEAPON_CATALOG } from '../../src/lib/strike/strike-weapons';
import { StrikeBabylonEngine } from '../../src/lib/strike/strike-babylon-engine';

describe('Waifu Strike: Tactical Loadout Customization', () => {
  it('defines default loadout conforming to CS tactical archetypes', () => {
    expect(DEFAULT_LOADOUT.primary).toBe('rifle');
    expect(DEFAULT_LOADOUT.secondary).toBe('pistol');
    expect(DEFAULT_LOADOUT.melee).toBe('knife');
    expect(DEFAULT_LOADOUT.grenade).toBe('molotov');

    // Primary weapons in catalog
    expect(WEAPON_CATALOG[DEFAULT_LOADOUT.primary].category).toBe('primary');
    expect(WEAPON_CATALOG.sniper.category).toBe('primary');

    // Secondary weapons in catalog
    expect(WEAPON_CATALOG[DEFAULT_LOADOUT.secondary].category).toBe('secondary');

    // Melee weapons in catalog
    expect(WEAPON_CATALOG[DEFAULT_LOADOUT.melee].category).toBe('melee');
    expect(WEAPON_CATALOG.katana.category).toBe('melee');

    // Tactical grenade catalog
    expect(GRENADE_CATALOG[DEFAULT_LOADOUT.grenade]).toBeDefined();
  });

  it('provides B key binding for loadout and G key binding for grenade in defaults', () => {
    expect(DEFAULT_KEYBINDINGS.loadout).toBe('KeyB');
    expect(DEFAULT_KEYBINDINGS.grenade).toBe('KeyG');
  });

  it('updates engine loadout state via setLoadout', () => {
    let lastGrenadeCount = -1;
    let lastGrenadeType: GrenadeType | null = null;

    const mockEngine: any = {
      loadout: { ...DEFAULT_LOADOUT },
      grenadeCount: 1,
      callbacks: {
        onGrenadeCountChange: (count: number, type: GrenadeType) => {
          lastGrenadeCount = count;
          lastGrenadeType = type;
        }
      },
      setLoadout: StrikeBabylonEngine.prototype.setLoadout
    };

    // 1. Equip Aether Railgun as primary
    mockEngine.setLoadout({ primary: 'sniper' });
    expect(mockEngine.loadout.primary).toBe('sniper');

    // 2. Equip Muramasa Katana as melee
    mockEngine.setLoadout({ melee: 'katana' });
    expect(mockEngine.loadout.melee).toBe('katana');

    // 3. Equip HE grenade as tactical
    mockEngine.setLoadout({ grenade: 'he' });
    expect(mockEngine.loadout.grenade).toBe('he');
    expect(lastGrenadeType).toBe('he');
    expect(lastGrenadeCount).toBe(1);

    // 4. Equip Mist Veil Smoke
    mockEngine.setLoadout({ grenade: 'smoke' });
    expect(mockEngine.loadout.grenade).toBe('smoke');
    expect(lastGrenadeType).toBe('smoke');
  });

  it('serializes and deserializes player loadout cleanly for localStorage persistence', () => {
    const customLoadout: PlayerLoadout = {
      primary: 'sniper',
      secondary: 'pistol',
      melee: 'katana',
      grenade: 'he'
    };

    const serialized = JSON.stringify(customLoadout);
    const parsed = JSON.parse(serialized);

    expect(parsed.primary).toBe('sniper');
    expect(parsed.secondary).toBe('pistol');
    expect(parsed.melee).toBe('katana');
    expect(parsed.grenade).toBe('he');

    const merged = { ...DEFAULT_LOADOUT, ...parsed };
    expect(merged).toEqual(customLoadout);
  });

  it('ensures katana deals higher damage but carries heavier sprint weight than knife', () => {
    const knife = WEAPON_CATALOG.knife;
    const katana = WEAPON_CATALOG.katana;

    // Damage hierarchy
    expect(katana.damage).toBeGreaterThan(knife.damage);
    expect(katana.heavyDamage!).toBeGreaterThan(knife.heavyDamage!);
    expect(katana.backstabDamage!).toBeGreaterThan(knife.backstabDamage!);

    // Weight & sprint kinematics: knife 7.0 m/s > katana 6.2 m/s
    expect(knife.moveSpeed).toBe(7.0);
    expect(katana.moveSpeed).toBe(6.2);
    expect(katana.moveSpeed).toBeLessThan(knife.moveSpeed);
  });
});

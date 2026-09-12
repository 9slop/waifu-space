import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NullEngine, Scene } from '@babylonjs/core';
import { createKyotoMap } from '../../src/lib/strike/strike-babylon-map';
import { DEFAULT_KEYBINDINGS } from '../../src/lib/strike/strike-types';

describe('Strike Settings & Keybindings', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('exposes setRtxShadows on Kyoto map data without throwing', () => {
    const mapData = createKyotoMap(scene);
    expect(mapData.setRtxShadows).toBeDefined();

    expect(() => {
      mapData.setRtxShadows?.(true);
      mapData.setRtxShadows?.(false);
    }).not.toThrow();
  });

  it('provides complete default keybindings structure', () => {
    expect(DEFAULT_KEYBINDINGS.forward).toBe('KeyW');
    expect(DEFAULT_KEYBINDINGS.backward).toBe('KeyS');
    expect(DEFAULT_KEYBINDINGS.left).toBe('KeyA');
    expect(DEFAULT_KEYBINDINGS.right).toBe('KeyD');
    expect(DEFAULT_KEYBINDINGS.jump).toBe('Space');
    expect(DEFAULT_KEYBINDINGS.crouch).toBe('ControlLeft');
    expect(DEFAULT_KEYBINDINGS.walk).toBe('ShiftLeft');
    expect(DEFAULT_KEYBINDINGS.reload).toBe('KeyR');
    expect(DEFAULT_KEYBINDINGS.quickswitch).toBe('KeyQ');
    expect(DEFAULT_KEYBINDINGS.scoreboard).toBe('Tab');
  });
});

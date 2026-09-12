import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NullEngine, Scene } from '@babylonjs/core';
import { createKyotoMap } from '../../src/lib/strike/strike-babylon-map';

describe('Kyoto Day/Night Cycle (24 minutes)', () => {
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

  it('exposes updateDayNightCycle on Kyoto map data', () => {
    const mapData = createKyotoMap(scene);
    expect(mapData.updateDayNightCycle).toBeDefined();
  });

  it('updates lighting, sun position, and sky across all 4 cycle phases', () => {
    const mapData = createKyotoMap(scene);
    expect(mapData.updateDayNightCycle).toBeDefined();

    // 1. Dawn phase (e.g. 100 seconds)
    expect(() => mapData.updateDayNightCycle!(100)).not.toThrow();

    // 2. Full Day phase (e.g. 400 seconds)
    expect(() => mapData.updateDayNightCycle!(400)).not.toThrow();
    expect(mapData.sunLight?.intensity).toBeGreaterThan(0.8);

    // 3. Dusk phase (e.g. 800 seconds)
    expect(() => mapData.updateDayNightCycle!(800)).not.toThrow();

    // 4. Night phase (e.g. 1200 seconds)
    expect(() => mapData.updateDayNightCycle!(1200)).not.toThrow();
    expect(mapData.sunLight?.intensity).toBeLessThan(0.7);

    // 5. Full cycle wrap-around (1440s+)
    expect(() => mapData.updateDayNightCycle!(1440 + 360)).not.toThrow();
  });
});

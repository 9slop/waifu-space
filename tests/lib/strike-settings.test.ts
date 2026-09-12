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

  it('defaults graphics settings to low for universal hardware accessibility', async () => {
    const { DEFAULT_GRAPHICS_SETTINGS, GRAPHICS_PRESETS } = await import('../../src/lib/strike/strike-types');
    expect(DEFAULT_GRAPHICS_SETTINGS.preset).toBe('low');
    expect(DEFAULT_GRAPHICS_SETTINGS.shadows).toBe('off');
    expect(DEFAULT_GRAPHICS_SETTINGS.renderScale).toBe(1.0);
    expect(DEFAULT_GRAPHICS_SETTINGS.anisotropicFiltering).toBe(1);

    expect(GRAPHICS_PRESETS.low.shadows).toBe('off');
    expect(GRAPHICS_PRESETS.medium.shadows).toBe('low');
    expect(GRAPHICS_PRESETS.high.shadows).toBe('medium');
    expect(GRAPHICS_PRESETS.ultra.shadows).toBe('rtx');
  });

  it('exposes setShadowQuality on Kyoto map data without throwing', () => {
    const mapData = createKyotoMap(scene);
    expect(mapData.setShadowQuality).toBeDefined();

    expect(() => {
      mapData.setShadowQuality?.('off');
      mapData.setShadowQuality?.('low');
      mapData.setShadowQuality?.('medium');
      mapData.setShadowQuality?.('rtx');
    }).not.toThrow();
  });

  it('validates all graphics preset configurations and parameters', async () => {
    const { GRAPHICS_PRESETS } = await import('../../src/lib/strike/strike-types');
    const presets = ['low', 'medium', 'high', 'ultra'] as const;

    for (const p of presets) {
      const config = GRAPHICS_PRESETS[p];
      expect(config).toBeDefined();
      expect(config.preset).toBe(p);
      expect(['off', 'low', 'medium', 'rtx']).toContain(config.shadows);
      expect(config.renderScale).toBeGreaterThanOrEqual(0.75);
      expect(config.renderScale).toBeLessThanOrEqual(1.5);
      expect(config.anisotropicFiltering).toBeGreaterThanOrEqual(1);
      expect(config.fov).toBe(85);
      expect(typeof config.postProcessing).toBe('boolean');
    }
  });

  it('distinguishes scoreboard hold key from escape pause menu', () => {
    expect(DEFAULT_KEYBINDINGS.scoreboard).toBe('Tab');
    expect(DEFAULT_KEYBINDINGS.scoreboard).not.toBe('Escape');
  });
});

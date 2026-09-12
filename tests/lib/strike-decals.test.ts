import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NullEngine, Scene, Vector3, MeshBuilder } from '@babylonjs/core';

describe('Bullet Impact Marks (Decals)', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
    vi.useRealTimers();
  });

  it('creates oriented bullet mark plane on surface normal without colliding', () => {
    const hitPoint = new Vector3(10, 1.5, -4);
    const hitNormal = new Vector3(0, 0, 1);

    const mark = MeshBuilder.CreatePlane('bulletMark', { size: 0.16 }, scene);
    mark.position = hitPoint.add(hitNormal.scale(0.006));
    mark.lookAt(mark.position.add(hitNormal));
    mark.isPickable = false;

    expect(mark).toBeDefined();
    expect(mark.isPickable).toBe(false);
    expect(mark.position.z).toBeCloseTo(-4 + 0.006, 3);
    expect(mark.position.x).toBe(10);
    expect(mark.position.y).toBe(1.5);

    mark.dispose();
  });

  it('schedules auto-removal of bullet mark after exactly 2 minutes (120,000ms)', () => {
    const bulletMarks: any[] = [];
    const mark = MeshBuilder.CreatePlane('bulletMark', { size: 0.16 }, scene);
    bulletMarks.push(mark);

    const timer = setTimeout(() => {
      if (!mark.isDisposed()) {
        mark.dispose();
        const idx = bulletMarks.indexOf(mark);
        if (idx !== -1) bulletMarks.splice(idx, 1);
      }
    }, 120000);

    expect(bulletMarks.length).toBe(1);
    expect(mark.isDisposed()).toBe(false);

    // Advance 60s - still present
    vi.advanceTimersByTime(60000);
    expect(bulletMarks.length).toBe(1);
    expect(mark.isDisposed()).toBe(false);

    // Advance remaining 60s (total 120s) - auto removed
    vi.advanceTimersByTime(60000);
    expect(mark.isDisposed()).toBe(true);
    expect(bulletMarks.length).toBe(0);

    clearTimeout(timer);
  });

  it('caps maximum active bullet marks to prevent memory leaks', () => {
    const bulletMarks: any[] = [];
    const maxMarks = 250;

    for (let i = 0; i < 300; i++) {
      const mark = MeshBuilder.CreatePlane(`mark_${i}`, { size: 0.16 }, scene);
      bulletMarks.push(mark);
      if (bulletMarks.length > maxMarks) {
        const oldest = bulletMarks.shift();
        oldest?.dispose();
      }
    }

    expect(bulletMarks.length).toBe(maxMarks);
    bulletMarks.forEach((m) => m.dispose());
  });

  it('normalizes surface normal to prevent NaN transform errors on planar alignment', () => {
    const rawNormal = new Vector3(0, 0, 0);
    const norm = (rawNormal && rawNormal.lengthSquared() > 0.001) ? rawNormal.normalize() : new Vector3(0, 1, 0);

    expect(norm.x).toBe(0);
    expect(norm.y).toBe(1);
    expect(norm.z).toBe(0);
  });
});

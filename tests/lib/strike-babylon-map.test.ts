import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NullEngine, Scene, StandardMaterial, DynamicTexture } from '@babylonjs/core';
import { createKyotoMap } from '../../src/lib/strike/strike-babylon-map';

describe('strike-babylon-map (Kyoto v2)', () => {
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

  it('builds Kyoto map and returns valid spawn points and colliders', () => {
    const mapData = createKyotoMap(scene);

    expect(mapData).toBeDefined();
    expect(mapData.spawnPoints.length).toBe(12);
    expect(mapData.colliders.length).toBeGreaterThan(50);
  });

  it('assigns materials to all map colliders', () => {
    const mapData = createKyotoMap(scene);

    for (const collider of mapData.colliders) {
      expect(collider.material).toBeDefined();
      expect(collider.material).not.toBeNull();
    }
  });

  it('creates valid procedural textures with correct wrap and scaling without cloning', () => {
    createKyotoMap(scene);

    const groundMat = scene.getMaterialByName('matGround') as StandardMaterial;
    expect(groundMat).toBeDefined();
    expect(groundMat.diffuseTexture).toBeInstanceOf(DynamicTexture);
    expect(groundMat.diffuseTexture?.uScale).toBe(28);
    expect(groundMat.diffuseTexture?.vScale).toBe(28);

    const plasterMat = scene.getMaterialByName('matPlaster') as StandardMaterial;
    expect(plasterMat).toBeDefined();
    expect(plasterMat.diffuseTexture).toBeInstanceOf(DynamicTexture);
    expect(plasterMat.diffuseTexture?.uScale).toBe(3);
    expect(plasterMat.diffuseTexture?.vScale).toBe(2);

    const timberMat = scene.getMaterialByName('matTimber') as StandardMaterial;
    expect(timberMat).toBeDefined();
    expect(timberMat.diffuseTexture).toBeInstanceOf(DynamicTexture);
    expect(timberMat.diffuseTexture?.uScale).toBe(1);
    expect(timberMat.diffuseTexture?.vScale).toBe(3);

    const tileRoofMat = scene.getMaterialByName('matTileRoof') as StandardMaterial;
    expect(tileRoofMat).toBeDefined();
    expect(tileRoofMat.diffuseTexture).toBeInstanceOf(DynamicTexture);
    expect(tileRoofMat.diffuseTexture?.uScale).toBe(4);
    expect(tileRoofMat.diffuseTexture?.vScale).toBe(4);

    const crateMat = scene.getMaterialByName('matCrate') as StandardMaterial;
    expect(crateMat).toBeDefined();
    expect(crateMat.diffuseTexture).toBeInstanceOf(DynamicTexture);
    expect(crateMat.diffuseTexture?.uScale).toBe(1);
    expect(crateMat.diffuseTexture?.vScale).toBe(1);
  });

  it('all materials respect the 4 simultaneous lights constraint for WebGL ANGLE compatibility', () => {
    createKyotoMap(scene);

    for (const mat of scene.materials) {
      if (mat instanceof StandardMaterial) {
        expect(mat.maxSimultaneousLights).toBeLessThanOrEqual(4);
      }
    }
  });

  it('spawns are symmetrically distributed on Z axis for competitive balance', () => {
    const { spawnPoints } = createKyotoMap(scene);

    const southSpawns = spawnPoints.filter(s => s.position.z > 0);
    const northSpawns = spawnPoints.filter(s => s.position.z < 0);

    expect(southSpawns.length).toBe(6);
    expect(northSpawns.length).toBe(6);

    for (const s of southSpawns) {
      expect(s.yaw).toBe(0);
      expect(s.position.z).toBeGreaterThan(40);
    }
    for (const s of northSpawns) {
      expect(s.yaw).toBeCloseTo(Math.PI);
      expect(s.position.z).toBeLessThan(-40);
    }
  });
});

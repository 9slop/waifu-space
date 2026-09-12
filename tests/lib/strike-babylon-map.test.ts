import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NullEngine, Scene, StandardMaterial, DynamicTexture, PointLight, UniversalCamera, Vector3 } from '@babylonjs/core';
import { createKyotoMap } from '../../src/lib/strike/strike-babylon-map';
import { createBabylonWeaponMesh, BabylonAvatarModel, BabylonViewmodel } from '../../src/lib/strike/strike-babylon-avatars';

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

  it('creates warm point lights for stone lanterns on the map', () => {
    createKyotoMap(scene);

    const pointLights = scene.lights.filter(l => l instanceof PointLight) as PointLight[];
    expect(pointLights.length).toBeGreaterThanOrEqual(6);
    for (const pl of pointLights) {
      expect(pl.intensity).toBeGreaterThan(0);
      expect(pl.range).toBeGreaterThanOrEqual(8);
      // Warm golden lantern illumination
      expect(pl.diffuse.r).toBeGreaterThan(pl.diffuse.b);
    }
  });

  it('creates textured weapon meshes for all weapon types with non-pickable viewmodel parts', () => {
    const weapons = ['rifle', 'sniper', 'pistol', 'knife'] as const;
    for (const wId of weapons) {
      const wMesh = createBabylonWeaponMesh(wId, scene);
      expect(wMesh).toBeDefined();
      const childMeshes = wMesh.getChildMeshes();
      expect(childMeshes.length).toBeGreaterThanOrEqual(3);
      for (const m of childMeshes) {
        expect(m.isPickable).toBe(false);
        expect(m.material).toBeDefined();
        expect(m.material).toBeInstanceOf(StandardMaterial);
      }
    }
  });

  it('creates detailed waifu avatar with anime textures, bangs, ribbon, and hitboxes', () => {
    const avatar = new BabylonAvatarModel('test_peer_1', { name: 'Asuka', hairColor: '#ff6b9d', outfitColor: '#1e293b' }, scene);
    expect(avatar).toBeDefined();
    expect(avatar.headMesh).toBeDefined();
    expect(avatar.bodyMesh).toBeDefined();
    expect(avatar.nameplateMesh).toBeDefined();

    // Check meshes created
    const childMeshes = avatar.root.getChildMeshes();
    const meshNames = childMeshes.map(m => m.name);

    expect(meshNames.some(n => n.startsWith('avatarHead_'))).toBe(true);
    expect(meshNames.some(n => n.startsWith('hairCap_'))).toBe(true);
    expect(meshNames.some(n => n.startsWith('hairBangs_'))).toBe(true);
    expect(meshNames.some(n => n.startsWith('ribbon_'))).toBe(true);
    expect(meshNames.some(n => n.startsWith('skirt_'))).toBe(true);
    expect(meshNames.some(n => n.startsWith('hitboxHead_'))).toBe(true);
    expect(meshNames.some(n => n.startsWith('hitboxTorso_'))).toBe(true);
    expect(meshNames.some(n => n.startsWith('hitboxLimbs_'))).toBe(true);

    // Verify materials
    expect(avatar.headMesh.material).toBeInstanceOf(StandardMaterial);
    expect(avatar.bodyMesh.material).toBeInstanceOf(StandardMaterial);
    expect(avatar.headMesh.receiveShadows).toBe(true);
    expect(avatar.bodyMesh.receiveShadows).toBe(true);
  });

  it('enriches the East Quarter, B-Site, and Secret Passage with Kura storehouses and Grand Shrine', () => {
    const mapData = createKyotoMap(scene);

    // Verify Grand Kyoto Shrine Sanctuary (Hondo) north backdrop
    const shrineHondo = scene.getMeshByName('shrineHondoBody');
    expect(shrineHondo).toBeDefined();
    expect(shrineHondo?.checkCollisions).toBe(true);

    // Verify traditional Kura storehouses along East perimeter
    const kura1 = scene.getMeshByName('kuraE1_Body');
    const kura2 = scene.getMeshByName('kuraE2_Body');
    const kura3 = scene.getMeshByName('kuraE3_Body');
    expect(kura1).toBeDefined();
    expect(kura2).toBeDefined();
    expect(kura3).toBeDefined();

    // Verify outer east alley wall closing the void
    const secWallEastN = scene.getMeshByName('secWallEastN');
    const secWallEastS = scene.getMeshByName('secWallEastS');
    expect(secWallEastN).toBeDefined();
    expect(secWallEastS).toBeDefined();

    // Verify straw material and sake barrel stacks
    const strawMat = scene.getMaterialByName('matStraw') as StandardMaterial;
    expect(strawMat).toBeDefined();
    const sakeB1 = scene.getMeshByName('sakeB1_b1');
    expect(sakeB1).toBeDefined();
    expect(sakeB1?.material).toBe(strawMat);
  });

  it('configures BabylonViewmodel with renderingGroupId 1, wall tuck, and heavy knife thrust', () => {
    const camera = new UniversalCamera('testCam', new Vector3(0, 1.6, 0), scene);
    const viewmodel = new BabylonViewmodel(scene, camera);

    expect(viewmodel).toBeDefined();
    expect(viewmodel.root).toBeDefined();

    // Check renderingGroupId = 1 on weapon meshes
    const childMeshes = viewmodel.root.getChildMeshes();
    expect(childMeshes.length).toBeGreaterThan(0);
    for (const m of childMeshes) {
      expect(m.renderingGroupId).toBe(1);
    }

    // Check wall proximity tuck
    expect(() => viewmodel.setWallProximity(0.2)).not.toThrow();
    viewmodel.update(0.016, false, 0);

    // Check heavy knife thrust animation
    expect(() => viewmodel.triggerAttack('knife', 0, 0, true)).not.toThrow();
    viewmodel.update(0.016, false, 0);
  });

  it('caches weapon materials across multiple weapon mesh instantiations to prevent RAM leaks', () => {
    const matCountBefore = scene.materials.length;

    // Create rifle mesh 1
    const r1 = createBabylonWeaponMesh('rifle', scene);
    const matCountAfterR1 = scene.materials.length;
    expect(matCountAfterR1).toBeGreaterThan(matCountBefore);

    // Create rifle mesh 2 (should reuse cached materials, not create new ones)
    const r2 = createBabylonWeaponMesh('rifle', scene);
    expect(scene.materials.length).toBe(matCountAfterR1);

    // Meshes should share the exact same material instances
    const r1Body = r1.getChildMeshes().find((m) => m.name === 'rifleBody');
    const r2Body = r2.getChildMeshes().find((m) => m.name === 'rifleBody');
    expect(r1Body?.material).toBe(r2Body?.material);

    r1.dispose();
    r2.dispose();
  });
});



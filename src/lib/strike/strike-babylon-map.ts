import {
  Scene,
  Vector3,
  Color3,
  MeshBuilder,
  StandardMaterial,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  AbstractMesh
} from '@babylonjs/core';
import { Vector3D } from './strike-types';

export interface BabylonSpawnPoint {
  position: Vector3;
  yaw: number;
}

export interface BabylonMapData {
  spawnPoints: BabylonSpawnPoint[];
  botWaypoints: Vector3[];
  colliders: AbstractMesh[];
}

/**
 * Builds the compact low-poly "Cyber Shrine" tactical deathmatch map in Babylon.js.
 * All geometry meshes have `checkCollisions = true` for seamless, robust camera & physics collision.
 */
export function createCyberShrineMap(scene: Scene): BabylonMapData {
  const colliders: AbstractMesh[] = [];

  // ==================== MATERIALS ====================
  // Ground stone
  const groundMat = new StandardMaterial('matGround', scene);
  groundMat.diffuseColor = new Color3(0.18, 0.20, 0.24);
  groundMat.specularColor = new Color3(0.05, 0.05, 0.05);

  // Perimeter & Building Walls (Dark slate)
  const wallMat = new StandardMaterial('matWall', scene);
  wallMat.diffuseColor = new Color3(0.12, 0.15, 0.20);
  wallMat.specularColor = new Color3(0.08, 0.08, 0.08);

  // Shrine Vermilion Red Wood
  const shrineRedMat = new StandardMaterial('matShrineRed', scene);
  shrineRedMat.diffuseColor = new Color3(0.72, 0.18, 0.18);
  shrineRedMat.specularColor = new Color3(0.15, 0.15, 0.15);

  // Shrine Gold Accents
  const goldMat = new StandardMaterial('matGold', scene);
  goldMat.diffuseColor = new Color3(0.92, 0.72, 0.22);
  goldMat.emissiveColor = new Color3(0.18, 0.12, 0.02);

  // Cover Crates (Orange-brown)
  const crateMat = new StandardMaterial('matCrate', scene);
  crateMat.diffuseColor = new Color3(0.65, 0.35, 0.12);
  crateMat.specularColor = new Color3(0.05, 0.05, 0.05);

  // Stone Lantern Granite
  const stoneMat = new StandardMaterial('matStone', scene);
  stoneMat.diffuseColor = new Color3(0.38, 0.42, 0.46);

  // Cyber Neon Trims
  const neonPinkMat = new StandardMaterial('matNeonPink', scene);
  neonPinkMat.diffuseColor = new Color3(1.0, 0.35, 0.65);
  neonPinkMat.emissiveColor = new Color3(1.0, 0.35, 0.65);

  const neonCyanMat = new StandardMaterial('matNeonCyan', scene);
  neonCyanMat.diffuseColor = new Color3(0.0, 0.85, 0.82);
  neonCyanMat.emissiveColor = new Color3(0.0, 0.85, 0.82);

  function addBox(
    name: string,
    w: number,
    h: number,
    d: number,
    pos: Vector3,
    mat: StandardMaterial,
    collidable = true
  ): AbstractMesh {
    const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    box.position = pos;
    box.material = mat;
    if (collidable) {
      box.checkCollisions = true;
      colliders.push(box);
    }
    return box;
  }

  // ==================== 1. MAIN COURTYARD GROUND ====================
  const ground = MeshBuilder.CreateGround('mainGround', { width: 60, height: 60, subdivisions: 2 }, scene);
  ground.position = new Vector3(0, 0, 0);
  ground.material = groundMat;
  ground.checkCollisions = true;
  colliders.push(ground);

  // ==================== 2. PERIMETER WALLS ====================
  // North Wall (Z = -30)
  addBox('wallNorth', 60, 6, 1, new Vector3(0, 3, -30), wallMat);
  // South Wall (Z = 30)
  addBox('wallSouth', 60, 6, 1, new Vector3(0, 3, 30), wallMat);
  // West Wall (X = -30)
  addBox('wallWest', 1, 6, 60, new Vector3(-30, 3, 0), wallMat);
  // East Wall (X = 30)
  addBox('wallEast', 1, 6, 60, new Vector3(30, 3, 0), wallMat);

  // Decorative Neon cyber trims along walls
  addBox('neonNorth', 60, 0.15, 0.15, new Vector3(0, 5.8, -29.4), neonPinkMat, false);
  addBox('neonSouth', 60, 0.15, 0.15, new Vector3(0, 5.8, 29.4), neonCyanMat, false);
  addBox('neonWest', 0.15, 0.15, 60, new Vector3(-29.4, 5.8, 0), neonCyanMat, false);
  addBox('neonEast', 0.15, 0.15, 60, new Vector3(29.4, 5.8, 0), neonPinkMat, false);

  // ==================== 3. GRAND TORII ARCH (Center: 0, 0, 0) ====================
  // Left and Right Pillars
  addBox('toriiPillarL', 0.8, 6.5, 0.8, new Vector3(-4, 3.25, 0), shrineRedMat);
  addBox('toriiPillarR', 0.8, 6.5, 0.8, new Vector3(4, 3.25, 0), shrineRedMat);
  // Top Crossbeam (Kasagi)
  addBox('toriiBeamTop', 11, 0.8, 1.2, new Vector3(0, 6.4, 0), shrineRedMat);
  // Lower Sub-beam (Nuki)
  addBox('toriiBeamSub', 9.5, 0.4, 0.8, new Vector3(0, 5.2, 0), shrineRedMat);
  // Center plaque accent
  addBox('toriiPlaque', 0.8, 1.0, 0.3, new Vector3(0, 5.8, 0), goldMat, false);

  // ==================== 4. CENTRAL SHRINE PAVILION (North Courtyard) ====================
  // Raised Stone Platform
  addBox('shrinePlatform', 16, 1.2, 12, new Vector3(0, 0.6, -15), groundMat);
  // Platform Front Step
  addBox('shrineStep1', 8, 0.4, 2, new Vector3(0, 0.2, -8), groundMat);
  addBox('shrineStep2', 8, 0.4, 2, new Vector3(0, 0.6, -9), groundMat);

  // Shrine Pavilion Back Wall
  addBox('shrineBackWall', 15, 4.5, 1, new Vector3(0, 3.25, -20.5), wallMat);
  // Shrine Pillars
  addBox('shrinePillarFL', 0.8, 4.2, 0.8, new Vector3(-6.5, 3.1, -9.5), goldMat);
  addBox('shrinePillarFR', 0.8, 4.2, 0.8, new Vector3(6.5, 3.1, -9.5), goldMat);
  addBox('shrinePillarBL', 0.8, 4.2, 0.8, new Vector3(-6.5, 3.1, -19.5), goldMat);
  addBox('shrinePillarBR', 0.8, 4.2, 0.8, new Vector3(6.5, 3.1, -19.5), goldMat);

  // Shrine Roof Overhang
  addBox('shrineRoof', 18, 0.6, 14, new Vector3(0, 5.4, -15), shrineRedMat);

  // Sacred Altar Cover (Tactical peek spot)
  addBox('shrineAltar', 3.5, 1.3, 2.2, new Vector3(0, 1.85, -15), goldMat);

  // ==================== 5. CATWALK & SNIPER BALCONY (West Wing: X = -18) ====================
  // Elevated Catwalk
  addBox('catwalkFloor', 6, 0.4, 20, new Vector3(-18, 3.5, 5), groundMat);
  // Railing cover
  addBox('catwalkRail', 0.3, 1.0, 20, new Vector3(-15.15, 4.2, 5), wallMat);

  // Ramp connecting Courtyard to Catwalk (South to North)
  const ramp = MeshBuilder.CreateBox('catwalkRamp', { width: 5, height: 0.4, depth: 10 }, scene);
  ramp.position = new Vector3(-18, 1.75, 19.5);
  ramp.rotation.x = -Math.atan2(3.5, 10);
  ramp.material = groundMat;
  ramp.checkCollisions = true;
  colliders.push(ramp);

  // Support pillars under catwalk
  addBox('catwalkPillar1', 0.8, 3.5, 0.8, new Vector3(-20, 1.75, -4), wallMat);
  addBox('catwalkPillar2', 0.8, 3.5, 0.8, new Vector3(-16, 1.75, 14), wallMat);

  // ==================== 6. EAST CORRIDOR & TEA HOUSE (East Wing: X = 18) ====================
  // Corridor divider wall with doorway opening
  addBox('eastWallNorth', 1, 4, 10, new Vector3(18, 2, -10), wallMat);
  addBox('eastWallSouth', 1, 4, 10, new Vector3(18, 2, 10), wallMat);
  // Door header
  addBox('eastDoorHeader', 1, 1, 5, new Vector3(18, 3.5, 0), wallMat);

  // Eastern small shrine / cover building
  addBox('eastBuilding', 8, 3.5, 8, new Vector3(25, 1.75, 0), wallMat);

  // ==================== 7. TACTICAL COVER CRATES & OBSTACLES ====================
  // Mid-area cover near Torii gate
  addBox('crateMid1', 2.0, 1.8, 2.0, new Vector3(2.5, 0.9, 5), crateMat);
  addBox('crateMid2', 1.6, 1.6, 1.6, new Vector3(3.8, 0.8, 4), crateMat);
  addBox('crateMidStack', 1.4, 1.2, 1.4, new Vector3(3.0, 2.4, 4.5), crateMat);

  // Courtyard flank crates
  addBox('crateWestFlank', 2.0, 1.8, 2.0, new Vector3(-8, 0.9, 7), crateMat);
  addBox('crateEastFlank', 2.0, 1.8, 2.0, new Vector3(8, 0.9, -6), crateMat);
  addBox('crateNorthWest', 1.8, 1.8, 1.8, new Vector3(-12, 0.9, -8), crateMat);
  addBox('crateSouthEast', 1.8, 1.8, 1.8, new Vector3(12, 0.9, 12), crateMat);

  // ==================== 8. STONE LANTERNS WITH WARM LIGHTING ====================
  const lanternPositions = [
    new Vector3(-5.5, 0.9, -3.5),
    new Vector3(5.5, 0.9, -3.5),
    new Vector3(-5.5, 0.9, 5.5),
    new Vector3(5.5, 0.9, 5.5),
    new Vector3(-14, 0.9, -11),
    new Vector3(14, 0.9, -11)
  ];

  for (let i = 0; i < lanternPositions.length; i++) {
    const pos = lanternPositions[i];
    // Base & body
    addBox(`lanternBase_${i}`, 0.7, 1.8, 0.7, pos, stoneMat);

    // Warm point light radiating from lantern
    const pLight = new PointLight(`lanternLight_${i}`, new Vector3(pos.x, 2.0, pos.z), scene);
    pLight.diffuse = new Color3(1.0, 0.75, 0.4);
    pLight.specular = new Color3(0.4, 0.3, 0.1);
    pLight.intensity = 1.2;
    pLight.range = 10;
  }

  // ==================== 9. AMBIENT & DIRECTIONAL LIGHTING ====================
  // Hemispheric light guarantees bright sky and ground visibility (no black screen!)
  const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
  hemiLight.diffuse = new Color3(0.85, 0.88, 0.95);
  hemiLight.groundColor = new Color3(0.35, 0.38, 0.45);
  hemiLight.intensity = 0.95;

  // Directional moonlight / sun
  const dirLight = new DirectionalLight('dirLight', new Vector3(0.5, -1, 0.5), scene);
  dirLight.position = new Vector3(20, 35, 20);
  dirLight.diffuse = new Color3(1.0, 0.95, 0.9);
  dirLight.intensity = 0.75;

  // ==================== 10. SPAWN POINTS ====================
  const spawnPoints: BabylonSpawnPoint[] = [
    { position: new Vector3(0, 1.0, 24), yaw: 0 },              // South Main
    { position: new Vector3(0, 2.0, -12), yaw: Math.PI },        // Shrine Front
    { position: new Vector3(-18, 4.5, 2), yaw: Math.PI / 2 },    // Catwalk Balcony
    { position: new Vector3(-24, 1.0, -20), yaw: Math.PI / 4 },  // North-West
    { position: new Vector3(24, 1.0, -20), yaw: -Math.PI / 4 }, // North-East
    { position: new Vector3(-22, 1.0, 22), yaw: -Math.PI / 4 }, // South-West
    { position: new Vector3(22, 1.0, 22), yaw: Math.PI / 4 },   // South-East
    { position: new Vector3(12, 1.0, 0), yaw: Math.PI },         // East Corridor
    { position: new Vector3(-12, 1.0, 0), yaw: 0 },              // West Courtyard
    { position: new Vector3(0, 1.0, 8), yaw: 0 }                 // In front of Torii
  ];

  // ==================== 11. BOT WAYPOINTS ====================
  const botWaypoints: Vector3[] = [
    new Vector3(0, 1.0, 18),
    new Vector3(0, 1.0, 4),
    new Vector3(0, 1.8, -12),
    new Vector3(-10, 1.0, 5),
    new Vector3(10, 1.0, -5),
    new Vector3(-18, 4.5, 5),
    new Vector3(-18, 1.0, 22),
    new Vector3(22, 1.0, -10),
    new Vector3(22, 1.0, 12),
    new Vector3(-20, 1.0, -15),
    new Vector3(0, 1.0, -6),
    new Vector3(-6, 1.0, 12)
  ];

  return {
    spawnPoints,
    botWaypoints,
    colliders
  };
}

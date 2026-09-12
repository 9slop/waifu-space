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

export interface BabylonSpawnPoint {
  position: Vector3;
  yaw: number;
}

export interface BabylonMapData {
  spawnPoints: BabylonSpawnPoint[];
  colliders: AbstractMesh[];
}

/**
 * Builds the expanded low-poly "Cyber Shrine" tactical deathmatch map in Babylon.js (84m x 84m).
 * Brightly illuminated with multi-directional sunlight, soft hemispheric fill, and glowing lanterns.
 * All obstacle meshes have `checkCollisions = true` for seamless, robust swept-collision.
 */
export function createCyberShrineMap(scene: Scene): BabylonMapData {
  const colliders: AbstractMesh[] = [];

  // ==================== MATERIALS ====================
  function createMat(name: string, diff: Color3, spec = new Color3(0.08, 0.08, 0.08), emissive?: Color3): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = diff;
    mat.specularColor = spec;
    if (emissive) mat.emissiveColor = emissive;
    mat.maxSimultaneousLights = 6;
    return mat;
  }

  // Ground stone (clean flagged stone)
  const groundMat = createMat('matGround', new Color3(0.24, 0.27, 0.32), new Color3(0.08, 0.08, 0.08));

  // Perimeter & Building Walls (Slate stone)
  const wallMat = createMat('matWall', new Color3(0.18, 0.22, 0.28), new Color3(0.1, 0.1, 0.1));

  // Shrine Vermilion Red Wood
  const shrineRedMat = createMat('matShrineRed', new Color3(0.85, 0.22, 0.22), new Color3(0.18, 0.18, 0.18));

  // Shrine Gold Accents
  const goldMat = createMat('matGold', new Color3(0.95, 0.78, 0.26), new Color3(0.2, 0.2, 0.2), new Color3(0.18, 0.12, 0.02));

  // Cover Crates (Warm wood)
  const crateMat = createMat('matCrate', new Color3(0.72, 0.42, 0.18), new Color3(0.08, 0.08, 0.08));

  // Stone Lantern Granite
  const stoneMat = createMat('matStone', new Color3(0.48, 0.52, 0.58), new Color3(0.1, 0.1, 0.1));

  // Sakura Tree Foliage (Anime pink)
  const sakuraMat = createMat('matSakura', new Color3(1.0, 0.55, 0.74), new Color3(0.1, 0.1, 0.1), new Color3(0.25, 0.10, 0.16));

  // Tree Bark Wood
  const barkMat = createMat('matBark', new Color3(0.35, 0.22, 0.15), new Color3(0.04, 0.04, 0.04));

  // Cyber Neon Trims
  const neonPinkMat = createMat('matNeonPink', new Color3(1.0, 0.40, 0.70), new Color3(0.2, 0.2, 0.2), new Color3(1.0, 0.40, 0.70));
  const neonCyanMat = createMat('matNeonCyan', new Color3(0.0, 0.90, 0.88), new Color3(0.2, 0.2, 0.2), new Color3(0.0, 0.90, 0.88));

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

  // ==================== 1. EXPANDED ARENA GROUND (84x84m) ====================
  const ground = MeshBuilder.CreateGround('mainGround', { width: 84, height: 84, subdivisions: 4 }, scene);
  ground.position = new Vector3(0, 0, 0);
  ground.material = groundMat;
  ground.checkCollisions = true;
  colliders.push(ground);

  // ==================== 2. PERIMETER WALLS ====================
  // North Wall (Z = -42)
  addBox('wallNorth', 84, 7, 1.2, new Vector3(0, 3.5, -42), wallMat);
  // South Wall (Z = 42)
  addBox('wallSouth', 84, 7, 1.2, new Vector3(0, 3.5, 42), wallMat);
  // West Wall (X = -42)
  addBox('wallWest', 1.2, 7, 84, new Vector3(-42, 3.5, 0), wallMat);
  // East Wall (X = 42)
  addBox('wallEast', 1.2, 7, 84, new Vector3(42, 3.5, 0), wallMat);

  // Decorative Neon cyber trims along top edges of walls
  addBox('neonNorth', 84, 0.18, 0.18, new Vector3(0, 6.8, -41.3), neonPinkMat, false);
  addBox('neonSouth', 84, 0.18, 0.18, new Vector3(0, 6.8, 41.3), neonCyanMat, false);
  addBox('neonWest', 0.18, 0.18, 84, new Vector3(-41.3, 6.8, 0), neonCyanMat, false);
  addBox('neonEast', 0.18, 0.18, 84, new Vector3(41.3, 6.8, 0), neonPinkMat, false);

  // ==================== 3. TORII ENTRANCE AVENUE ====================
  function createTorii(prefix: string, zPos: number, scale = 1.0) {
    const pW = 0.8 * scale;
    const pH = 7.0 * scale;
    const span = 4.5 * scale;
    addBox(`${prefix}_PillarL`, pW, pH, pW, new Vector3(-span, pH / 2, zPos), shrineRedMat);
    addBox(`${prefix}_PillarR`, pW, pH, pW, new Vector3(span, pH / 2, zPos), shrineRedMat);
    addBox(`${prefix}_BeamTop`, (span * 2) + 3.2, 0.85 * scale, 1.2 * scale, new Vector3(0, pH - 0.2, zPos), shrineRedMat);
    addBox(`${prefix}_BeamSub`, (span * 2) + 1.8, 0.45 * scale, 0.8 * scale, new Vector3(0, pH - 1.4, zPos), shrineRedMat);
    addBox(`${prefix}_Plaque`, 0.9 * scale, 1.1 * scale, 0.3 * scale, new Vector3(0, pH - 0.8, zPos), goldMat, false);
  }

  // Grand Outer Torii Gate (South entrance: Z = 24)
  createTorii('toriiOuter', 24, 1.1);
  // Center Torii Gate (Center courtyard: Z = 0)
  createTorii('toriiCenter', 0, 1.0);

  // ==================== 4. CENTRAL SHRINE PAVILION (North) ====================
  // Raised Stone Platform
  addBox('shrinePlatform', 20, 1.4, 16, new Vector3(0, 0.7, -22), groundMat);
  // Platform Front Steps
  addBox('shrineStep1', 10, 0.45, 2.5, new Vector3(0, 0.22, -13), groundMat);
  addBox('shrineStep2', 10, 0.45, 2.5, new Vector3(0, 0.67, -14.5), groundMat);
  addBox('shrineStep3', 10, 0.45, 2.5, new Vector3(0, 1.12, -16), groundMat);

  // Shrine Pavilion Back Wall
  addBox('shrineBackWall', 18, 5.5, 1.2, new Vector3(0, 3.8, -29.4), wallMat);
  // Shrine Pillars
  addBox('shrinePillarFL', 0.9, 5.0, 0.9, new Vector3(-8.5, 3.6, -15), goldMat);
  addBox('shrinePillarFR', 0.9, 5.0, 0.9, new Vector3(8.5, 3.6, -15), goldMat);
  addBox('shrinePillarBL', 0.9, 5.0, 0.9, new Vector3(-8.5, 3.6, -28), goldMat);
  addBox('shrinePillarBR', 0.9, 5.0, 0.9, new Vector3(8.5, 3.6, -28), goldMat);

  // Shrine Roof Overhang
  addBox('shrineRoof', 22, 0.8, 18, new Vector3(0, 6.4, -22), shrineRedMat);

  // Sacred Altar Cover (Tactical peek spot)
  addBox('shrineAltar', 4.5, 1.4, 2.8, new Vector3(0, 2.1, -23), goldMat);

  // ==================== 5. WEST CATWALK & SNIPER BALCONY (X = -25) ====================
  // Elevated Catwalk Floor
  addBox('catwalkFloor', 7, 0.45, 28, new Vector3(-25, 3.6, 2), groundMat);
  // Railing cover
  addBox('catwalkRail', 0.35, 1.1, 28, new Vector3(-21.4, 4.35, 2), wallMat);

  // Ramp connecting Courtyard to Catwalk (South to North)
  const ramp = MeshBuilder.CreateBox('catwalkRamp', { width: 6, height: 0.45, depth: 14 }, scene);
  ramp.position = new Vector3(-25, 1.8, 22.5);
  ramp.rotation.x = -Math.atan2(3.6, 14);
  ramp.material = groundMat;
  ramp.checkCollisions = true;
  colliders.push(ramp);

  // Support pillars under catwalk
  addBox('catwalkPillar1', 0.9, 3.6, 0.9, new Vector3(-27, 1.8, -10), wallMat);
  addBox('catwalkPillar2', 0.9, 3.6, 0.9, new Vector3(-23, 1.8, 4), wallMat);
  addBox('catwalkPillar3', 0.9, 3.6, 0.9, new Vector3(-27, 1.8, 14), wallMat);

  // ==================== 6. EAST ZEN GAZEBO & PAVILION (X = 25) ====================
  // Raised Gazebo Floor
  addBox('eastPavilionFloor', 12, 1.4, 12, new Vector3(25, 0.7, 0), groundMat);
  // Gazebo Roof
  addBox('eastPavilionRoof', 14, 0.7, 14, new Vector3(25, 5.2, 0), shrineRedMat);
  // 4 Gazebo Pillars
  addBox('eastPillar1', 0.8, 4.5, 0.8, new Vector3(20, 2.95, -5), goldMat);
  addBox('eastPillar2', 0.8, 4.5, 0.8, new Vector3(30, 2.95, -5), goldMat);
  addBox('eastPillar3', 0.8, 4.5, 0.8, new Vector3(20, 2.95, 5), goldMat);
  addBox('eastPillar4', 0.8, 4.5, 0.8, new Vector3(30, 2.95, 5), goldMat);

  // Gazebo Entrance Steps (West and East)
  addBox('eastPavilionStepW', 1.8, 0.45, 6, new Vector3(18.2, 0.22, 0), groundMat);
  addBox('eastPavilionStepE', 1.8, 0.45, 6, new Vector3(31.8, 0.22, 0), groundMat);

  // Central Stone Bench Cover inside Gazebo
  addBox('gazeboBench', 4, 1.1, 1.5, new Vector3(25, 1.95, 0), stoneMat);

  // ==================== 7. CHERRY BLOSSOM TREES (Sakura) ====================
  function createSakuraTree(name: string, pos: Vector3) {
    // Stone Planter Base
    addBox(`${name}_Planter`, 3.0, 0.7, 3.0, new Vector3(pos.x, 0.35, pos.z), stoneMat);

    // Trunk
    const trunk = MeshBuilder.CreateCylinder(`${name}_Trunk`, { height: 3.8, diameter: 0.55 }, scene);
    trunk.position = new Vector3(pos.x, 2.2, pos.z);
    trunk.material = barkMat;
    trunk.checkCollisions = true;
    colliders.push(trunk);

    // Blossom Foliage Canopy (Double sphere cluster)
    const blossomMain = MeshBuilder.CreateSphere(`${name}_Blossom1`, { diameter: 4.2, segments: 8 }, scene);
    blossomMain.position = new Vector3(pos.x, 4.4, pos.z);
    blossomMain.material = sakuraMat;

    const blossomSec = MeshBuilder.CreateSphere(`${name}_Blossom2`, { diameter: 3.4, segments: 8 }, scene);
    blossomSec.position = new Vector3(pos.x + 0.8, 5.1, pos.z + 0.6);
    blossomSec.material = sakuraMat;
  }

  createSakuraTree('treeNW', new Vector3(-18, 0, -26));
  createSakuraTree('treeNE', new Vector3(18, 0, -26));
  createSakuraTree('treeSW', new Vector3(-20, 0, 18));
  createSakuraTree('treeSE', new Vector3(20, 0, 18));

  // ==================== 8. TACTICAL COVER CRATES, WALLS & BARRICADES ====================
  // Mid-area cover near Torii arches
  addBox('crateMid1', 2.4, 1.8, 2.4, new Vector3(3.5, 0.9, 10), crateMat);
  addBox('crateMid2', 2.0, 1.8, 2.0, new Vector3(5.2, 0.9, 9), crateMat);
  addBox('crateMidStack', 1.8, 1.4, 1.8, new Vector3(4.2, 2.5, 9.5), crateMat);

  // West Flank Stone Barrier
  addBox('stoneBarrierW', 6.0, 1.25, 0.8, new Vector3(-10, 0.62, 8), stoneMat);
  addBox('crateWestFlank', 2.2, 1.8, 2.2, new Vector3(-11, 0.9, 11), crateMat);

  // East Flank Stone Barrier
  addBox('stoneBarrierE', 6.0, 1.25, 0.8, new Vector3(10, 0.62, -8), stoneMat);
  addBox('crateEastFlank', 2.2, 1.8, 2.2, new Vector3(11, 0.9, -11), crateMat);

  // Courtyard Central Dividers (Waist-high tactical peek cover)
  addBox('midWallL', 5.0, 1.3, 0.8, new Vector3(-7, 0.65, -3), wallMat);
  addBox('midWallR', 5.0, 1.3, 0.8, new Vector3(7, 0.65, -3), wallMat);

  // Crate clusters in outer zones
  addBox('crateOuterNW', 2.4, 1.8, 2.4, new Vector3(-32, 0.9, -15), crateMat);
  addBox('crateOuterNE', 2.4, 1.8, 2.4, new Vector3(32, 0.9, -15), crateMat);
  addBox('crateOuterSW', 2.4, 1.8, 2.4, new Vector3(-32, 0.9, 15), crateMat);
  addBox('crateOuterSE', 2.4, 1.8, 2.4, new Vector3(32, 0.9, 15), crateMat);

  // ==================== 9. STONE LANTERNS WITH WARM LIGHTING ====================
  const lanternPositions = [
    new Vector3(-6.5, 0.9, -6.5),
    new Vector3(6.5, 0.9, -6.5),
    new Vector3(-6.5, 0.9, 14),
    new Vector3(6.5, 0.9, 14),
    new Vector3(-18, 0.9, -14),
    new Vector3(18, 0.9, -14),
    new Vector3(-25, 4.4, -8), // On Catwalk
    new Vector3(25, 1.9, -7)   // Near East Pavilion
  ];

  for (let i = 0; i < lanternPositions.length; i++) {
    const pos = lanternPositions[i];
    // Base & body
    addBox(`lanternBase_${i}`, 0.8, 2.0, 0.8, pos, stoneMat);

    // Warm point light radiating from lantern
    const pLight = new PointLight(`lanternLight_${i}`, new Vector3(pos.x, pos.y + 1.2, pos.z), scene);
    pLight.diffuse = new Color3(1.0, 0.82, 0.52);
    pLight.specular = new Color3(0.5, 0.4, 0.2);
    pLight.intensity = 1.6;
    pLight.range = 15;
  }

  // ==================== 10. BRIGHT AMBIENT & MULTI-DIRECTIONAL SUNLIGHT ====================
  // Bright Hemispheric Light - Sky and ground fill
  const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
  hemiLight.diffuse = new Color3(1.15, 1.22, 1.35);
  hemiLight.groundColor = new Color3(0.68, 0.70, 0.78);
  hemiLight.intensity = 1.45;

  // Primary warm sunlight from southwest
  const sunLight = new DirectionalLight('sunLight', new Vector3(0.45, -1, 0.45), scene);
  sunLight.position = new Vector3(-25, 45, -25);
  sunLight.diffuse = new Color3(1.0, 0.96, 0.90);
  sunLight.specular = new Color3(0.4, 0.4, 0.4);
  sunLight.intensity = 1.35;

  // Secondary cool sky fill light from opposite angle to prevent dark black shadow pockets
  const fillLight = new DirectionalLight('fillLight', new Vector3(-0.45, -0.85, -0.45), scene);
  fillLight.position = new Vector3(25, 35, 25);
  fillLight.diffuse = new Color3(0.85, 0.90, 1.0);
  fillLight.intensity = 0.85;

  // ==================== 11. SPAWN POINTS ====================
  const spawnPoints: BabylonSpawnPoint[] = [
    { position: new Vector3(0, 1.0, 34), yaw: 0 },               // South Avenue
    { position: new Vector3(0, 1.5, -20), yaw: Math.PI },        // North Shrine Front
    { position: new Vector3(-25, 4.6, 0), yaw: Math.PI / 2 },    // West Catwalk Balcony
    { position: new Vector3(25, 1.5, 0), yaw: -Math.PI / 2 },    // East Zen Pavilion
    { position: new Vector3(-32, 1.0, -28), yaw: Math.PI / 4 },  // North-West Outer
    { position: new Vector3(32, 1.0, -28), yaw: -Math.PI / 4 }, // North-East Outer
    { position: new Vector3(-32, 1.0, 28), yaw: -Math.PI / 4 }, // South-West Outer
    { position: new Vector3(32, 1.0, 28), yaw: Math.PI / 4 },   // South-East Outer
    { position: new Vector3(14, 1.0, 4), yaw: Math.PI },         // East Courtyard
    { position: new Vector3(-14, 1.0, 4), yaw: 0 }               // West Courtyard
  ];

  return {
    spawnPoints,
    colliders
  };
}

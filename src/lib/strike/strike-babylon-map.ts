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
 * Builds the competitive tactical FPS map "Kyoto v2" in Babylon.js (104m × 104m).
 *
 * Strict 3-lane competitive layout inspired by CS2 / Valorant:
 *
 *   Lane A  ("A-Long")   — West Machiya Street, long-range / AWP lane
 *   Mid     ("Torii Ave") — Central high-risk corridor, both teams meet at ~6s
 *   Lane B  ("B-Short")  — East Merchant Quarter, close-quarters combat
 *   Secret  ("Roji")     — East flank passage, slow but uncontested B-Site flank
 *
 *   A-Site  ("Tea House Courtyard")  — NW, 3 entry points, raised wooden platform
 *   B-Site  ("Temple Gate / Shrine") — NE, 3 entry points, elevated stone platform
 *
 *   Connectors: A-Short (Mid↔A), B-Short (Mid↔B), Mid-to-A, Mid-to-B
 *
 * Timing: Both teams reach mid chokepoints in ~5.9s at rifle speed (7.4 m/s).
 * Sightlines: No unbroken sightline >20m (A-Long split by stone gate into 2×30m).
 *
 * Background: Daytime Japan skybox, Mount Fuji (NW), surrounding mountain ridges.
 */
export function createKyotoMap(scene: Scene): BabylonMapData {
  const colliders: AbstractMesh[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // 1. MATERIALS PALETTE
  // ═══════════════════════════════════════════════════════════════════
  function createMat(
    name: string,
    diff: Color3,
    spec = new Color3(0.08, 0.08, 0.08),
    emissive?: Color3
  ): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = diff;
    mat.specularColor = spec;
    if (emissive) mat.emissiveColor = emissive;
    mat.maxSimultaneousLights = 4;
    return mat;
  }

  // Street & courtyard stone pavement
  const groundMat = createMat('matGround', new Color3(0.38, 0.40, 0.43));
  // Raked zen sand / gravel (A-Site garden)
  const zenSandMat = createMat('matZenSand', new Color3(0.68, 0.67, 0.62), new Color3(0.04, 0.04, 0.04));
  // Polished cedar planks (verandas, decks)
  const woodDeckMat = createMat('matWoodDeck', new Color3(0.34, 0.22, 0.14), new Color3(0.06, 0.06, 0.06));
  // Perimeter boundary walls
  const wallMat = createMat('matWall', new Color3(0.24, 0.26, 0.30));
  // Machiya dark timber beams & pillars
  const timberMat = createMat('matTimber', new Color3(0.20, 0.14, 0.09), new Color3(0.04, 0.04, 0.04));
  // Earthen plaster / stucco walls
  const plasterMat = createMat('matPlaster', new Color3(0.72, 0.70, 0.65), new Color3(0.03, 0.03, 0.03));
  // Charcoal kawara clay roof tiles
  const tileRoofMat = createMat('matTileRoof', new Color3(0.15, 0.17, 0.20), new Color3(0.10, 0.10, 0.10));
  // Rice paper shoji screens (subtle warm glow)
  const shojiMat = createMat('matShoji', new Color3(0.82, 0.79, 0.72), new Color3(0.02, 0.02, 0.02), new Color3(0.08, 0.07, 0.05));
  // Vermilion shrine red
  const shrineRedMat = createMat('matShrineRed', new Color3(0.78, 0.18, 0.16), new Color3(0.12, 0.12, 0.12));
  // Gold accents & sacred altar
  const goldMat = createMat('matGold', new Color3(0.85, 0.70, 0.22), new Color3(0.18, 0.18, 0.18), new Color3(0.08, 0.06, 0.02));
  // Wooden supply crates
  const crateMat = createMat('matCrate', new Color3(0.58, 0.36, 0.16));
  // Stone lanterns & tactical barriers
  const stoneMat = createMat('matStone', new Color3(0.42, 0.45, 0.48));
  // Glowing lantern paper
  const lanternGlowMat = createMat('matLanternGlow', new Color3(0.95, 0.82, 0.50), new Color3(0, 0, 0), new Color3(0.70, 0.55, 0.25));
  // Sakura foliage
  const sakuraMat = createMat('matSakura', new Color3(0.92, 0.52, 0.68), new Color3(0.08, 0.08, 0.08), new Color3(0.14, 0.05, 0.09));
  // Tree bark
  const barkMat = createMat('matBark', new Color3(0.28, 0.18, 0.12), new Color3(0.04, 0.04, 0.04));
  // Bamboo
  const bambooMat = createMat('matBamboo', new Color3(0.45, 0.54, 0.24));
  // Neon trims (cyber accent)
  const neonPinkMat = createMat('matNeonPink', new Color3(0.90, 0.35, 0.62), new Color3(0.2, 0.2, 0.2), new Color3(0.60, 0.25, 0.42));
  const neonCyanMat = createMat('matNeonCyan', new Color3(0.0, 0.80, 0.78), new Color3(0.2, 0.2, 0.2), new Color3(0.0, 0.60, 0.58));
  // Dark wood for carts/barrels
  const darkWoodMat = createMat('matDarkWood', new Color3(0.18, 0.12, 0.07), new Color3(0.04, 0.04, 0.04));

  // ═══════════════════════════════════════════════════════════════════
  // 2. HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  /** Box with automatic collision registration */
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

  /**
   * Authentic Kyoto Machiya townhouse — plaster body, timber frame,
   * kawara tile gabled roof, optional shoji screens & veranda.
   */
  function createMachiyaHouse(
    prefix: string,
    pos: Vector3,
    w: number,
    h: number,
    d: number,
    options: {
      hasVeranda?: boolean;
      verandaSide?: 'north' | 'south' | 'east' | 'west';
      hasShoji?: boolean;
    } = {}
  ) {
    const { hasVeranda = false, verandaSide = 'south', hasShoji = true } = options;

    // Main plaster body
    addBox(`${prefix}_Body`, w, h, d, new Vector3(pos.x, pos.y + h / 2, pos.z), plasterMat);

    // Corner timber columns
    const pw = 0.5;
    const hw = w / 2 - pw / 2;
    const hd = d / 2 - pw / 2;
    addBox(`${prefix}_PFL`, pw, h, pw, new Vector3(pos.x - hw, pos.y + h / 2, pos.z + hd), timberMat);
    addBox(`${prefix}_PFR`, pw, h, pw, new Vector3(pos.x + hw, pos.y + h / 2, pos.z + hd), timberMat);
    addBox(`${prefix}_PBL`, pw, h, pw, new Vector3(pos.x - hw, pos.y + h / 2, pos.z - hd), timberMat);
    addBox(`${prefix}_PBR`, pw, h, pw, new Vector3(pos.x + hw, pos.y + h / 2, pos.z - hd), timberMat);

    // Mid-level timber band
    addBox(`${prefix}_BmF`, w + 0.1, 0.3, 0.35, new Vector3(pos.x, pos.y + h * 0.52, pos.z + hd), timberMat);
    addBox(`${prefix}_BmB`, w + 0.1, 0.3, 0.35, new Vector3(pos.x, pos.y + h * 0.52, pos.z - hd), timberMat);

    // Shoji screens
    if (hasShoji) {
      addBox(`${prefix}_ShF`, Math.min(w * 0.6, 5), h * 0.3, 0.12,
        new Vector3(pos.x, pos.y + h * 0.25, pos.z + hd + 0.12), shojiMat, false);
      addBox(`${prefix}_ShU`, Math.min(w * 0.5, 4), h * 0.22, 0.12,
        new Vector3(pos.x, pos.y + h * 0.75, pos.z + hd + 0.12), shojiMat, false);
    }

    // Kawara tile gabled roof (overhanging eaves)
    const oh = 1.3;
    const rW = w + oh * 2;
    const rD = d + oh * 2;
    addBox(`${prefix}_Eaves`, rW, 0.5, rD, new Vector3(pos.x, pos.y + h + 0.25, pos.z), tileRoofMat);
    addBox(`${prefix}_Ridge`, rW * 0.7, 0.65, rD * 0.7, new Vector3(pos.x, pos.y + h + 0.75, pos.z), tileRoofMat);
    addBox(`${prefix}_Cap`, rW * 0.45, 0.35, rD * 0.45, new Vector3(pos.x, pos.y + h + 1.15, pos.z), timberMat);

    // Optional veranda (engawa)
    if (hasVeranda) {
      const dH = 0.45;
      if (verandaSide === 'south')
        addBox(`${prefix}_Vr`, w, dH, 1.6, new Vector3(pos.x, pos.y + dH / 2, pos.z + d / 2 + 0.8), woodDeckMat);
      else if (verandaSide === 'north')
        addBox(`${prefix}_Vr`, w, dH, 1.6, new Vector3(pos.x, pos.y + dH / 2, pos.z - d / 2 - 0.8), woodDeckMat);
      else if (verandaSide === 'east')
        addBox(`${prefix}_Vr`, 1.6, dH, d, new Vector3(pos.x + w / 2 + 0.8, pos.y + dH / 2, pos.z), woodDeckMat);
      else if (verandaSide === 'west')
        addBox(`${prefix}_Vr`, 1.6, dH, d, new Vector3(pos.x - w / 2 - 0.8, pos.y + dH / 2, pos.z), woodDeckMat);
    }
  }

  /** Torii gate with pillars, crossbeams, and plaque */
  function createTorii(prefix: string, pos: Vector3, scale = 1.0) {
    const pW = 0.8 * scale;
    const pH = 7.0 * scale;
    const span = 4.5 * scale;
    addBox(`${prefix}_PL`, pW, pH, pW, new Vector3(pos.x - span, pos.y + pH / 2, pos.z), shrineRedMat);
    addBox(`${prefix}_PR`, pW, pH, pW, new Vector3(pos.x + span, pos.y + pH / 2, pos.z), shrineRedMat);
    addBox(`${prefix}_Top`, span * 2 + 3.2, 0.85 * scale, 1.1 * scale, new Vector3(pos.x, pos.y + pH - 0.2, pos.z), shrineRedMat);
    addBox(`${prefix}_Sub`, span * 2 + 1.6, 0.4 * scale, 0.7 * scale, new Vector3(pos.x, pos.y + pH - 1.3, pos.z), shrineRedMat);
    addBox(`${prefix}_Plq`, 0.85 * scale, 1.1 * scale, 0.25 * scale, new Vector3(pos.x, pos.y + pH - 0.75, pos.z), goldMat, false);
  }

  /** Sakura tree with stone planter, trunk cylinder, and blossom spheres */
  function createSakuraTree(name: string, pos: Vector3) {
    addBox(`${name}_Pl`, 2.8, 0.6, 2.8, new Vector3(pos.x, 0.3, pos.z), stoneMat);
    const trunk = MeshBuilder.CreateCylinder(`${name}_Tr`, { height: 3.8, diameter: 0.55 }, scene);
    trunk.position = new Vector3(pos.x, 2.2, pos.z);
    trunk.material = barkMat;
    trunk.checkCollisions = true;
    colliders.push(trunk);
    const bl1 = MeshBuilder.CreateSphere(`${name}_Bl1`, { diameter: 4.2, segments: 8 }, scene);
    bl1.position = new Vector3(pos.x, 4.4, pos.z);
    bl1.material = sakuraMat;
    bl1.isPickable = false;
    const bl2 = MeshBuilder.CreateSphere(`${name}_Bl2`, { diameter: 3.2, segments: 8 }, scene);
    bl2.position = new Vector3(pos.x + 0.8, 5.1, pos.z + 0.6);
    bl2.material = sakuraMat;
    bl2.isPickable = false;
  }

  /** Bamboo fence segment */
  function createBambooFence(prefix: string, pos: Vector3, length: number, alongZ = true) {
    const w = alongZ ? 0.35 : length;
    const d = alongZ ? length : 0.35;
    addBox(`${prefix}_Fn`, w, 2.4, d, new Vector3(pos.x, 1.2, pos.z), bambooMat);
  }

  /** Tactical crate cluster (single + adjacent + optional stacked) */
  function createCrateCluster(prefix: string, pos: Vector3, withStack = true) {
    addBox(`${prefix}_1`, 2.2, 1.7, 2.2, new Vector3(pos.x, 0.85, pos.z), crateMat);
    addBox(`${prefix}_2`, 1.8, 1.7, 1.8, new Vector3(pos.x + 1.6, 0.85, pos.z - 0.3), crateMat);
    if (withStack)
      addBox(`${prefix}_T`, 1.6, 1.3, 1.6, new Vector3(pos.x + 0.7, 2.35, pos.z - 0.15), crateMat);
  }

  /** Merchant stall with counter, pillars, and overhanging roof */
  function createMerchantStall(prefix: string, pos: Vector3, w: number, d: number, openSide: 'north' | 'south' | 'east' | 'west' = 'south') {
    const h = 3.2;
    // Counter (waist-high)
    if (openSide === 'south' || openSide === 'north') {
      const cZ = openSide === 'south' ? pos.z + d / 2 - 0.4 : pos.z - d / 2 + 0.4;
      addBox(`${prefix}_Ctr`, w * 0.8, 1.1, 0.6, new Vector3(pos.x, 0.55, cZ), darkWoodMat);
    }
    // Back wall
    const bwZ = openSide === 'south' ? pos.z - d / 2 + 0.2 : pos.z + d / 2 - 0.2;
    addBox(`${prefix}_BW`, w, h, 0.4, new Vector3(pos.x, h / 2, bwZ), plasterMat);
    // Side walls (partial, leaving 1m gap at open end)
    addBox(`${prefix}_SWL`, 0.35, h, d * 0.7, new Vector3(pos.x - w / 2 + 0.2, h / 2, pos.z + (openSide === 'south' ? -d * 0.15 : d * 0.15)), plasterMat);
    addBox(`${prefix}_SWR`, 0.35, h, d * 0.7, new Vector3(pos.x + w / 2 - 0.2, h / 2, pos.z + (openSide === 'south' ? -d * 0.15 : d * 0.15)), plasterMat);
    // Overhanging tiled roof
    addBox(`${prefix}_Rf`, w + 1.2, 0.4, d + 1.0, new Vector3(pos.x, h + 0.2, pos.z), tileRoofMat);
  }

  /** Stone lantern (base + glow cap) */
  function createStoneLantern(name: string, pos: Vector3) {
    addBox(`${name}_B`, 0.7, 1.7, 0.7, new Vector3(pos.x, 0.85, pos.z), stoneMat);
    addBox(`${name}_G`, 0.5, 0.5, 0.5, new Vector3(pos.x, 1.95, pos.z), lanternGlowMat, false);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. ARENA GROUND & PERIMETER WALLS (104m × 104m)
  // ═══════════════════════════════════════════════════════════════════

  // Main cobblestone ground
  const ground = MeshBuilder.CreateGround('mainGround', { width: 104, height: 104, subdivisions: 4 }, scene);
  ground.position = new Vector3(0, 0, 0);
  ground.material = groundMat;
  ground.checkCollisions = true;
  colliders.push(ground);

  // Perimeter walls (height 7.5m)
  addBox('wallN', 104, 7.5, 1.4, new Vector3(0, 3.75, -52), wallMat);
  addBox('wallS', 104, 7.5, 1.4, new Vector3(0, 3.75, 52), wallMat);
  addBox('wallW', 1.4, 7.5, 104, new Vector3(-52, 3.75, 0), wallMat);
  addBox('wallE', 1.4, 7.5, 104, new Vector3(52, 3.75, 0), wallMat);

  // Decorative wall copings
  addBox('copN', 104, 0.4, 1.8, new Vector3(0, 7.6, -52), tileRoofMat, false);
  addBox('copS', 104, 0.4, 1.8, new Vector3(0, 7.6, 52), tileRoofMat, false);
  addBox('copW', 1.8, 0.4, 104, new Vector3(-52, 7.6, 0), tileRoofMat, false);
  addBox('copE', 1.8, 0.4, 104, new Vector3(52, 7.6, 0), tileRoofMat, false);

  // Neon edge trims (subtle cyber accent)
  addBox('nN', 104, 0.14, 0.14, new Vector3(0, 7.2, -51.2), neonPinkMat, false);
  addBox('nS', 104, 0.14, 0.14, new Vector3(0, 7.2, 51.2), neonCyanMat, false);
  addBox('nW', 0.14, 0.14, 104, new Vector3(-51.2, 7.2, 0), neonCyanMat, false);
  addBox('nE', 0.14, 0.14, 104, new Vector3(51.2, 7.2, 0), neonPinkMat, false);

  // ═══════════════════════════════════════════════════════════════════
  // 4. ZONE 1: TEAM 1 SPAWN — "Cherry Blossom Plaza" (South, Z = +38..+48)
  // ═══════════════════════════════════════════════════════════════════

  // Raised spawn floor (subtle visual boundary)
  addBox('t1Floor', 42, 0.15, 12, new Vector3(0, 0.075, 44), groundMat, false);

  // Spawn cover walls (waist-high, channel exits)
  addBox('t1CoverL', 6, 1.35, 0.8, new Vector3(-8, 0.675, 40), stoneMat);
  addBox('t1CoverR', 6, 1.35, 0.8, new Vector3(8, 0.675, 40), stoneMat);

  // Spawn area flanking walls (guide players into 3 exits)
  addBox('t1WallWL', 8, 4.5, 0.8, new Vector3(-18, 2.25, 40), wallMat);  // West exit wall
  addBox('t1WallWR', 8, 4.5, 0.8, new Vector3(18, 2.25, 40), wallMat);   // East exit wall

  // Sakura trees for orientation
  createSakuraTree('sakuraT1L', new Vector3(-12, 0, 45));
  createSakuraTree('sakuraT1R', new Vector3(12, 0, 45));

  // Stone lanterns flanking mid exit
  createStoneLantern('lanT1L', new Vector3(-3, 0, 40));
  createStoneLantern('lanT1R', new Vector3(3, 0, 40));

  // ═══════════════════════════════════════════════════════════════════
  // 5. ZONE 2: TEAM 2 SPAWN — "Bamboo Garden" (North, Z = -48..-38)
  // ═══════════════════════════════════════════════════════════════════

  // Raised spawn floor
  addBox('t2Floor', 42, 0.15, 12, new Vector3(0, 0.075, -44), groundMat, false);

  // Spawn cover walls
  addBox('t2CoverL', 6, 1.35, 0.8, new Vector3(-8, 0.675, -40), stoneMat);
  addBox('t2CoverR', 6, 1.35, 0.8, new Vector3(8, 0.675, -40), stoneMat);

  // Spawn area flanking walls
  addBox('t2WallWL', 8, 4.5, 0.8, new Vector3(-18, 2.25, -40), wallMat);
  addBox('t2WallWR', 8, 4.5, 0.8, new Vector3(18, 2.25, -40), wallMat);

  // Bamboo groves
  createBambooFence('bambooT2L', new Vector3(-12, 0, -46), 6, true);
  createBambooFence('bambooT2R', new Vector3(12, 0, -46), 6, true);

  // Stone lanterns
  createStoneLantern('lanT2L', new Vector3(-3, 0, -40));
  createStoneLantern('lanT2R', new Vector3(3, 0, -40));

  // ═══════════════════════════════════════════════════════════════════
  // 6. ZONE 3: LANE A — "A-LONG" (West Machiya Street, X = -34..-22)
  //    Long-range lane. Sightlines broken by stone gate at Z=0.
  // ═══════════════════════════════════════════════════════════════════

  // --- West Machiya Row (solid lane boundary, 4 houses) ---
  createMachiyaHouse('mchAW1', new Vector3(-38, 0, -26), 9, 6.2, 10, { hasVeranda: true, verandaSide: 'east' });
  createMachiyaHouse('mchAW2', new Vector3(-38, 0, -10), 9, 6.5, 10, { hasVeranda: true, verandaSide: 'east' });
  createMachiyaHouse('mchAW3', new Vector3(-38, 0, 10), 9, 6.2, 10, { hasVeranda: true, verandaSide: 'east' });
  createMachiyaHouse('mchAW4', new Vector3(-38, 0, 26), 9, 6.2, 10, { hasVeranda: true, verandaSide: 'east' });

  // --- East Machiya Row (staggered for corner-peeking, 4 houses) ---
  // Offset Z positions to create alcoves players can duck into
  createMachiyaHouse('mchAE1', new Vector3(-22, 0, -24), 7, 6, 8, { hasShoji: true });
  createMachiyaHouse('mchAE2', new Vector3(-22, 0, -8), 7, 6, 8, { hasShoji: true });
  createMachiyaHouse('mchAE3', new Vector3(-22, 0, 8), 7, 6, 8, { hasShoji: true });
  createMachiyaHouse('mchAE4', new Vector3(-22, 0, 24), 7, 6, 8, { hasShoji: true });

  // --- Stone Gate "Ishimon" — CRITICAL sightline break at Z=0 ---
  // Splits A-Long into two ~30m halves. 3m gap in center for passage.
  addBox('ishimonL', 4.5, 4.5, 1.8, new Vector3(-32.5, 2.25, 0), stoneMat);  // Left pillar+wall
  addBox('ishimonR', 4.5, 4.5, 1.8, new Vector3(-24.5, 2.25, 0), stoneMat);  // Right pillar+wall
  addBox('ishimonTop', 13, 1.0, 2.2, new Vector3(-28.5, 5.0, 0), tileRoofMat); // Roof beam over gate
  // Note: 3m gap between X=-30.25 and X=-26.75 for player passage

  // --- Wooden merchant carts (waist-high cover, break micro-sightlines) ---
  addBox('cartA1', 2.8, 1.3, 1.6, new Vector3(-28, 0.65, -16), darkWoodMat);
  addBox('cartA2', 2.8, 1.3, 1.6, new Vector3(-28, 0.65, 16), darkWoodMat);

  // --- Crate stack near T1 approach ---
  createCrateCluster('crateALong1', new Vector3(-30, 0, 28), true);

  // --- Crate stack near T2 approach ---
  createCrateCluster('crateALong2', new Vector3(-30, 0, -28), false);

  // --- Engawa veranda protrusion (subtle angle break, east side) ---
  addBox('engawaA', 2, 0.45, 5, new Vector3(-25.5, 0.22, -16), woodDeckMat);

  // ═══════════════════════════════════════════════════════════════════
  // 7. ZONE 4: LANE B — "B-SHORT" (East Merchant Quarter, X = +22..+34)
  //    Close-quarters lane. No sightline > 12m. Lots of 90° turns.
  // ═══════════════════════════════════════════════════════════════════

  // --- Merchant stalls creating forced turns ---
  createMerchantStall('stallB1', new Vector3(26, 0, -16), 5, 4, 'south');
  createMerchantStall('stallB2', new Vector3(30, 0, -2), 4, 5, 'south');
  createMerchantStall('stallB3', new Vector3(26, 0, 12), 5, 4, 'north');
  createMerchantStall('stallB4', new Vector3(30, 0, 24), 4, 4, 'south');

  // --- Wall segments creating the winding path ---
  // West wall of B-Short (separates from mid)
  addBox('bShortWallW1', 0.8, 4, 10, new Vector3(22, 2, -16), plasterMat);
  addBox('bShortWallW2', 0.8, 4, 8, new Vector3(22, 2, 2), plasterMat);
  addBox('bShortWallW3', 0.8, 4, 10, new Vector3(22, 2, 16), plasterMat);

  // East wall segments (between B-Short and Secret Passage)
  addBox('bShortWallE1', 0.8, 4, 8, new Vector3(34, 2, -10), plasterMat);
  addBox('bShortWallE2', 0.8, 4, 12, new Vector3(34, 2, 8), plasterMat);
  addBox('bShortWallE3', 0.8, 4, 8, new Vector3(34, 2, 24), plasterMat);

  // --- Barrel clusters (waist-high cover) ---
  addBox('barrelB1', 1.4, 1.2, 1.4, new Vector3(28, 0.6, -8), crateMat);
  addBox('barrelB2', 1.4, 1.2, 1.4, new Vector3(24, 0.6, 6), crateMat);
  addBox('barrelB3', 1.4, 1.2, 1.4, new Vector3(28, 0.6, 18), crateMat);

  // --- Noren curtains (visual atmosphere, no collision) ---
  addBox('norenB1', 3.5, 2.2, 0.12, new Vector3(28, 2.9, -5), shojiMat, false);
  addBox('norenB2', 3.5, 2.2, 0.12, new Vector3(28, 2.9, 15), shojiMat, false);

  // --- Overhanging roof sections (claustrophobic feel) ---
  addBox('bRoof1', 6, 0.4, 7, new Vector3(28, 3.8, -8), tileRoofMat, false);
  addBox('bRoof2', 6, 0.4, 7, new Vector3(28, 3.8, 8), tileRoofMat, false);
  addBox('bRoof3', 6, 0.4, 7, new Vector3(28, 3.8, 24), tileRoofMat, false);

  // ═══════════════════════════════════════════════════════════════════
  // 8. ZONE 5: MID — "Torii Avenue" (Central, X = -8..+8, Z = -18..+18)
  //    High-risk, high-reward central lane. 4-way crossfire possible.
  // ═══════════════════════════════════════════════════════════════════

  // --- Grand Torii Gate (centerpiece) ---
  createTorii('toriiMid', new Vector3(0, 0, 0), 1.15);

  // --- Central Sakura Tree (soft cover via trunk + planter) ---
  createSakuraTree('sakuraMid', new Vector3(0, 0, 8));

  // --- Waist-high stone benches (key peek positions) ---
  addBox('benchMidL', 3, 1.1, 1.2, new Vector3(-5, 0.55, 4), stoneMat);   // A-connector peek
  addBox('benchMidR', 3, 1.1, 1.2, new Vector3(5, 0.55, -4), stoneMat);   // B-connector peek

  // --- Full-body crate stack (key mid hold position) ---
  createCrateCluster('crateMidA', new Vector3(-3, 0, -7), true);

  // --- Crouch cover crate (south mid) ---
  addBox('crateMidS', 2, 1.3, 2, new Vector3(4, 0.65, 12), crateMat);

  // --- Stone lanterns (orientation + thin cover) ---
  createStoneLantern('lanMidL', new Vector3(-6, 0, 0));
  createStoneLantern('lanMidR', new Vector3(6, 0, 0));

  // --- Mid flanking walls (channel players, separate from lanes) ---
  // These walls define the west and east edges of Mid
  // West: gap at Z = -14..-18 for Mid-to-A connector, gap at Z = 16..20 for south approach
  addBox('midWallW1', 0.8, 4, 12, new Vector3(-8, 2, -8), plasterMat);   // West upper segment
  addBox('midWallW2', 0.8, 4, 10, new Vector3(-8, 2, 10), plasterMat);   // West lower segment

  // East: gap at Z = -14..-18 for Mid-to-B connector, gap at Z = 16..20 for south approach
  addBox('midWallE1', 0.8, 4, 12, new Vector3(8, 2, -8), plasterMat);    // East upper segment
  addBox('midWallE2', 0.8, 4, 10, new Vector3(8, 2, 10), plasterMat);    // East lower segment

  // North: wall closing off mid from sites area (gap at center for passage)
  addBox('midWallNL', 5, 4, 0.8, new Vector3(-5.5, 2, -14), plasterMat);
  addBox('midWallNR', 5, 4, 0.8, new Vector3(5.5, 2, -14), plasterMat);
  // 3m gap at X = -3..+3 for mid north exit

  // ═══════════════════════════════════════════════════════════════════
  // 9. ZONE 6: A-SITE — "Tea House Courtyard" (NW, X = -38..-16, Z = -36..-22)
  //    Three entry points: A-Long north, A-Short, elevated drop.
  // ═══════════════════════════════════════════════════════════════════

  // --- Raised wooden platform (site floor, distinct footstep sound) ---
  addBox('aSiteFloor', 20, 0.4, 12, new Vector3(-27, 0.2, -29), woodDeckMat);

  // --- Zen sand garden visual overlay ---
  const zenGrd = MeshBuilder.CreateGround('zenGrdA', { width: 14, height: 10, subdivisions: 2 }, scene);
  zenGrd.position = new Vector3(-24, 0.42, -29);
  zenGrd.material = zenSandMat;
  zenGrd.checkCollisions = false;

  // --- Tea House main building (anchor structure, no entry) ---
  addBox('teaBody', 10, 5, 8, new Vector3(-33, 2.5, -29), plasterMat);
  // Tea house timber frame
  addBox('teaPFL', 0.5, 5, 0.5, new Vector3(-37.5, 2.5, -25.5), timberMat);
  addBox('teaPFR', 0.5, 5, 0.5, new Vector3(-28.5, 2.5, -25.5), timberMat);
  addBox('teaPBL', 0.5, 5, 0.5, new Vector3(-37.5, 2.5, -32.5), timberMat);
  addBox('teaPBR', 0.5, 5, 0.5, new Vector3(-28.5, 2.5, -32.5), timberMat);
  // Tea house roof
  addBox('teaRoof', 12.5, 0.55, 10.5, new Vector3(-33, 5.3, -29), tileRoofMat);
  addBox('teaRoofPk', 8, 0.5, 7, new Vector3(-33, 5.85, -29), tileRoofMat);
  // Tea house south veranda (elevated peek position, height 0.4m)
  addBox('teaVeranda', 10, 0.4, 2, new Vector3(-33, 0.6, -24.5), woodDeckMat);

  // --- Waist-high stone planter (default position cover) ---
  addBox('aPlanter', 3.5, 1.25, 1.2, new Vector3(-23, 0.825, -29), stoneMat);

  // --- Defense crate stack (post-plant cover behind altar area) ---
  createCrateCluster('crateASite', new Vector3(-27, 0, -34), false);

  // --- Stone lanterns ---
  createStoneLantern('lanAL', new Vector3(-20, 0, -26));
  createStoneLantern('lanAR', new Vector3(-35, 0, -33));

  // --- Bamboo privacy screen at A-Short entry (east edge of site) ---
  createBambooFence('bambooAShort', new Vector3(-17, 0, -29), 5, true);

  // --- A-Site boundary walls (prevent flanking from outside the defined entries) ---
  // North wall (connects to perimeter approach)
  addBox('aWallN', 22, 4.5, 0.8, new Vector3(-27, 2.25, -36), wallMat);
  // West wall (tea house acts as wall on west, just need gap closure)
  addBox('aWallW', 0.8, 4.5, 8, new Vector3(-38, 2.25, -25), wallMat);
  // Partial south wall with opening for A-Long entry (3m gap at X=-28)
  addBox('aWallSL', 7, 4.5, 0.8, new Vector3(-34.5, 2.25, -22), wallMat);
  addBox('aWallSR', 6, 4.5, 0.8, new Vector3(-20, 2.25, -22), wallMat);
  // Gap at X ≈ -30..-27 for A-Long north entry

  // ═══════════════════════════════════════════════════════════════════
  // 10. ZONE 7: B-SITE — "Temple Gate / Shrine" (NE, X = +16..+38, Z = -36..-22)
  //     Three entry points: B-Short stairs, Secret east, main gate.
  // ═══════════════════════════════════════════════════════════════════

  // --- Elevated stone platform (defenders have height advantage) ---
  addBox('bPlatform', 20, 0.9, 12, new Vector3(27, 0.45, -29), groundMat);

  // --- Stone steps (south face, 2 steps leading up to platform) ---
  addBox('bStep1', 10, 0.45, 2, new Vector3(27, 0.225, -22.5), groundMat);
  addBox('bStep2', 10, 0.45, 2, new Vector3(27, 0.675, -24), groundMat);

  // --- Main Torii Gate (iconic entry from south) ---
  createTorii('toriiBSite', new Vector3(27, 0, -22), 1.0);

  // --- Bell Tower (vertical landmark, not accessible inside) ---
  addBox('bellBody', 4, 6.5, 4, new Vector3(35, 3.7, -32), timberMat);
  addBox('bellRoof', 6, 0.55, 6, new Vector3(35, 7.2, -32), tileRoofMat);
  addBox('bellRoofPk', 4, 0.5, 4, new Vector3(35, 7.75, -32), tileRoofMat);
  // Gold bell (decorative)
  addBox('bellGold', 1.2, 1.5, 1.2, new Vector3(35, 5.5, -32), goldMat, false);

  // --- Sacred altar / plant zone (objective centerpiece) ---
  addBox('bAltar', 3, 1.2, 2, new Vector3(27, 1.5, -30), goldMat);

  // --- Stone barriers (waist-high cover for site defenders) ---
  addBox('bBarrierL', 3.5, 1.25, 0.8, new Vector3(21, 1.075, -29), stoneMat);
  addBox('bBarrierR', 3.5, 1.25, 0.8, new Vector3(33, 1.075, -29), stoneMat);

  // --- Elevated crate stack on platform ---
  createCrateCluster('crateBSite', new Vector3(30, 0.9, -26), false);

  // --- Stone lanterns ---
  createStoneLantern('lanBL', new Vector3(20, 0, -26));
  createStoneLantern('lanBR', new Vector3(34, 0, -26));

  // --- B-Site boundary walls ---
  // North wall
  addBox('bWallN', 22, 4.5, 0.8, new Vector3(27, 2.25, -36), wallMat);
  // East wall with gap for Secret Passage entry (~3m gap at Z=-29)
  addBox('bWallE1', 0.8, 4.5, 4, new Vector3(38, 2.25, -34), wallMat);
  addBox('bWallE2', 0.8, 4.5, 3, new Vector3(38, 2.25, -23.5), wallMat);
  // West partial wall (gap for B-Short connector)
  addBox('bWallWN', 4, 4.5, 0.8, new Vector3(19, 2.25, -36), wallMat);

  // ═══════════════════════════════════════════════════════════════════
  // 11. ZONE 8: CONNECTORS
  // ═══════════════════════════════════════════════════════════════════

  // --- A-Short: Mid (Z=-14) → A-Site (Z=-22), X = -14..-18 ---
  // Narrow covered corridor with 90° turn and 3 short stairs

  // Corridor walls
  addBox('aShortWW', 0.7, 4, 8, new Vector3(-17.5, 2, -18), plasterMat);
  addBox('aShortWE', 0.7, 4, 8, new Vector3(-13.5, 2, -18), plasterMat);
  // Covered roof
  addBox('aShortRf', 4.7, 0.35, 8.5, new Vector3(-15.5, 4.1, -18), tileRoofMat, false);
  // 3 stairs (each 0.2m rise, 0.8m deep)
  addBox('aShortSt1', 3, 0.2, 0.8, new Vector3(-15.5, 0.1, -15.5), groundMat);
  addBox('aShortSt2', 3, 0.2, 0.8, new Vector3(-15.5, 0.3, -16.3), groundMat);
  addBox('aShortSt3', 3, 0.2, 0.8, new Vector3(-15.5, 0.5, -17.1), groundMat);

  // --- B-Short: Mid (Z=-14) → B-Site (Z=-22), X = +13..+17 ---
  // Similar corridor but with a risky window peek into mid

  addBox('bShortWW', 0.7, 4, 8, new Vector3(13.5, 2, -18), plasterMat);
  addBox('bShortWE', 0.7, 4, 8, new Vector3(17.5, 2, -18), plasterMat);
  addBox('bShortRf', 4.7, 0.35, 8.5, new Vector3(15.5, 4.1, -18), tileRoofMat, false);
  // Window opening (visual break in west wall — no collision mesh, just gap)
  // The wall at X=13.5 has a 2m gap at Z=-17 to Z=-19 — but we already placed a full wall
  // We'll create the window by splitting the west wall into two segments:
  // Actually, the bShortWW was placed as one piece. Let's replace with two segments + gap:
  // (We override by placing a crate at the window position to create the peek spot)
  addBox('bShortPeek', 1.2, 1.0, 0.5, new Vector3(13.5, 0.5, -17), crateMat); // crouch cover at window

  // --- Mid-to-A Connector (X = -8..-14, Z = -14..-18) ---
  // Short open passage connecting Mid plaza to A-Short entrance
  // Walls channel the flow
  addBox('midToAWN', 6, 3.5, 0.7, new Vector3(-11, 1.75, -14.5), plasterMat);
  addBox('midToAWS', 0.7, 3.5, 3.5, new Vector3(-8.5, 1.75, -16), plasterMat);
  // Crate for corner cover
  addBox('midToACrate', 1.8, 1.3, 1.8, new Vector3(-10, 0.65, -16), crateMat);

  // --- Mid-to-B Connector (X = +8..+14, Z = -14..-18) ---
  // Short passage through merchant-style corridor
  addBox('midToBWN', 6, 3.5, 0.7, new Vector3(11, 1.75, -14.5), plasterMat);
  addBox('midToBWS', 0.7, 3.5, 3.5, new Vector3(8.5, 1.75, -16), plasterMat);
  addBox('midToBCrate', 1.8, 1.3, 1.8, new Vector3(10, 0.65, -16), crateMat);

  // --- Secret Passage / Roji (X = +38..+42, Z = -32..+32) ---
  // Long narrow covered alley running east edge. Uncontested B-Site flank.

  // Inner west wall (with gaps at Z = ±30 for entry/exit)
  addBox('secretWW1', 0.8, 3.5, 22, new Vector3(38, 1.75, -18), plasterMat);  // North segment (Z=-29..-7)
  addBox('secretWW2', 0.8, 3.5, 22, new Vector3(38, 1.75, 18), plasterMat);   // South segment (Z=7..29)
  // Gaps at Z ≈ -6..6 (mid-passage opening) and Z ≈ 29..31 (south entry), Z ≈ -29..-31 (north exit)

  // Pergola beams (visual rhythm, no collision)
  for (let i = 0; i < 7; i++) {
    const zP = -24 + i * 8;
    addBox(`secBeam${i}`, 5, 0.3, 0.3, new Vector3(40, 3.2, zP), timberMat, false);
    addBox(`secLant${i}`, 0.45, 0.6, 0.45, new Vector3(40, 2.65, zP), lanternGlowMat, false);
  }

  // Bamboo screen gates at entries
  createBambooFence('bambooSecS', new Vector3(40, 0, 31), 3, true);
  createBambooFence('bambooSecN', new Vector3(40, 0, -31), 3, true);

  // Midpoint crate (cover if encountered)
  addBox('secCrate', 2, 1.3, 2, new Vector3(40, 0.65, 0), crateMat);

  // --- Transition corridors: Spawn exits to lane entries ---

  // T1 (South) → A-Long entry (diagonal walk, channel via buildings)
  addBox('t1toAWall', 0.8, 4, 8, new Vector3(-14, 2, 34), plasterMat);  // Guide wall

  // T1 (South) → B-Short / Secret entry
  addBox('t1toBWall', 0.8, 4, 8, new Vector3(14, 2, 34), plasterMat);   // Guide wall

  // T2 (North) → A-Long entry
  addBox('t2toAWall', 0.8, 4, 8, new Vector3(-14, 2, -34), plasterMat);

  // T2 (North) → B-Short / Secret entry
  addBox('t2toBWall', 0.8, 4, 8, new Vector3(14, 2, -34), plasterMat);

  // --- Lane approach walls (channel from spawn area to lanes, Z = ±20..±34) ---
  // West corridor walls (A-Long approach from both spawns)
  addBox('appALongW1', 0.8, 4, 12, new Vector3(-18, 2, 28), plasterMat);
  addBox('appALongW2', 0.8, 4, 12, new Vector3(-18, 2, -28), plasterMat);

  // East corridor walls (B-Short approach from both spawns)
  addBox('appBShortE1', 0.8, 4, 12, new Vector3(18, 2, 28), plasterMat);
  addBox('appBShortE2', 0.8, 4, 12, new Vector3(18, 2, -28), plasterMat);

  // Mid approach corridor walls (funnel from spawn into mid)
  // South approach (T1 to Mid)
  addBox('midAppSWL', 0.8, 3.5, 12, new Vector3(-8, 1.75, 28), plasterMat);
  addBox('midAppSWR', 0.8, 3.5, 12, new Vector3(8, 1.75, 28), plasterMat);

  // North approach (T2 to Mid)
  addBox('midAppNWL', 0.8, 3.5, 12, new Vector3(-8, 1.75, -28), plasterMat);
  addBox('midAppNWR', 0.8, 3.5, 12, new Vector3(8, 1.75, -28), plasterMat);

  // ═══════════════════════════════════════════════════════════════════
  // 12. ZONE 9: SCENIC BACKGROUND — Sky Dome, Mt. Fuji, Mountains, Clouds
  // ═══════════════════════════════════════════════════════════════════

  // Daytime Japan Sky Dome (Pleasant balanced sky blue)
  const skyMat = new StandardMaterial('matSky', scene);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;
  skyMat.emissiveColor = new Color3(0.42, 0.65, 0.88);
  const skyDome = MeshBuilder.CreateSphere('skyDome', { diameter: 550, segments: 16 }, scene);
  skyDome.material = skyMat;
  skyDome.isPickable = false;
  skyDome.checkCollisions = false;

  // Mount Fuji (NW horizon)
  const fujiBaseMat = createMat('matFujiBase', new Color3(0.24, 0.30, 0.44), new Color3(0.04, 0.04, 0.04));
  const fujiBase = MeshBuilder.CreateCylinder('fujiBase', { height: 100, diameterBottom: 210, diameterTop: 28, tessellation: 32 }, scene);
  fujiBase.position = new Vector3(-120, 42, -175);
  fujiBase.material = fujiBaseMat;
  fujiBase.isPickable = false;
  fujiBase.checkCollisions = false;

  const fujiCapMat = createMat('matFujiCap', new Color3(0.95, 0.96, 0.98), new Color3(0.2, 0.2, 0.2));
  const fujiCap = MeshBuilder.CreateCylinder('fujiCap', { height: 35, diameterBottom: 72, diameterTop: 26, tessellation: 32 }, scene);
  fujiCap.position = new Vector3(-120, 78, -175);
  fujiCap.material = fujiCapMat;
  fujiCap.isPickable = false;
  fujiCap.checkCollisions = false;

  // Mountain ridges (Natural soft green-slate hills)
  const ridgeMat = createMat('matRidge', new Color3(0.18, 0.30, 0.24), new Color3(0.02, 0.02, 0.02));
  const ridges = [
    { x: 0, y: 18, z: -130, w: 240, h: 48, d: 30 },
    { x: 0, y: 16, z: 130, w: 240, h: 44, d: 30 },
    { x: -130, y: 18, z: 0, w: 30, h: 48, d: 240 },
    { x: 130, y: 17, z: 0, w: 30, h: 46, d: 240 }
  ];
  for (let r = 0; r < ridges.length; r++) {
    const rd = ridges[r];
    const ridge = MeshBuilder.CreateBox(`ridge${r}`, { width: rd.w, height: rd.h, depth: rd.d }, scene);
    ridge.position = new Vector3(rd.x, rd.y, rd.z);
    ridge.material = ridgeMat;
    ridge.isPickable = false;
    ridge.checkCollisions = false;
  }

  // Stylized clouds
  const cloudMat = createMat('matCloud', new Color3(0.97, 0.98, 1.0), new Color3(0.1, 0.1, 0.1), new Color3(0.42, 0.46, 0.52));
  const cloudPos = [
    new Vector3(-55, 56, -75),
    new Vector3(55, 62, -55),
    new Vector3(75, 52, 65),
    new Vector3(-70, 58, 60),
    new Vector3(0, 68, -30),
    new Vector3(-30, 54, 40)
  ];
  for (let c = 0; c < cloudPos.length; c++) {
    const cloud = MeshBuilder.CreateSphere(`cloud${c}`, { diameterX: 36, diameterY: 11, diameterZ: 20, segments: 8 }, scene);
    cloud.position = cloudPos[c];
    cloud.material = cloudMat;
    cloud.isPickable = false;
    cloud.checkCollisions = false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 13. ZONE 10: LIGHTING
  // ═══════════════════════════════════════════════════════════════════

  // Hemispheric sky fill (soft ambient without blowing out diffuse colors)
  const hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemiLight.diffuse = new Color3(0.85, 0.90, 0.95);
  hemiLight.groundColor = new Color3(0.50, 0.52, 0.50);
  hemiLight.intensity = 0.85;

  // Primary warm sunlight (high southwest directional light)
  const sunLight = new DirectionalLight('sun', new Vector3(0.45, -1, 0.45), scene);
  sunLight.position = new Vector3(-35, 55, -35);
  sunLight.diffuse = new Color3(0.95, 0.92, 0.85);
  sunLight.specular = new Color3(0.25, 0.25, 0.25);
  sunLight.intensity = 0.85;

  // Cool sky fill (gentle bounce from opposite side)
  const fillLight = new DirectionalLight('fill', new Vector3(-0.45, -0.85, -0.45), scene);
  fillLight.position = new Vector3(35, 45, 35);
  fillLight.diffuse = new Color3(0.70, 0.75, 0.85);
  fillLight.intensity = 0.45;

  // Tactical focal point lights (warm, subtle atmospheric glow)
  const focalLights = [
    new Vector3(-27, 3.0, -29),   // A-Site Tea House Courtyard
    new Vector3(27, 3.0, -29),    // B-Site Temple Gate
    new Vector3(0, 3.0, 0),       // Mid Torii center
    new Vector3(40, 3.0, 0)       // Secret Passage midpoint
  ];
  for (let fl = 0; fl < focalLights.length; fl++) {
    const pl = new PointLight(`focal${fl}`, focalLights[fl], scene);
    pl.diffuse = new Color3(1.0, 0.88, 0.68);
    pl.specular = new Color3(0.15, 0.12, 0.08);
    pl.intensity = 0.7;
    pl.range = 22;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 14. ZONE 11: SPAWN POINTS (12 Total — 6 per team)
  // ═══════════════════════════════════════════════════════════════════

  const spawnPoints: BabylonSpawnPoint[] = [
    // --- Team 1: South Base (Cherry Blossom Plaza) ---
    { position: new Vector3(-4, 1.0, 46), yaw: 0 },
    { position: new Vector3(4, 1.0, 46), yaw: 0 },
    { position: new Vector3(-10, 1.0, 44), yaw: 0 },
    { position: new Vector3(10, 1.0, 44), yaw: 0 },
    { position: new Vector3(-2, 1.0, 43), yaw: 0 },
    { position: new Vector3(2, 1.0, 43), yaw: 0 },

    // --- Team 2: North Base (Bamboo Garden) ---
    { position: new Vector3(-4, 1.0, -46), yaw: Math.PI },
    { position: new Vector3(4, 1.0, -46), yaw: Math.PI },
    { position: new Vector3(-10, 1.0, -44), yaw: Math.PI },
    { position: new Vector3(10, 1.0, -44), yaw: Math.PI },
    { position: new Vector3(-2, 1.0, -43), yaw: Math.PI },
    { position: new Vector3(2, 1.0, -43), yaw: Math.PI },
  ];

  return { spawnPoints, colliders };
}

// Backwards-compatible alias for existing imports
export const createCyberShrineMap = createKyotoMap;

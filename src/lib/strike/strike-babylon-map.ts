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
 * Builds the competitive tactical FPS map "Kyoto" in Babylon.js (104m x 104m).
 * Inspired by classic tactical shooters (Counter-Strike, Valorant) and historic Kyoto architecture:
 * - A-Site: Multi-level Cyber Shrine complex with sacred altar & catwalk
 * - B-Site: Traditional 3-tiered Zen Pagoda & open tea garden
 * - Mid Courtyard: Central Torii Avenue, cherry blossom plaza, waist-high cover & sniper overlook
 * - A-Long: Western cobblestone street flanked by traditional 2-story Kyoto Machiya townhouses
 * - A-Short: Tight connector stairwell linking Mid to A-Site
 * - Secret / Underpass: Narrow covered traditional alleyway (Roji) flanking directly to B-Site
 * - North & South Spawns: Balanced base deployment plazas with cover
 * - Scenic Background: Iconic Mount Fuji with snow cap, daytime azure skybox, and rolling hills
 */
export function createKyotoMap(scene: Scene): BabylonMapData {
  const colliders: AbstractMesh[] = [];

  // ==================== 1. MATERIALS PALETTE ====================
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

  // Street & Courtyard Stone Pavement
  const groundMat = createMat('matStreetStone', new Color3(0.42, 0.44, 0.47), new Color3(0.08, 0.08, 0.08));

  // Raked Zen Sand & Gravel (B-Site Pagoda Garden)
  const zenSandMat = createMat('matZenSand', new Color3(0.78, 0.77, 0.73), new Color3(0.04, 0.04, 0.04));

  // Traditional Polished Cedar Planks (Verandas, decks, shrine interior)
  const woodDeckMat = createMat('matWoodDeck', new Color3(0.38, 0.24, 0.15), new Color3(0.06, 0.06, 0.06));

  // Perimeter Boundary Stone Walls
  const wallMat = createMat('matWall', new Color3(0.26, 0.29, 0.35), new Color3(0.08, 0.08, 0.08));

  // Traditional Kyoto Machiya Dark Timber Beams & Pillars
  const timberMat = createMat('matTimber', new Color3(0.24, 0.16, 0.10), new Color3(0.04, 0.04, 0.04));

  // Traditional Kyoto Earthen Plaster / Stucco Walls
  const plasterMat = createMat('matPlaster', new Color3(0.86, 0.84, 0.79), new Color3(0.03, 0.03, 0.03));

  // Traditional Charcoal Kawara Clay Roof Tiles
  const tileRoofMat = createMat('matTileRoof', new Color3(0.18, 0.20, 0.24), new Color3(0.12, 0.12, 0.12));

  // Translucent Rice Paper Shoji Screens (Subtle warm interior glow)
  const shojiMat = createMat('matShoji', new Color3(0.92, 0.89, 0.82), new Color3(0.02, 0.02, 0.02), new Color3(0.12, 0.11, 0.08));

  // Cyber Shrine Vermilion Red Wood
  const shrineRedMat = createMat('matShrineRed', new Color3(0.85, 0.20, 0.18), new Color3(0.16, 0.16, 0.16));

  // Shrine Gold Accents & Sacred Altar
  const goldMat = createMat('matGold', new Color3(0.95, 0.78, 0.25), new Color3(0.22, 0.22, 0.22), new Color3(0.15, 0.10, 0.02));

  // Wooden Supply Crates (Warm pine)
  const crateMat = createMat('matCrate', new Color3(0.68, 0.40, 0.18), new Color3(0.08, 0.08, 0.08));

  // Stone Lanterns & Tactical Waist Barriers
  const stoneMat = createMat('matStone', new Color3(0.48, 0.52, 0.56), new Color3(0.08, 0.08, 0.08));

  // Glowing Lantern Paper (Warm, welcoming golden glow)
  const lanternGlowMat = createMat('matLanternGlow', new Color3(1.0, 0.88, 0.55), new Color3(0, 0, 0), new Color3(1.0, 0.82, 0.42));

  // Sakura Tree Foliage (Vibrant anime pink)
  const sakuraMat = createMat('matSakura', new Color3(1.0, 0.56, 0.75), new Color3(0.08, 0.08, 0.08), new Color3(0.22, 0.08, 0.14));

  // Tree Bark Wood
  const barkMat = createMat('matBark', new Color3(0.32, 0.20, 0.14), new Color3(0.04, 0.04, 0.04));

  // Bamboo Stalks & Fences (Natural bamboo green-gold)
  const bambooMat = createMat('matBamboo', new Color3(0.52, 0.62, 0.28), new Color3(0.08, 0.08, 0.08));

  // Subtle Cyber Neon Trims
  const neonPinkMat = createMat('matNeonPink', new Color3(1.0, 0.40, 0.70), new Color3(0.2, 0.2, 0.2), new Color3(1.0, 0.40, 0.70));
  const neonCyanMat = createMat('matNeonCyan', new Color3(0.0, 0.90, 0.88), new Color3(0.2, 0.2, 0.2), new Color3(0.0, 0.90, 0.88));

  // Box helper with automatic collision registration
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

  // ==================== 2. ARENA GROUND & PERIMETER WALLS (104x104m) ====================
  // Main Street Cobblestone Ground (104m x 104m)
  const ground = MeshBuilder.CreateGround('mainGround', { width: 104, height: 104, subdivisions: 4 }, scene);
  ground.position = new Vector3(0, 0, 0);
  ground.material = groundMat;
  ground.checkCollisions = true;
  colliders.push(ground);

  // Zen Garden Gravel Zone in East Courtyard / B-Site (34m x 32m)
  const zenGround = MeshBuilder.CreateGround('zenGround', { width: 34, height: 32, subdivisions: 2 }, scene);
  zenGround.position = new Vector3(28, 0.02, -18);
  zenGround.material = zenSandMat;
  zenGround.checkCollisions = false;

  // Perimeter Boundary Walls (Height = 7.5m)
  // North Wall (Z = -52)
  addBox('wallNorth', 104, 7.5, 1.4, new Vector3(0, 3.75, -52), wallMat);
  // South Wall (Z = 52)
  addBox('wallSouth', 104, 7.5, 1.4, new Vector3(0, 3.75, 52), wallMat);
  // West Wall (X = -52)
  addBox('wallWest', 1.4, 7.5, 104, new Vector3(-52, 3.75, 0), wallMat);
  // East Wall (X = 52)
  addBox('wallEast', 1.4, 7.5, 104, new Vector3(52, 3.75, 0), wallMat);

  // Decorative Wall Coping Roofs (Traditional Japanese perimeter wall tile ridge)
  addBox('wallCopingN', 104, 0.45, 2.0, new Vector3(0, 7.6, -52), tileRoofMat, false);
  addBox('wallCopingS', 104, 0.45, 2.0, new Vector3(0, 7.6, 52), tileRoofMat, false);
  addBox('wallCopingW', 2.0, 0.45, 104, new Vector3(-52, 7.6, 0), tileRoofMat, false);
  addBox('wallCopingE', 2.0, 0.45, 104, new Vector3(52, 7.6, 0), tileRoofMat, false);

  // Cyber Neon Edge Trims
  addBox('neonNorth', 104, 0.16, 0.16, new Vector3(0, 7.25, -51.2), neonPinkMat, false);
  addBox('neonSouth', 104, 0.16, 0.16, new Vector3(0, 7.25, 51.2), neonCyanMat, false);
  addBox('neonWest', 0.16, 0.16, 104, new Vector3(-51.2, 7.25, 0), neonCyanMat, false);
  addBox('neonEast', 0.16, 0.16, 104, new Vector3(51.2, 7.25, 0), neonPinkMat, false);

  // ==================== 3. TRADITIONAL KYOTO MACHIYA HOUSES ====================
  /**
   * Builds an authentic Kyoto Machiya (wooden townhouse) with earthen plaster walls,
   * exposed dark timber corner columns, overhanging kawara tile gabled roof,
   * lattice shoji screens, and optional front veranda.
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
      overhangRoof?: boolean;
    } = {}
  ) {
    const { hasVeranda = false, verandaSide = 'south', hasShoji = true, overhangRoof = true } = options;

    // 1. Plaster Main Body
    addBox(`${prefix}_Body`, w, h, d, new Vector3(pos.x, pos.y + h / 2, pos.z), plasterMat);

    // 2. Corner Timber Columns
    const postW = 0.55;
    const halfW = w / 2 - postW / 2;
    const halfD = d / 2 - postW / 2;
    addBox(`${prefix}_PostFL`, postW, h, postW, new Vector3(pos.x - halfW, pos.y + h / 2, pos.z + halfD), timberMat);
    addBox(`${prefix}_PostFR`, postW, h, postW, new Vector3(pos.x + halfW, pos.y + h / 2, pos.z + halfD), timberMat);
    addBox(`${prefix}_PostBL`, postW, h, postW, new Vector3(pos.x - halfW, pos.y + h / 2, pos.z - halfD), timberMat);
    addBox(`${prefix}_PostBR`, postW, h, postW, new Vector3(pos.x + halfW, pos.y + h / 2, pos.z - halfD), timberMat);

    // Mid-level horizontal timber band separating 1st and 2nd floors
    addBox(`${prefix}_BeamMidF`, w + 0.1, 0.35, 0.4, new Vector3(pos.x, pos.y + h * 0.52, pos.z + halfD), timberMat);
    addBox(`${prefix}_BeamMidB`, w + 0.1, 0.35, 0.4, new Vector3(pos.x, pos.y + h * 0.52, pos.z - halfD), timberMat);

    // 3. Shoji Lattice Panels (Ground & Upper Windows)
    if (hasShoji) {
      // Front lower shoji window
      addBox(`${prefix}_ShojiF1`, Math.min(w * 0.6, 5.0), h * 0.32, 0.15, new Vector3(pos.x, pos.y + h * 0.25, pos.z + halfD + 0.15), shojiMat, false);
      // Front upper shoji window
      addBox(`${prefix}_ShojiF2`, Math.min(w * 0.5, 4.0), h * 0.24, 0.15, new Vector3(pos.x, pos.y + h * 0.75, pos.z + halfD + 0.15), shojiMat, false);
    }

    // 4. Traditional Kawara Clay Tiled Gabled Roof
    if (overhangRoof) {
      const roofOverhang = 1.4;
      const roofW = w + roofOverhang * 2;
      const roofD = d + roofOverhang * 2;
      // Lower Eaves Tier
      addBox(`${prefix}_RoofEaves`, roofW, 0.55, roofD, new Vector3(pos.x, pos.y + h + 0.25, pos.z), tileRoofMat);
      // Gabled Roof Ridge Top
      addBox(`${prefix}_RoofRidge`, roofW * 0.7, 0.75, roofD * 0.7, new Vector3(pos.x, pos.y + h + 0.8, pos.z), tileRoofMat);
      // Ridge Beam Cap
      addBox(`${prefix}_RoofCap`, roofW * 0.45, 0.4, roofD * 0.45, new Vector3(pos.x, pos.y + h + 1.25, pos.z), timberMat);
    }

    // 5. Traditional Raised Wooden Veranda (Engawa)
    if (hasVeranda) {
      const deckH = 0.5;
      if (verandaSide === 'south') {
        addBox(`${prefix}_Veranda`, w, deckH, 1.8, new Vector3(pos.x, pos.y + deckH / 2, pos.z + d / 2 + 0.9), woodDeckMat);
      } else if (verandaSide === 'north') {
        addBox(`${prefix}_Veranda`, w, deckH, 1.8, new Vector3(pos.x, pos.y + deckH / 2, pos.z - d / 2 - 0.9), woodDeckMat);
      } else if (verandaSide === 'east') {
        addBox(`${prefix}_Veranda`, 1.8, deckH, d, new Vector3(pos.x + w / 2 + 0.9, pos.y + deckH / 2, pos.z), woodDeckMat);
      } else if (verandaSide === 'west') {
        addBox(`${prefix}_Veranda`, 1.8, deckH, d, new Vector3(pos.x - w / 2 - 0.9, pos.y + deckH / 2, pos.z), woodDeckMat);
      }
    }
  }

  // --- A-LONG HOUSES (West Avenue Street Front) ---
  // North Machiya along A-Long
  createMachiyaHouse('machiyaLong_N', new Vector3(-43, 0, -26), 9.0, 6.2, 14.0, { hasVeranda: true, verandaSide: 'east' });
  // Central Machiya along A-Long (With street corner)
  createMachiyaHouse('machiyaLong_Mid', new Vector3(-43, 0, 0), 9.0, 6.5, 16.0, { hasVeranda: true, verandaSide: 'east' });
  // South Machiya along A-Long
  createMachiyaHouse('machiyaLong_S', new Vector3(-43, 0, 26), 9.0, 6.2, 14.0, { hasVeranda: true, verandaSide: 'east' });

  // Divider Wall & Buildings separating A-Long from Mid Courtyard
  addBox('wallLongMid_N', 1.0, 4.5, 14.0, new Vector3(-31, 2.25, -20), wallMat);
  addBox('wallLongMid_S', 1.0, 4.5, 18.0, new Vector3(-31, 2.25, 20), wallMat);
  // Machiya Corner Shop between A-Long & Mid
  createMachiyaHouse('machiyaMidConnector', new Vector3(-31, 0, 0), 7.0, 5.8, 8.0, { hasShoji: true });

  // --- A-SHORT / CONNECTOR MACHIYA ---
  createMachiyaHouse('machiyaAShort', new Vector3(-16, 0, -12), 8.0, 5.5, 8.0, { hasVeranda: true, verandaSide: 'south' });

  // --- MID NORTH TEA HOUSE (Overlooking Mid Courtyard) ---
  createMachiyaHouse('machiyaMidNorth', new Vector3(0, 0, -22), 16.0, 6.8, 9.0, { hasVeranda: true, verandaSide: 'south' });
  // Sniper window platform / balcony in front of Mid North Machiya
  addBox('midNorthBalcony', 8.0, 0.4, 2.2, new Vector3(0, 3.4, -16.4), woodDeckMat);
  addBox('midNorthRailing', 8.0, 1.1, 0.25, new Vector3(0, 4.15, -15.4), timberMat);

  // --- SOUTH BASE / DEFENDER PLAZA MACHIYAS ---
  createMachiyaHouse('machiyaSouthW', new Vector3(-20, 0, 42), 12.0, 6.0, 9.0, { hasVeranda: true, verandaSide: 'north' });
  createMachiyaHouse('machiyaSouthE', new Vector3(20, 0, 42), 12.0, 6.0, 9.0, { hasVeranda: true, verandaSide: 'north' });

  // --- SECRET ALLEY / UNDERPASS MACHIYAS (East Flank) ---
  createMachiyaHouse('machiyaSecret_Mid', new Vector3(43, 0, 14), 8.5, 6.2, 18.0, { hasShoji: true });
  createMachiyaHouse('machiyaSecret_North', new Vector3(43, 0, -12), 8.5, 6.2, 14.0, { hasShoji: true });

  // Divider Wall between Mid Courtyard and Secret Alley
  addBox('wallSecretMid_S', 1.0, 4.5, 20.0, new Vector3(32, 2.25, 24), wallMat);
  addBox('wallSecretMid_N', 1.0, 4.5, 12.0, new Vector3(32, 2.25, 0), wallMat);

  // ==================== 4. A-SITE: CYBER SHRINE COMPLEX (North-West) ====================
  // Raised Stone Sacred Platform (22m x 18m, height 1.4m)
  addBox('shrinePlatform', 22, 1.4, 18, new Vector3(-28, 0.7, -34), groundMat);

  // Front Stone Steps leading up to Shrine
  addBox('shrineStep1', 12, 0.45, 2.2, new Vector3(-28, 0.22, -24.0), groundMat);
  addBox('shrineStep2', 12, 0.45, 2.2, new Vector3(-28, 0.67, -25.5), groundMat);
  addBox('shrineStep3', 12, 0.45, 2.2, new Vector3(-28, 1.12, -27.0), groundMat);

  // Shrine Pavilion Rear Wall
  addBox('shrineBackWall', 18, 5.8, 1.2, new Vector3(-28, 4.1, -41.5), wallMat);

  // Shrine Golden Pillars
  addBox('shrinePillarFL', 0.9, 5.4, 0.9, new Vector3(-36.5, 3.9, -27.5), goldMat);
  addBox('shrinePillarFR', 0.9, 5.4, 0.9, new Vector3(-19.5, 3.9, -27.5), goldMat);
  addBox('shrinePillarBL', 0.9, 5.4, 0.9, new Vector3(-36.5, 3.9, -40.5), goldMat);
  addBox('shrinePillarBR', 0.9, 5.4, 0.9, new Vector3(-19.5, 3.9, -40.5), goldMat);

  // Shrine Vermilion Red Gabled Overhang Roof
  addBox('shrineRoof', 24, 0.85, 20, new Vector3(-28, 6.9, -34), shrineRedMat);
  addBox('shrineRoofPeak', 16, 0.75, 14, new Vector3(-28, 7.6, -34), tileRoofMat);

  // Central Sacred Altar (Primary Bomb Plant / Tactical Centerpiece)
  addBox('shrineAltar', 4.5, 1.4, 2.8, new Vector3(-28, 2.1, -34), goldMat);

  // A-Site Catwalk & Railing on Western flank
  addBox('aCatwalkFloor', 4.0, 0.45, 18.0, new Vector3(-40, 3.4, -34), woodDeckMat);
  addBox('aCatwalkRailing', 0.3, 1.1, 18.0, new Vector3(-37.9, 4.15, -34), timberMat);

  // ==================== 5. B-SITE: ZEN PAGODA & TEA GARDEN (East) ====================
  // Traditional 3-Tiered Kyoto Pagoda Tower (Center at X = 28, Z = -28)
  const pagPos = new Vector3(28, 0, -28);

  // Pagoda Stone Base
  addBox('pagodaStoneBase', 10, 1.2, 10, new Vector3(pagPos.x, 0.6, pagPos.z), stoneMat);

  // Tier 1 (Ground Story)
  addBox('pagodaTier1_Body', 8.0, 3.4, 8.0, new Vector3(pagPos.x, 2.9, pagPos.z), timberMat);
  addBox('pagodaTier1_Shoji', 5.5, 2.2, 8.2, new Vector3(pagPos.x, 2.8, pagPos.z), shojiMat, false);
  addBox('pagodaTier1_Roof', 11.5, 0.6, 11.5, new Vector3(pagPos.x, 4.8, pagPos.z), tileRoofMat);

  // Tier 2 (Middle Story)
  addBox('pagodaTier2_Body', 6.2, 2.8, 6.2, new Vector3(pagPos.x, 6.4, pagPos.z), timberMat);
  addBox('pagodaTier2_Roof', 9.2, 0.55, 9.2, new Vector3(pagPos.x, 8.0, pagPos.z), tileRoofMat);

  // Tier 3 (Top Story)
  addBox('pagodaTier3_Body', 4.6, 2.4, 4.6, new Vector3(pagPos.x, 9.4, pagPos.z), timberMat);
  addBox('pagodaTier3_Roof', 7.4, 0.7, 7.4, new Vector3(pagPos.x, 10.8, pagPos.z), tileRoofMat);

  // Pagoda Bronze Finial / Spire (Sorin)
  const spire = MeshBuilder.CreateCylinder('pagodaSpire', { height: 3.8, diameter: 0.38 }, scene);
  spire.position = new Vector3(pagPos.x, 12.8, pagPos.z);
  spire.material = goldMat;
  spire.isPickable = false;
  spire.checkCollisions = false;

  // B-Site Tea House Pavilion (Open veranda tactical spot, X = 18, Z = -10)
  addBox('teaHouseFloor', 10, 0.8, 9, new Vector3(18, 0.4, -10), woodDeckMat);
  addBox('teaHouseRoof', 12, 0.6, 11, new Vector3(18, 4.8, -10), tileRoofMat);
  addBox('teaPillar1', 0.6, 4.0, 0.6, new Vector3(13.6, 2.4, -6.0), timberMat);
  addBox('teaPillar2', 0.6, 4.0, 0.6, new Vector3(22.4, 2.4, -6.0), timberMat);
  addBox('teaPillar3', 0.6, 4.0, 0.6, new Vector3(13.6, 2.4, -14.0), timberMat);
  addBox('teaPillar4', 0.6, 4.0, 0.6, new Vector3(22.4, 2.4, -14.0), timberMat);
  addBox('teaBench', 4.5, 1.1, 1.4, new Vector3(18, 1.35, -10), stoneMat);

  // B-Site Zen Stone Garden Barricades (Raked sand rock formations)
  addBox('zenRock1', 3.4, 1.4, 2.4, new Vector3(32, 0.7, -14), stoneMat);
  addBox('zenRock2', 2.6, 1.2, 2.0, new Vector3(23, 0.6, -20), stoneMat);

  // ==================== 6. TORII GATES (Grand Entrance & Mid Avenue) ====================
  function createTorii(prefix: string, pos: Vector3, scale = 1.0) {
    const pW = 0.85 * scale;
    const pH = 7.2 * scale;
    const span = 4.8 * scale;
    addBox(`${prefix}_PillarL`, pW, pH, pW, new Vector3(pos.x - span, pos.y + pH / 2, pos.z), shrineRedMat);
    addBox(`${prefix}_PillarR`, pW, pH, pW, new Vector3(pos.x + span, pos.y + pH / 2, pos.z), shrineRedMat);
    addBox(`${prefix}_BeamTop`, span * 2 + 3.4, 0.9 * scale, 1.2 * scale, new Vector3(pos.x, pos.y + pH - 0.2, pos.z), shrineRedMat);
    addBox(`${prefix}_BeamSub`, span * 2 + 1.8, 0.45 * scale, 0.8 * scale, new Vector3(pos.x, pos.y + pH - 1.4, pos.z), shrineRedMat);
    addBox(`${prefix}_Plaque`, 0.9 * scale, 1.2 * scale, 0.3 * scale, new Vector3(pos.x, pos.y + pH - 0.8, pos.z), goldMat, false);
  }

  // South Entrance Grand Torii
  createTorii('toriiSouth', new Vector3(0, 0, 32), 1.15);
  // Mid Courtyard Central Torii
  createTorii('toriiMid', new Vector3(0, 0, 2), 1.0);
  // North Shrine Approach Torii
  createTorii('toriiNorth', new Vector3(-28, 0, -18), 1.05);

  // ==================== 7. CHERRY BLOSSOM TREES (Sakura) ====================
  function createSakuraTree(name: string, pos: Vector3) {
    // Stone Planter Base
    addBox(`${name}_Planter`, 3.2, 0.7, 3.2, new Vector3(pos.x, 0.35, pos.z), stoneMat);

    // Trunk
    const trunk = MeshBuilder.CreateCylinder(`${name}_Trunk`, { height: 4.0, diameter: 0.6 }, scene);
    trunk.position = new Vector3(pos.x, 2.35, pos.z);
    trunk.material = barkMat;
    trunk.checkCollisions = true;
    colliders.push(trunk);

    // Blossom Foliage Canopy
    const blossom1 = MeshBuilder.CreateSphere(`${name}_Blossom1`, { diameter: 4.6, segments: 8 }, scene);
    blossom1.position = new Vector3(pos.x, 4.6, pos.z);
    blossom1.material = sakuraMat;

    const blossom2 = MeshBuilder.CreateSphere(`${name}_Blossom2`, { diameter: 3.6, segments: 8 }, scene);
    blossom2.position = new Vector3(pos.x + 0.9, 5.3, pos.z + 0.7);
    blossom2.material = sakuraMat;
  }

  createSakuraTree('sakuraMidCenter', new Vector3(0, 0, 14));
  createSakuraTree('sakuraSouthPlazaL', new Vector3(-10, 0, 36));
  createSakuraTree('sakuraSouthPlazaR', new Vector3(10, 0, 36));
  createSakuraTree('sakuraLongStreet', new Vector3(-43, 0, -12));
  createSakuraTree('sakuraPagodaGarden', new Vector3(36, 0, -28));

  // ==================== 8. BAMBOO PALISADES & SCREENS ====================
  function createBambooFence(prefix: string, pos: Vector3, length: number, isAlongZ = true) {
    const w = isAlongZ ? 0.35 : length;
    const d = isAlongZ ? length : 0.35;
    addBox(`${prefix}_Fence`, w, 2.6, d, new Vector3(pos.x, 1.3, pos.z), bambooMat);
  }

  // Secret Alley Bamboo Screens
  createBambooFence('bambooSecret1', new Vector3(36, 0, 10), 14, true);
  createBambooFence('bambooSecret2', new Vector3(36, 0, -2), 8, true);

  // Pagoda Garden Bamboo Privacy Fence
  createBambooFence('bambooPagodaGarden', new Vector3(14, 0, -28), 16, true);

  // ==================== 9. TACTICAL COVER: CRATES, BARRIERS & ALCOVES ====================
  // Helper to place standard CS-style tactical crate stacks (single or 2-high)
  function createCrateCluster(prefix: string, pos: Vector3, hasStack = true) {
    addBox(`${prefix}_1`, 2.4, 1.8, 2.4, new Vector3(pos.x, 0.9, pos.z), crateMat);
    addBox(`${prefix}_2`, 2.0, 1.8, 2.0, new Vector3(pos.x + 1.8, 0.9, pos.z - 0.4), crateMat);
    if (hasStack) {
      addBox(`${prefix}_Top`, 1.8, 1.4, 1.8, new Vector3(pos.x + 0.8, 2.5, pos.z - 0.2), crateMat);
    }
  }

  // Mid Courtyard Crate Covers
  createCrateCluster('cratesMidA', new Vector3(-4, 0, -4), true);
  createCrateCluster('cratesMidB', new Vector3(5, 0, 8), true);

  // Mid Waist-High Stone Divider Walls
  addBox('midStoneWallL', 6.0, 1.25, 0.85, new Vector3(-8, 0.62, 4), stoneMat);
  addBox('midStoneWallR', 6.0, 1.25, 0.85, new Vector3(8, 0.62, -6), stoneMat);

  // A-Long Street Tactical Crates & Cover Barriers
  createCrateCluster('cratesLongSouth', new Vector3(-38, 0, 14), true);
  createCrateCluster('cratesLongNorth', new Vector3(-38, 0, -18), true);
  addBox('barrierLongMid', 5.5, 1.3, 0.85, new Vector3(-38, 0.65, 0), stoneMat);

  // A-Site Defense Crates (Behind altar & on flank)
  createCrateCluster('cratesASiteFlank', new Vector3(-20, 0, -32), false);
  addBox('crateASiteBack', 2.4, 1.8, 2.4, new Vector3(-36, 0.9, -38), crateMat);

  // B-Site Tea House & Pagoda Crates
  createCrateCluster('cratesPagodaEntrance', new Vector3(20, 0, 2), true);
  createCrateCluster('cratesSecretFlank', new Vector3(40, 0, 26), false);

  // Secret Alley Covered Timber Pergola Beams
  for (let s = 0; s < 4; s++) {
    const zBeam = 6 + s * 8;
    addBox(`secretBeam_${s}`, 8.0, 0.35, 0.35, new Vector3(40, 3.6, zBeam), timberMat, false);
    // Hanging glowing paper lantern on each pergola beam
    addBox(`hangingLantern_${s}`, 0.5, 0.7, 0.5, new Vector3(40, 3.0, zBeam), lanternGlowMat, false);
  }

  // ==================== 10. STONE LANTERNS (Atmospheric Illumination) ====================
  const lanternPositions: Vector3[] = [
    // South Plaza
    new Vector3(-6, 0.9, 28),
    new Vector3(6, 0.9, 28),
    new Vector3(-18, 0.9, 36),
    new Vector3(18, 0.9, 36),
    // Mid Avenue
    new Vector3(-6, 0.9, 2),
    new Vector3(6, 0.9, 2),
    new Vector3(-6, 0.9, -12),
    new Vector3(6, 0.9, -12),
    // A-Site Shrine Approach
    new Vector3(-22, 0.9, -22),
    new Vector3(-34, 0.9, -22),
    // B-Site Pagoda Approach
    new Vector3(22, 0.9, -22),
    new Vector3(34, 0.9, -22),
    // A-Long Street
    new Vector3(-37, 0.9, 24),
    new Vector3(-37, 0.9, -28),
    // Secret Alley
    new Vector3(39, 0.9, 0),
    new Vector3(39, 0.9, 34)
  ];

  for (let i = 0; i < lanternPositions.length; i++) {
    const pos = lanternPositions[i];
    addBox(`lanternBase_${i}`, 0.75, 1.8, 0.75, pos, stoneMat);
    addBox(`lanternGlow_${i}`, 0.55, 0.55, 0.55, new Vector3(pos.x, pos.y + 0.75, pos.z), lanternGlowMat, false);
  }

  // ==================== 11. SCENIC BACKGROUND: MOUNT FUJI, SKY DOME & MOUNTAINS ====================
  // 11A. Daytime Japan Sky Dome (Sunny Azure Blue `#7bb8f5`)
  const skyMat = new StandardMaterial('matJapanSky', scene);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;
  skyMat.emissiveColor = new Color3(0.53, 0.77, 0.98);
  const skyDome = MeshBuilder.CreateSphere('japanSkyDome', { diameter: 550, segments: 16 }, scene);
  skyDome.material = skyMat;
  skyDome.isPickable = false;
  skyDome.checkCollisions = false;

  // 11B. Distant Mount Fuji on the North-West Horizon
  // Fuji Volcanic Indigo Base
  const fujiBaseMat = createMat('matFujiBase', new Color3(0.24, 0.30, 0.44), new Color3(0.04, 0.04, 0.04));
  const fujiBase = MeshBuilder.CreateCylinder('mtFujiBase', { height: 100, diameterBottom: 210, diameterTop: 28, tessellation: 32 }, scene);
  fujiBase.position = new Vector3(-105, 45, -160);
  fujiBase.material = fujiBaseMat;
  fujiBase.isPickable = false;
  fujiBase.checkCollisions = false;

  // Fuji Pure White Snow Cap
  const fujiCapMat = createMat('matFujiCap', new Color3(0.98, 0.99, 1.0), new Color3(0.3, 0.3, 0.3), new Color3(0.35, 0.38, 0.42));
  const fujiCap = MeshBuilder.CreateCylinder('mtFujiCap', { height: 35, diameterBottom: 72, diameterTop: 26, tessellation: 32 }, scene);
  fujiCap.position = new Vector3(-105, 80, -160);
  fujiCap.material = fujiCapMat;
  fujiCap.isPickable = false;
  fujiCap.checkCollisions = false;

  // 11C. Surrounding Mountain Ridges (Higashiyama & Arashiyama rolling green hills)
  const mountainMat = createMat('matDistantRidge', new Color3(0.22, 0.35, 0.28), new Color3(0.03, 0.03, 0.03));
  const ridgePositions = [
    { x: 0, y: 18, z: -125, w: 230, h: 48, d: 30 },   // North Ridge
    { x: 0, y: 16, z: 125, w: 230, h: 44, d: 30 },    // South Ridge
    { x: -125, y: 18, z: 0, w: 30, h: 48, d: 230 },   // West Ridge
    { x: 125, y: 17, z: 0, w: 30, h: 46, d: 230 }     // East Ridge
  ];
  for (let r = 0; r < ridgePositions.length; r++) {
    const rd = ridgePositions[r];
    const ridge = MeshBuilder.CreateBox(`distantRidge_${r}`, { width: rd.w, height: rd.h, depth: rd.d }, scene);
    ridge.position = new Vector3(rd.x, rd.y, rd.z);
    ridge.material = mountainMat;
    ridge.isPickable = false;
    ridge.checkCollisions = false;
  }

  // 11D. Stylized Low-Poly Anime Clouds
  const cloudMat = createMat('matCloud', new Color3(0.97, 0.98, 1.0), new Color3(0.1, 0.1, 0.1), new Color3(0.42, 0.46, 0.52));
  const cloudLocs = [
    new Vector3(-50, 56, -70),
    new Vector3(50, 62, -50),
    new Vector3(70, 52, 60),
    new Vector3(-65, 58, 55),
    new Vector3(0, 68, -25)
  ];
  for (let c = 0; c < cloudLocs.length; c++) {
    const cl = cloudLocs[c];
    const cloud = MeshBuilder.CreateSphere(`cloud_${c}`, { diameterX: 38, diameterY: 12, diameterZ: 22, segments: 8 }, scene);
    cloud.position = cl;
    cloud.material = cloudMat;
    cloud.isPickable = false;
    cloud.checkCollisions = false;
  }

  // ==================== 12. TACTICAL FOCAL POINT LIGHTS ====================
  const keyLightPositions = [
    new Vector3(-28, 3.2, -34),  // A-Site Shrine Altar
    new Vector3(28, 3.2, -28),   // B-Site Pagoda Garden
    new Vector3(0, 3.0, 2),      // Mid Torii Center
    new Vector3(-43, 3.0, 0),    // A-Long Street Midpoint
    new Vector3(40, 3.2, 14),    // Secret Alley Pergola
    new Vector3(0, 3.0, 36)      // South Spawn Plaza
  ];

  for (let j = 0; j < keyLightPositions.length; j++) {
    const kPos = keyLightPositions[j];
    const pLight = new PointLight(`tacticalLight_${j}`, kPos, scene);
    pLight.diffuse = new Color3(1.0, 0.88, 0.68);
    pLight.specular = new Color3(0.4, 0.35, 0.2);
    pLight.intensity = 2.0;
    pLight.range = 30;
  }

  // ==================== 13. SUNLIGHT & AMBIENT DAYTIME LIGHTING ====================
  // Hemispheric Light - Sky and ground fill
  const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
  hemiLight.diffuse = new Color3(1.35, 1.40, 1.50);
  hemiLight.groundColor = new Color3(0.85, 0.88, 0.82);
  hemiLight.intensity = 1.95;

  // Primary warm sunlight from high southwest
  const sunLight = new DirectionalLight('sunLight', new Vector3(0.45, -1, 0.45), scene);
  sunLight.position = new Vector3(-35, 55, -35);
  sunLight.diffuse = new Color3(1.30, 1.25, 1.15);
  sunLight.specular = new Color3(0.5, 0.5, 0.5);
  sunLight.intensity = 1.85;

  // Secondary cool sky fill light to prevent pitch black shadow pockets
  const fillLight = new DirectionalLight('fillLight', new Vector3(-0.45, -0.85, -0.45), scene);
  fillLight.position = new Vector3(35, 45, 35);
  fillLight.diffuse = new Color3(1.0, 1.05, 1.15);
  fillLight.intensity = 1.35;

  // ==================== 14. 12 STRATEGIC TACTICAL SPAWN POINTS ====================
  const spawnPoints: BabylonSpawnPoint[] = [
    // South Base (Defender Spawn Plaza)
    { position: new Vector3(0, 1.0, 44), yaw: 0 },
    { position: new Vector3(-12, 1.0, 42), yaw: 0 },
    { position: new Vector3(12, 1.0, 42), yaw: 0 },
    { position: new Vector3(0, 1.0, 36), yaw: 0 },

    // North Base (Attacker Spawn Approach)
    { position: new Vector3(0, 1.0, -44), yaw: Math.PI },
    { position: new Vector3(-14, 1.0, -42), yaw: Math.PI },
    { position: new Vector3(14, 1.0, -42), yaw: Math.PI },

    // A-Site & A-Long Lane Spawns
    { position: new Vector3(-28, 1.6, -26), yaw: Math.PI },   // A-Site Shrine Approach
    { position: new Vector3(-43, 1.0, 18), yaw: 0 },           // A-Long South Street
    { position: new Vector3(-43, 1.0, -16), yaw: Math.PI },    // A-Long North Street

    // B-Site & Secret Alley Spawns
    { position: new Vector3(28, 1.0, -10), yaw: -Math.PI / 2 }, // B-Site Garden Entrance
    { position: new Vector3(40, 1.0, 20), yaw: 0 }              // Secret Alley Flank
  ];

  return {
    spawnPoints,
    colliders
  };
}

// Backwards-compatible alias for existing imports
export const createCyberShrineMap = createKyotoMap;

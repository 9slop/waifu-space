import {
  Scene,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  AbstractMesh,
  DynamicTexture,
  Texture,
  ShadowGenerator
} from '@babylonjs/core';

export interface BabylonSpawnPoint {
  position: Vector3;
  yaw: number;
}

export interface BabylonMapData {
  spawnPoints: BabylonSpawnPoint[];
  colliders: AbstractMesh[];
  shadowGenerator?: ShadowGenerator;
  sunLight?: DirectionalLight;
  hemiLight?: HemisphericLight;
  setRtxShadows?: (enabled: boolean) => void;
  updateDayNightCycle?: (elapsedSeconds: number) => void;
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
  // ═══════════════════════════════════════════════════════════════════
  // 1. PROCEDURAL TEXTURE FACTORY & MATERIAL PALETTE (Zero-Clone Direct Pipeline)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generates a dedicated procedural DynamicTexture for a material surface.
   * Uploads to WebGL synchronously so the texture and meshes are ready on frame 0.
   */
  function createProcTexture(
    name: string,
    w: number,
    h: number,
    uScale: number,
    vScale: number,
    drawFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  ): DynamicTexture {
    const dt = new DynamicTexture(`tex_${name}`, { width: w, height: h }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    dt.uScale = uScale;
    dt.vScale = vScale;
    dt.wrapU = Texture.WRAP_ADDRESSMODE;
    dt.wrapV = Texture.WRAP_ADDRESSMODE;
    dt.anisotropicFilteringLevel = 4;
    const ctx = dt.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      try {
        drawFn(ctx, w, h);
        dt.update(false); // Synchronous GPU upload with mipmap pyramid generation
      } catch (err) {
        console.warn(`[KyotoMap] Texture draw failed for ${name}:`, err);
      }
    }
    return dt;
  }

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

  function createTexturedMat(
    name: string,
    diffuseColor: Color3,
    uScale: number,
    vScale: number,
    drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    specularColor = new Color3(0.08, 0.08, 0.08),
    emissiveColor?: Color3,
    specularPower = 32
  ): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = diffuseColor;
    mat.specularColor = specularColor;
    mat.specularPower = specularPower;
    if (emissiveColor) mat.emissiveColor = emissiveColor;
    mat.maxSimultaneousLights = 4;

    const diffTex = createProcTexture(name, 512, 512, uScale, vScale, drawFn);
    mat.diffuseTexture = diffTex;

    return mat;
  }

  // --- 1. Street & Courtyard Stone Pavement (Granite/Basalt Pavers) ---
  const groundMat = createTexturedMat(
    'matGround',
    new Color3(0.92, 0.92, 0.92),
    28, 28,
    (ctx, w, h) => {
      ctx.fillStyle = '#2c3036'; // Dark basalt mortar
      ctx.fillRect(0, 0, w, h);
      const rows = 16;
      const cols = 12;
      const rh = h / rows;
      const cw = w / cols;
      for (let r = 0; r < rows; r++) {
        const offsetX = (r % 2) * (cw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * cw + offsetX + 2;
          const y = r * rh + 2;
          const sw = cw - 4;
          const sh = rh - 4;
          // Natural slate/granite tone variation
          const tone = 90 + Math.floor(Math.sin(r * 5.3 + c * 11.7) * 20);
          ctx.fillStyle = `rgb(${tone}, ${tone + 4}, ${tone + 8})`;
          ctx.fillRect(x, y, sw, sh);

          // Top and left edge highlight (subtle 3D bevel)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(x, y, sw, 2);
          ctx.fillRect(x, y, 2, sh);

          // Bottom and right edge shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
          ctx.fillRect(x, y + sh - 2, sw, 2);
          ctx.fillRect(x + sw - 2, y, 2, sh);

          // Granite mineral flecks
          for (let i = 0; i < 20; i++) {
            const fx = x + Math.random() * sw;
            const fy = y + Math.random() * sh;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.10)';
            ctx.fillRect(fx, fy, 2, 2);
          }
        }
      }
    },
    new Color3(0.08, 0.08, 0.08),
    undefined,
    24
  );

  // --- 2. Perimeter Stone Masonry Walls (Ashlar Castle Blocks) ---
  const wallMat = createTexturedMat(
    'matWall',
    new Color3(0.85, 0.88, 0.90),
    12, 2,
    (ctx, w, h) => {
      ctx.fillStyle = '#1c2025'; // Deep mortar recesses
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const cols = 6;
      const rh = h / rows;
      const cw = w / cols;
      for (let r = 0; r < rows; r++) {
        const offsetX = (r % 2) * (cw * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * cw + offsetX + 3;
          const y = r * rh + 3;
          const sw = cw - 6;
          const sh = rh - 6;
          const tone = 112 + Math.floor(Math.sin(r * 3.7 + c * 7.1) * 22);
          ctx.fillStyle = `rgb(${tone - 4}, ${tone}, ${tone + 6})`;
          ctx.fillRect(x, y, sw, sh);

          // Chiseled horizontal tool grooves
          for (let i = 4; i < sh - 4; i += 8) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(x + 4, y + i, sw - 8, 1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(x + 4, y + i + 1, sw - 8, 1);
          }

          // Heavy 3D bevel edges
          ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.fillRect(x, y, sw, 3);
          ctx.fillRect(x, y, 3, sh);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
          ctx.fillRect(x, y + sh - 3, sw, 3);
          ctx.fillRect(x + sw - 3, y, 3, sh);
        }
      }
    },
    new Color3(0.06, 0.06, 0.06),
    undefined,
    20
  );

  // --- 3. Machiya Plaster / Stucco Walls (Kyoto Shikkui Lime Plaster) ---
  const plasterMat = createTexturedMat(
    'matPlaster',
    new Color3(0.96, 0.96, 0.94),
    3, 2,
    (ctx, w, h) => {
      ctx.fillStyle = '#d6d1c5'; // Warm natural off-white plaster
      ctx.fillRect(0, 0, w, h);
      // Subtle plaster trowel texture sweeps
      for (let i = 0; i < 1600; i++) {
        const px = Math.random() * w;
        const py = Math.random() * h;
        const pw = 2 + Math.random() * 8;
        const ph = 1 + Math.random() * 3;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.07)' : 'rgba(50, 42, 32, 0.05)';
        ctx.fillRect(px, py, pw, ph);
      }
      // Fine natural hemp/sand specks
      for (let i = 0; i < 700; i++) {
        const px = Math.random() * w;
        const py = Math.random() * h;
        ctx.fillStyle = 'rgba(40, 32, 22, 0.08)';
        ctx.fillRect(px, py, 1.5, 1.5);
      }
    },
    new Color3(0.03, 0.03, 0.03),
    undefined,
    16
  );

  // --- 4. Dark Cedar Timber Frames (Yakisugi Charred Wood) ---
  const timberMat = createTexturedMat(
    'matTimber',
    new Color3(0.90, 0.86, 0.82),
    1, 3,
    (ctx, w, h) => {
      ctx.fillStyle = '#322116'; // Deep dark cedar
      ctx.fillRect(0, 0, w, h);
      // Vertical wood grain fibers
      for (let i = 0; i < w; i += 3) {
        const alpha = 0.08 + Math.sin(i * 0.4) * 0.06;
        ctx.fillStyle = `rgba(16, 10, 6, ${alpha})`;
        ctx.fillRect(i, 0, 2 + Math.floor(Math.random() * 2), h);
      }
      // Subtle wood knots
      for (let k = 0; k < 4; k++) {
        const kx = (k + 0.5) * (w / 4) + (Math.random() - 0.5) * 40;
        const ky = Math.random() * h;
        ctx.strokeStyle = 'rgba(12, 7, 4, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(kx, ky, 5, 18, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(kx, ky, 8, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    },
    new Color3(0.06, 0.05, 0.04),
    undefined,
    16
  );

  // --- 5. Charcoal Kawara Ceramic Roof Tiles ---
  const tileRoofMat = createTexturedMat(
    'matTileRoof',
    new Color3(0.90, 0.92, 0.95),
    4, 4,
    (ctx, w, h) => {
      ctx.fillStyle = '#1e2229'; // Charcoal ceramic base
      ctx.fillRect(0, 0, w, h);
      const rows = 16;
      const cols = 10;
      const rh = h / rows;
      const cw = w / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cw;
          const y = r * rh;
          // Gradient shading under top tile overlap
          if (ctx.createLinearGradient) {
            const grad = ctx.createLinearGradient(x, y, x, y + rh);
            grad.addColorStop(0, '#363d48');
            grad.addColorStop(0.7, '#232830');
            grad.addColorStop(1, '#14171d');
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = '#232830';
          }
          ctx.fillRect(x + 1, y + 1, cw - 2, rh - 2);

          // Tile upper lip glaze highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(x + 2, y + 1, cw - 4, 2);

          // Side tile groove shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(x + cw - 2, y, 2, rh);
        }
      }
    },
    new Color3(0.16, 0.16, 0.18),
    undefined,
    48
  );

  // --- 6. Shoji Screens with Kumiko Wood Lattice ---
  const shojiMat = createTexturedMat(
    'matShoji',
    new Color3(0.96, 0.94, 0.90),
    2, 2,
    (ctx, w, h) => {
      ctx.fillStyle = '#eae5d9'; // Translucent washi rice paper
      ctx.fillRect(0, 0, w, h);
      // Delicate paper fibers
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      // Outer heavy timber frame
      ctx.fillStyle = '#2d1d11';
      ctx.fillRect(0, 0, w, 12);
      ctx.fillRect(0, h - 12, w, 12);
      ctx.fillRect(0, 0, 12, h);
      ctx.fillRect(w - 12, 0, 12, h);

      // Inner Kumiko wood lattice grid
      const grid = 64;
      ctx.fillStyle = '#3c2718';
      for (let x = grid; x < w; x += grid) {
        ctx.fillRect(x - 2, 12, 5, h - 24);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(x + 3, 12, 2, h - 24);
        ctx.fillStyle = '#3c2718';
      }
      for (let y = grid; y < h; y += grid) {
        ctx.fillRect(12, y - 2, w - 24, 5);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(12, y + 3, w - 24, 2);
        ctx.fillStyle = '#3c2718';
      }
    },
    new Color3(0.04, 0.04, 0.03),
    new Color3(0.08, 0.07, 0.05), // Warm interior glow
    12
  );

  // --- 7. Vermilion Shrine Wood (Fushimi Inari Torii Lacquer) ---
  const shrineRedMat = createTexturedMat(
    'matShrineRed',
    new Color3(0.96, 0.90, 0.90),
    2, 2,
    (ctx, w, h) => {
      ctx.fillStyle = '#c52d24'; // Rich cinnabar vermilion
      ctx.fillRect(0, 0, w, h);
      // Subtle lacquered wood grain streaks
      for (let y = 0; y < h; y += 6) {
        const alpha = 0.07 + Math.sin(y * 0.15) * 0.05;
        ctx.fillStyle = Math.random() > 0.5 ? `rgba(255, 110, 90, ${alpha})` : `rgba(100, 15, 10, ${alpha})`;
        ctx.fillRect(0, y, w, 3);
      }
    },
    new Color3(0.18, 0.14, 0.14),
    undefined,
    40
  );

  // --- 8. Tactical Wooden Supply Crates ---
  const crateMat = createTexturedMat(
    'matCrate',
    new Color3(0.92, 0.88, 0.84),
    1, 1,
    (ctx, w, h) => {
      ctx.fillStyle = '#946030'; // Japanese pine base
      ctx.fillRect(0, 0, w, h);
      const ph = h / 4;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#9e6734' : '#88572b';
        ctx.fillRect(4, i * ph + 2, w - 8, ph - 4);
        // Plank seam shadow
        ctx.fillStyle = '#361e0b';
        ctx.fillRect(0, i * ph, w, 3);
        // Wood grain
        for (let g = 0; g < 5; g++) {
          ctx.fillStyle = 'rgba(30, 15, 5, 0.06)';
          ctx.fillRect(4, i * ph + 4 + g * 18, w - 8, 2);
        }
      }
      // Outer border
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#6d411b';
      if (ctx.strokeRect) {
        ctx.strokeRect(8, 8, w - 16, h - 16);
      }
      // Diagonal cross-brace
      ctx.beginPath();
      ctx.moveTo(12, 12);
      ctx.lineTo(w - 12, h - 12);
      ctx.stroke();

      // Corner iron reinforcements
      ctx.fillStyle = '#26201a';
      ctx.fillRect(0, 0, 24, 24);
      ctx.fillRect(w - 24, 0, 24, 24);
      ctx.fillRect(0, h - 24, 24, 24);
      ctx.fillRect(w - 24, h - 24, 24, 24);

      // Corner bolt specular
      ctx.fillStyle = '#a09890';
      ctx.fillRect(8, 8, 4, 4);
      ctx.fillRect(w - 12, 8, 4, 4);
      ctx.fillRect(8, h - 12, 4, 4);
      ctx.fillRect(w - 12, h - 12, 4, 4);
    },
    new Color3(0.06, 0.05, 0.04),
    undefined,
    16
  );

  // --- 9. Raked Zen Sand / Gravel (Kyoto Karesansui) ---
  const zenSandMat = createTexturedMat(
    'matZenSand',
    new Color3(0.96, 0.96, 0.94),
    6, 4,
    (ctx, w, h) => {
      ctx.fillStyle = '#b5afa3'; // Pale granite sand
      ctx.fillRect(0, 0, w, h);
      const waves = 24;
      const wh = h / waves;
      for (let i = 0; i < waves; i++) {
        const y = i * wh;
        // Raked comb crest highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(0, y, w, wh * 0.45);
        // Raked groove shadow
        ctx.fillStyle = 'rgba(45, 40, 32, 0.18)';
        ctx.fillRect(0, y + wh * 0.5, w, wh * 0.5);
      }
      // Granite mineral flecks
      for (let i = 0; i < 800; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.10)' : 'rgba(30, 25, 20, 0.10)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
    },
    new Color3(0.04, 0.04, 0.04),
    undefined,
    12
  );

  // --- 10. Polished Wood Deck (Veranda Engawa Cypress/Cedar) ---
  const woodDeckMat = createTexturedMat(
    'matWoodDeck',
    new Color3(0.92, 0.88, 0.84),
    4, 4,
    (ctx, w, h) => {
      ctx.fillStyle = '#5e3c25'; // Warm oiled cedar
      ctx.fillRect(0, 0, w, h);
      const planks = 8;
      const pw = w / planks;
      for (let i = 0; i < planks; i++) {
        const x = i * pw;
        const tone = 78 + Math.floor(Math.sin(i * 2.8) * 14);
        ctx.fillStyle = `rgb(${tone}, ${Math.floor(tone * 0.64)}, ${Math.floor(tone * 0.40)})`;
        ctx.fillRect(x + 2, 0, pw - 4, h);
        // Satin polished center highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(x + pw * 0.3, 0, pw * 0.4, h);
        // Dark tongue-and-groove seam
        ctx.fillStyle = '#1c0f07';
        ctx.fillRect(x, 0, 2, h);
      }
    },
    new Color3(0.14, 0.12, 0.10),
    undefined,
    36
  );

  // --- 11. Sakura Tree Bark ---
  const barkMat = createTexturedMat(
    'matBark',
    new Color3(0.85, 0.78, 0.72),
    1, 3,
    (ctx, w, h) => {
      ctx.fillStyle = '#46342b';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) {
        const len = 12 + Math.random() * 36;
        const x = Math.random() * (w - len);
        ctx.fillStyle = 'rgba(25, 16, 12, 0.35)';
        ctx.fillRect(x, y, len, 2.5);
        ctx.fillStyle = 'rgba(95, 75, 62, 0.25)';
        ctx.fillRect(x, y + 2.5, len, 1.5);
      }
    },
    new Color3(0.04, 0.04, 0.04),
    undefined,
    16
  );

  // --- 12. Stone Barriers & Lantern Base ---
  const stoneMat = createTexturedMat(
    'matStone',
    new Color3(0.88, 0.90, 0.92),
    2, 2,
    (ctx, w, h) => {
      ctx.fillStyle = '#6d727b'; // Cool granite
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 180; i++) {
        const cx = Math.random() * (w - 20);
        const cy = Math.random() * h;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(cx, cy, 14, 1.5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.fillRect(cx, cy + 1.5, 14, 1.5);
      }
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(20, 24, 30, 0.18)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      if (ctx.strokeRect) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
      }
    },
    new Color3(0.08, 0.08, 0.08),
    undefined,
    20
  );

  // --- 13. Dark Wood (Merchant Stall Counters & Carts) ---
  const darkWoodMat = createTexturedMat(
    'matDarkWood',
    new Color3(0.78, 0.72, 0.68),
    1, 2,
    (ctx, w, h) => {
      ctx.fillStyle = '#3c2a1e';
      ctx.fillRect(0, 0, w, h);
      const planks = 6;
      const ph = h / planks;
      for (let i = 0; i < planks; i++) {
        const y = i * ph;
        ctx.fillStyle = (i % 2 === 0) ? '#443022' : '#362419';
        ctx.fillRect(0, y + 2, w, ph - 4);
        ctx.fillStyle = '#1a110a';
        ctx.fillRect(0, y, w, 2);
      }
    },
    new Color3(0.04, 0.04, 0.04),
    undefined,
    16
  );

  // --- Non-Textured Specialty Materials ---
  // Gold accents & sacred altar
  const goldMat = new StandardMaterial('matGold', scene);
  goldMat.diffuseColor = new Color3(0.85, 0.70, 0.22);
  goldMat.specularColor = new Color3(0.35, 0.30, 0.12);
  goldMat.emissiveColor = new Color3(0.08, 0.06, 0.02);
  goldMat.maxSimultaneousLights = 4;

  // Glowing lantern paper
  const lanternGlowMat = new StandardMaterial('matLanternGlow', scene);
  lanternGlowMat.diffuseColor = new Color3(0.95, 0.82, 0.50);
  lanternGlowMat.emissiveColor = new Color3(0.70, 0.55, 0.25);
  lanternGlowMat.maxSimultaneousLights = 4;

  // Sakura tree foliage (flowering cherry blossom clusters)
  const sakuraMat = createTexturedMat(
    'matSakura',
    new Color3(0.98, 0.95, 0.96),
    3, 3,
    (ctx, w, h) => {
      // Soft blossom pink base
      ctx.fillStyle = '#f6a5c2';
      ctx.fillRect(0, 0, w, h);
      // Delicate petal clusters and emergent lime leaf tips
      for (let i = 0; i < 900; i++) {
        const px = Math.random() * w;
        const py = Math.random() * h;
        const r = 4 + Math.random() * 8;
        ctx.fillStyle = Math.random() > 0.4 ? '#ffaec9' : '#f078a0';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d6336c';
        ctx.beginPath();
        ctx.arc(px, py, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = 'rgba(255, 245, 248, 0.6)';
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = '#82c91e';
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    new Color3(0.04, 0.04, 0.04),
    new Color3(0.10, 0.04, 0.07),
    16
  );

  // Japanese garden bush foliage (Tamamono sculpted azalea/boxwood)
  const bushMat = createTexturedMat(
    'matBush',
    new Color3(0.90, 0.95, 0.90),
    2, 2,
    (ctx, w, h) => {
      ctx.fillStyle = '#264a22'; // Deep forest green base
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1000; i++) {
        const bx = Math.random() * w;
        const by = Math.random() * h;
        const br = 3 + Math.random() * 6;
        const tone = Math.random();
        ctx.fillStyle = tone > 0.6 ? '#4b7d34' : tone > 0.3 ? '#356328' : '#1f3c1b';
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 350; i++) {
        ctx.fillStyle = 'rgba(125, 195, 75, 0.55)';
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    new Color3(0.06, 0.08, 0.06),
    undefined,
    20
  );

  // Bamboo
  const bambooMat = new StandardMaterial('matBamboo', scene);
  bambooMat.diffuseColor = new Color3(0.45, 0.54, 0.24);
  bambooMat.maxSimultaneousLights = 4;

  // Neon trims (cyber accent)
  const neonPinkMat = new StandardMaterial('matNeonPink', scene);
  neonPinkMat.diffuseColor = new Color3(0.90, 0.35, 0.62);
  neonPinkMat.emissiveColor = new Color3(0.60, 0.25, 0.42);
  neonPinkMat.maxSimultaneousLights = 4;

  const neonCyanMat = new StandardMaterial('matNeonCyan', scene);
  neonCyanMat.diffuseColor = new Color3(0.0, 0.80, 0.78);
  neonCyanMat.emissiveColor = new Color3(0.0, 0.60, 0.58);
  neonCyanMat.maxSimultaneousLights = 4;

  // ═══════════════════════════════════════════════════════════════════
  // 1B. LIGHTING & REAL-TIME SHADOW GENERATOR
  // ═══════════════════════════════════════════════════════════════════

  // Primary warm Japanese afternoon Sun: distinct angled light source
  const sunLight = new DirectionalLight('sun', new Vector3(0.55, -0.82, 0.45), scene);
  sunLight.position = new Vector3(-60, 85, -60);
  sunLight.diffuse = new Color3(1.05, 0.98, 0.88);
  sunLight.specular = new Color3(0.22, 0.20, 0.16);
  sunLight.intensity = 0.95; // Balanced, natural warm sunlight

  // Soft atmospheric skylight fill (gentle cool blue from above)
  const hemiLight = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), scene);
  hemiLight.diffuse = new Color3(0.48, 0.58, 0.72);
  hemiLight.groundColor = new Color3(0.24, 0.25, 0.24);
  hemiLight.intensity = 0.55;

  // Secondary soft bounce fill from north-east
  const fillLight = new DirectionalLight('fill', new Vector3(-0.55, -0.65, -0.45), scene);
  fillLight.position = new Vector3(60, 65, 60);
  fillLight.diffuse = new Color3(0.35, 0.42, 0.52);
  fillLight.intensity = 0.28;

  // Real-time Shadow Generator with Poisson filtering
  let shadowGen: ShadowGenerator | undefined;
  try {
    shadowGen = new ShadowGenerator(1024, sunLight);
    shadowGen.usePoissonSampling = true;
    shadowGen.bias = 0.0015;
    shadowGen.normalBias = 0.02;
    shadowGen.darkness = 0.45; // Soft natural shadows
  } catch (err) {
    console.warn('[KyotoMap] ShadowGenerator skipped:', err);
  }

  // Collection of point lights for dynamic lantern day/night emission
  const lanternLights: PointLight[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // 2. HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  /** Box with automatic collision and shadow registration */
  function addBox(
    name: string,
    w: number,
    h: number,
    d: number,
    pos: Vector3,
    mat: StandardMaterial,
    collidable = true,
    castShadow = true
  ): AbstractMesh {
    const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    box.position = pos;
    box.material = mat;
    box.receiveShadows = true;
    if (collidable) {
      box.checkCollisions = true;
      colliders.push(box);
    }
    if (castShadow && shadowGen) {
      shadowGen.addShadowCaster(box);
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

    // Corner timber columns (proud of plaster wall by 0.08m on all sides to eliminate z-fighting / texture flickering)
    const pw = 0.62;
    const colHalf = pw / 2;
    const offX = w / 2 - colHalf + 0.06;
    const offZ = d / 2 - colHalf + 0.06;
    addBox(`${prefix}_PFL`, pw, h, pw, new Vector3(pos.x - offX, pos.y + h / 2, pos.z + offZ), timberMat, false);
    addBox(`${prefix}_PFR`, pw, h, pw, new Vector3(pos.x + offX, pos.y + h / 2, pos.z + offZ), timberMat, false);
    addBox(`${prefix}_PBL`, pw, h, pw, new Vector3(pos.x - offX, pos.y + h / 2, pos.z - offZ), timberMat, false);
    addBox(`${prefix}_PBR`, pw, h, pw, new Vector3(pos.x + offX, pos.y + h / 2, pos.z - offZ), timberMat, false);

    // Mid-level timber band (proud of plaster wall by 0.08m)
    addBox(`${prefix}_BmF`, w + 0.2, 0.35, 0.45, new Vector3(pos.x, pos.y + h * 0.52, pos.z + d / 2 + 0.05), timberMat, false);
    addBox(`${prefix}_BmB`, w + 0.2, 0.35, 0.45, new Vector3(pos.x, pos.y + h * 0.52, pos.z - d / 2 - 0.05), timberMat, false);

    // Shoji screens (proud of front wall)
    if (hasShoji) {
      addBox(`${prefix}_ShF`, Math.min(w * 0.6, 5), h * 0.3, 0.12,
        new Vector3(pos.x, pos.y + h * 0.25, pos.z + d / 2 + 0.08), shojiMat, false);
      addBox(`${prefix}_ShU`, Math.min(w * 0.5, 4), h * 0.22, 0.12,
        new Vector3(pos.x, pos.y + h * 0.75, pos.z + d / 2 + 0.08), shojiMat, false);
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
    const pl = addBox(`${prefix}_PL`, pW, pH, pW, new Vector3(pos.x - span, pos.y + pH / 2, pos.z), shrineRedMat);
    const pr = addBox(`${prefix}_PR`, pW, pH, pW, new Vector3(pos.x + span, pos.y + pH / 2, pos.z), shrineRedMat);
    const top = addBox(`${prefix}_Top`, span * 2 + 3.2, 0.85 * scale, 1.1 * scale, new Vector3(pos.x, pos.y + pH - 0.2, pos.z), shrineRedMat);
    const sub = addBox(`${prefix}_Sub`, span * 2 + 1.6, 0.4 * scale, 0.7 * scale, new Vector3(pos.x, pos.y + pH - 1.3, pos.z), shrineRedMat);
    addBox(`${prefix}_Plq`, 0.85 * scale, 1.1 * scale, 0.25 * scale, new Vector3(pos.x, pos.y + pH - 0.75, pos.z), goldMat, false, false);
    if (shadowGen) {
      shadowGen.addShadowCaster(pl);
      shadowGen.addShadowCaster(pr);
      shadowGen.addShadowCaster(top);
      shadowGen.addShadowCaster(sub);
    }
  }

  /** Sakura tree with stone planter, trunk cylinder, and blossom spheres */
  function createSakuraTree(name: string, pos: Vector3) {
    addBox(`${name}_Pl`, 2.8, 0.6, 2.8, new Vector3(pos.x, 0.3, pos.z), stoneMat);
    const trunk = MeshBuilder.CreateCylinder(`${name}_Tr`, { height: 3.8, diameter: 0.55 }, scene);
    trunk.position = new Vector3(pos.x, 2.2, pos.z);
    trunk.material = barkMat;
    trunk.checkCollisions = true;
    trunk.receiveShadows = true;
    colliders.push(trunk);

    const bl1 = MeshBuilder.CreateSphere(`${name}_Bl1`, { diameter: 4.2, segments: 10 }, scene);
    bl1.position = new Vector3(pos.x, 4.4, pos.z);
    bl1.material = sakuraMat;
    bl1.isPickable = false;
    bl1.receiveShadows = true;

    const bl2 = MeshBuilder.CreateSphere(`${name}_Bl2`, { diameter: 3.2, segments: 10 }, scene);
    bl2.position = new Vector3(pos.x + 0.8, 5.1, pos.z + 0.6);
    bl2.material = sakuraMat;
    bl2.isPickable = false;
    bl2.receiveShadows = true;

    if (shadowGen) {
      shadowGen.addShadowCaster(trunk);
      shadowGen.addShadowCaster(bl1);
      shadowGen.addShadowCaster(bl2);
    }
  }

  /** Sculpted Japanese garden bush mound (Tamamono) */
  function createGardenBush(name: string, pos: Vector3, radius = 1.0) {
    const bush = MeshBuilder.CreateSphere(name, { diameterX: radius * 2, diameterY: radius * 1.5, diameterZ: radius * 2, segments: 8 }, scene);
    bush.position = new Vector3(pos.x, pos.y + radius * 0.75, pos.z);
    bush.material = bushMat;
    bush.checkCollisions = true;
    bush.receiveShadows = true;
    colliders.push(bush);
    if (shadowGen) {
      shadowGen.addShadowCaster(bush);
    }
    return bush;
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
    if (openSide === 'south' || openSide === 'north') {
      const cZ = openSide === 'south' ? pos.z + d / 2 - 0.4 : pos.z - d / 2 + 0.4;
      addBox(`${prefix}_Ctr`, w * 0.8, 1.1, 0.6, new Vector3(pos.x, 0.55, cZ), darkWoodMat);
    }
    const bwZ = openSide === 'south' ? pos.z - d / 2 + 0.2 : pos.z + d / 2 - 0.2;
    addBox(`${prefix}_BW`, w, h, 0.4, new Vector3(pos.x, h / 2, bwZ), plasterMat);
    addBox(`${prefix}_SWL`, 0.35, h, d * 0.7, new Vector3(pos.x - w / 2 + 0.2, h / 2, pos.z + (openSide === 'south' ? -d * 0.15 : d * 0.15)), plasterMat);
    addBox(`${prefix}_SWR`, 0.35, h, d * 0.7, new Vector3(pos.x + w / 2 - 0.2, h / 2, pos.z + (openSide === 'south' ? -d * 0.15 : d * 0.15)), plasterMat);
    addBox(`${prefix}_Rf`, w + 1.2, 0.4, d + 1.0, new Vector3(pos.x, h + 0.2, pos.z), tileRoofMat);
  }

  /** Stone lantern (base + glow cap + warm emitted point light) */
  function createStoneLantern(name: string, pos: Vector3) {
    addBox(`${name}_B`, 0.7, 1.7, 0.7, new Vector3(pos.x, 0.85, pos.z), stoneMat);
    addBox(`${name}_G`, 0.5, 0.5, 0.5, new Vector3(pos.x, 1.95, pos.z), lanternGlowMat, false, false);

    // Warm golden lantern light emission illuminating ground and surroundings
    const pl = new PointLight(`${name}_PL`, new Vector3(pos.x, 2.1, pos.z), scene);
    pl.diffuse = new Color3(1.0, 0.78, 0.42);
    pl.specular = new Color3(0.18, 0.14, 0.08);
    pl.intensity = 0.65;
    pl.range = 9.0;
    lanternLights.push(pl);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. ARENA GROUND & PERIMETER WALLS (104m × 104m)
  // ═══════════════════════════════════════════════════════════════════

  // Main cobblestone ground
  const ground = MeshBuilder.CreateGround('mainGround', { width: 104, height: 104, subdivisions: 4 }, scene);
  ground.position = new Vector3(0, 0, 0);
  ground.material = groundMat;
  ground.checkCollisions = true;
  ground.receiveShadows = true;
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
  createGardenBush('bushT1L', new Vector3(-8, 0, 43), 1.1);
  createGardenBush('bushT1R', new Vector3(8, 0, 43), 1.1);

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

  // Bamboo groves & foliage
  createBambooFence('bambooT2L', new Vector3(-12, 0, -46), 6, true);
  createBambooFence('bambooT2R', new Vector3(12, 0, -46), 6, true);
  createSakuraTree('sakuraT2L', new Vector3(-15, 0, -45));
  createSakuraTree('sakuraT2R', new Vector3(15, 0, -45));
  createGardenBush('bushT2L', new Vector3(-8, 0, -43), 1.1);
  createGardenBush('bushT2R', new Vector3(8, 0, -43), 1.1);

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

  // --- Central Sakura Tree & garden foliage ---
  createSakuraTree('sakuraMid', new Vector3(0, 0, 8));
  createGardenBush('bushMid1', new Vector3(-7, 0, 6), 0.95);
  createGardenBush('bushMid2', new Vector3(7, 0, 6), 0.95);
  createGardenBush('bushMid3', new Vector3(-7, 0, -6), 0.95);
  createGardenBush('bushMid4', new Vector3(7, 0, -6), 0.95);

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
  // Tea house timber frame (proud of walls to eliminate flickering)
  addBox('teaPFL', 0.62, 5, 0.62, new Vector3(-38.04, 2.5, -24.96), timberMat, false);
  addBox('teaPFR', 0.62, 5, 0.62, new Vector3(-27.96, 2.5, -24.96), timberMat, false);
  addBox('teaPBL', 0.62, 5, 0.62, new Vector3(-38.04, 2.5, -33.04), timberMat, false);
  addBox('teaPBR', 0.62, 5, 0.62, new Vector3(-27.96, 2.5, -33.04), timberMat, false);
  // Tea house roof
  addBox('teaRoof', 12.5, 0.55, 10.5, new Vector3(-33, 5.3, -29), tileRoofMat);
  addBox('teaRoofPk', 8, 0.5, 7, new Vector3(-33, 5.85, -29), tileRoofMat);
  // Tea house south veranda (elevated peek position, height 0.4m)
  addBox('teaVeranda', 10, 0.4, 2, new Vector3(-33, 0.6, -24.5), woodDeckMat);

  // --- Waist-high stone planter (default position cover) ---
  addBox('aPlanter', 3.5, 1.25, 1.2, new Vector3(-23, 0.825, -29), stoneMat);

  // --- Defense crate stack (post-plant cover behind altar area) ---
  createCrateCluster('crateASite', new Vector3(-27, 0, -34), false);
  createSakuraTree('sakuraASite', new Vector3(-20, 0, -34));
  createGardenBush('bushA1', new Vector3(-24, 0, -25), 1.15);
  createGardenBush('bushA2', new Vector3(-32, 0, -34), 0.95);

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
  createSakuraTree('sakuraBSite', new Vector3(34, 0, -25));
  createGardenBush('bushB1', new Vector3(21, 0, -25), 1.15);
  createGardenBush('bushB2', new Vector3(31, 0, -34), 0.95);

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

  // Daytime Japan Sky Dome with Panoramic Procedural Sky Texture
  const skyMat = new StandardMaterial('matSky', scene);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;

  const skyTex = createProcTexture(
    'sky_panorama',
    1024, 512,
    1, 1,
    (ctx, w, h) => {
      // Atmospheric vertical sky gradient: Deep zenith blue down to warm horizon
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0.0, '#1c538e');
      skyGrad.addColorStop(0.35, '#3b7bbd');
      skyGrad.addColorStop(0.65, '#6fa6db');
      skyGrad.addColorStop(0.85, '#a4cef0');
      skyGrad.addColorStop(1.0, '#dbebf7');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Afternoon sun glow on sky (south-west azimuth, upper sky)
      const sunX = w * 0.38;
      const sunY = h * 0.28;
      const sunGlow = ctx.createRadialGradient ? ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180) : null;
      if (sunGlow) {
        sunGlow.addColorStop(0.0, 'rgba(255, 252, 235, 0.95)');
        sunGlow.addColorStop(0.2, 'rgba(255, 240, 190, 0.65)');
        sunGlow.addColorStop(0.5, 'rgba(255, 215, 140, 0.25)');
        sunGlow.addColorStop(1.0, 'rgba(255, 200, 120, 0.0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, w, h);
      }

      // Soft painterly Japanese cumulus and cirrus clouds
      for (let i = 0; i < 18; i++) {
        const cx = (i * (w / 16) + 40) % w;
        const cy = h * 0.35 + Math.sin(i * 1.7) * (h * 0.2);
        const cw = 70 + (i % 5) * 35;
        const ch = 18 + (i % 3) * 10;
        ctx.fillStyle = 'rgba(245, 250, 255, 0.55)';
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(cx, cy, ch, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
  );
  skyMat.diffuseTexture = skyTex;
  skyMat.emissiveTexture = skyTex;

  const skyDome = MeshBuilder.CreateSphere('skyDome', { diameter: 500, segments: 16 }, scene);
  skyDome.material = skyMat;
  skyDome.isPickable = false;
  skyDome.checkCollisions = false;

  // Mount Fuji (Majestic landmark on NW horizon)
  const fujiBaseMat = createMat('matFujiBase', new Color3(0.24, 0.30, 0.44), new Color3(0.04, 0.04, 0.04));
  const fujiBase = MeshBuilder.CreateCylinder('fujiBase', { height: 110, diameterBottom: 210, diameterTop: 36, tessellation: 36 }, scene);
  fujiBase.position = new Vector3(-105, 48, -170);
  fujiBase.material = fujiBaseMat;
  fujiBase.isPickable = false;
  fujiBase.checkCollisions = false;

  const fujiCapMat = createMat('matFujiCap', new Color3(0.96, 0.97, 0.99), new Color3(0.25, 0.25, 0.25));
  const fujiCap = MeshBuilder.CreateCylinder('fujiCap', { height: 40, diameterBottom: 82, diameterTop: 34, tessellation: 36 }, scene);
  fujiCap.position = new Vector3(-105, 88, -170);
  fujiCap.material = fujiCapMat;
  fujiCap.isPickable = false;
  fujiCap.checkCollisions = false;

  // Natural rolling forested hills (soft evergreen pine mounds framing the valley)
  const ridgeMat = createMat('matRidge', new Color3(0.16, 0.26, 0.20), new Color3(0.02, 0.02, 0.02));
  const rollingHills = [
    // North horizon (framing Mount Fuji in the NW)
    { x: -25, y: 15, z: -145, w: 90, h: 32, d: 45 },
    { x: 65, y: 18, z: -145, w: 100, h: 36, d: 50 },
    // South horizon (behind Team 1 Spawn)
    { x: -50, y: 14, z: 135, w: 90, h: 30, d: 45 },
    { x: 5, y: 18, z: 140, w: 95, h: 36, d: 50 },
    { x: 60, y: 15, z: 135, w: 90, h: 32, d: 45 },
    // East horizon (behind Secret / B-Site)
    { x: 135, y: 16, z: -45, w: 45, h: 34, d: 90 },
    { x: 140, y: 20, z: 0, w: 50, h: 38, d: 95 },
    { x: 135, y: 15, z: 45, w: 45, h: 32, d: 90 },
    // West horizon (behind A-Long)
    { x: -135, y: 16, z: -45, w: 45, h: 34, d: 90 },
    { x: -140, y: 20, z: 0, w: 50, h: 38, d: 95 },
    { x: -135, y: 15, z: 45, w: 45, h: 32, d: 90 }
  ];
  for (let r = 0; r < rollingHills.length; r++) {
    const rh = rollingHills[r];
    const hill = MeshBuilder.CreateCylinder(`hill${r}`, {
      height: rh.h,
      diameterBottom: Math.max(rh.w, rh.d),
      diameterTop: Math.max(rh.w, rh.d) * 0.35,
      tessellation: 16
    }, scene);
    hill.position = new Vector3(rh.x, rh.y, rh.z);
    hill.material = ridgeMat;
    hill.isPickable = false;
    hill.checkCollisions = false;
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
  // 13. ZONE 10: TACTICAL SITE LIGHTING
  // ═══════════════════════════════════════════════════════════════════

  // Tactical focal point lights (warm lantern illumination for key sites)
  const focalLights = [
    new Vector3(-27, 2.5, -29),   // A-Site Tea House Courtyard
    new Vector3(27, 2.5, -29),    // B-Site Temple Gate
    new Vector3(0, 2.8, 0),       // Mid Torii center
    new Vector3(40, 2.5, 0)       // Secret Passage midpoint
  ];
  for (let fl = 0; fl < focalLights.length; fl++) {
    const pl = new PointLight(`focal${fl}`, focalLights[fl], scene);
    pl.diffuse = new Color3(1.0, 0.85, 0.58);
    pl.specular = new Color3(0.12, 0.10, 0.06);
    pl.intensity = 0.75;
    pl.range = 24;
    lanternLights.push(pl);
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

  const setRtxShadows = (enabled: boolean) => {
    if (!shadowGen) return;
    try {
      if (enabled) {
        shadowGen.useContactHardeningShadow = true;
        shadowGen.contactHardeningLightSizeUVRatio = 0.08;
        shadowGen.filteringQuality = ShadowGenerator.QUALITY_HIGH;
        shadowGen.bias = 0.0005;
        shadowGen.normalBias = 0.015;
      } else {
        shadowGen.useContactHardeningShadow = false;
        shadowGen.usePoissonSampling = true;
        shadowGen.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGen.bias = 0.0015;
        shadowGen.normalBias = 0.02;
      }
    } catch (err) {
      console.warn('[KyotoMap] Error toggling RTX shadows:', err);
    }
  };

  const CYCLE_DURATION = 1440; // 24 minutes in seconds

  const updateDayNightCycle = (elapsedSeconds: number) => {
    const cycleTime = elapsedSeconds % CYCLE_DURATION;
    const phase = cycleTime / CYCLE_DURATION; // 0.0 to 1.0

    // Sun / Moon orbital angle:
    // phase 0.0 = dawn (east), 0.25 = noon, 0.5 = dusk (west), 0.75 = midnight (moon)
    const angle = phase * Math.PI * 2;
    const sunElevation = Math.sin(angle); // -1 to +1: >0 is day, <0 is night
    const sunAzimuth = Math.cos(angle);

    const isDaytime = sunElevation > -0.08;

    if (isDaytime) {
      // Day / Dawn / Dusk sun direction (pointing down from sun towards center)
      const sunHeight = Math.max(0.12, sunElevation);
      sunLight.direction = new Vector3(sunAzimuth * 0.75, -sunHeight, 0.45).normalize();
      sunLight.position = new Vector3(-sunAzimuth * 120, sunHeight * 140, -60);

      if (sunElevation < 0.25) {
        // Dawn or Dusk (sunset glow)
        const t = Math.max(0, sunElevation / 0.25);
        sunLight.diffuse = Color3.Lerp(new Color3(1.0, 0.45, 0.25), new Color3(1.05, 0.98, 0.88), t);
        sunLight.intensity = 0.55 + t * 0.4;
        hemiLight.diffuse = Color3.Lerp(new Color3(0.42, 0.32, 0.45), new Color3(0.48, 0.58, 0.72), t);
        hemiLight.intensity = 0.35 + t * 0.2;
        scene.clearColor = Color4.Lerp(new Color4(0.35, 0.22, 0.38, 1.0), new Color4(0.42, 0.65, 0.88, 1.0), t);
        skyMat.emissiveColor = Color3.Lerp(new Color3(0.9, 0.55, 0.5), new Color3(1.0, 1.0, 1.0), t);
      } else {
        // Full daytime
        sunLight.diffuse = new Color3(1.05, 0.98, 0.88);
        sunLight.intensity = 0.95;
        hemiLight.diffuse = new Color3(0.48, 0.58, 0.72);
        hemiLight.intensity = 0.55;
        scene.clearColor = new Color4(0.42, 0.65, 0.88, 1.0);
        skyMat.emissiveColor = new Color3(1.0, 1.0, 1.0);
      }

      // Lanterns are dimmed during the daytime
      const lanternIntensity = Math.max(0.15, 0.75 - sunElevation * 0.65);
      lanternLights.forEach((l) => (l.intensity = lanternIntensity));
    } else {
      // Nighttime (Directional light becomes cool moonlight)
      const moonHeight = Math.max(0.2, -sunElevation);
      sunLight.direction = new Vector3(-sunAzimuth * 0.65, -moonHeight, -0.4).normalize();
      sunLight.position = new Vector3(sunAzimuth * 100, moonHeight * 120, 60);

      // Cool silvery moonlight
      sunLight.diffuse = new Color3(0.35, 0.48, 0.75);
      sunLight.intensity = 0.42;

      // Night skylight fill
      hemiLight.diffuse = new Color3(0.14, 0.18, 0.32);
      hemiLight.groundColor = new Color3(0.08, 0.09, 0.14);
      hemiLight.intensity = 0.28;

      scene.clearColor = new Color4(0.05, 0.07, 0.14, 1.0);
      skyMat.emissiveColor = new Color3(0.12, 0.15, 0.28);

      // Lanterns shine brightly at night!
      lanternLights.forEach((l) => (l.intensity = 0.95));
    }
  };

  return {
    spawnPoints,
    colliders,
    shadowGenerator: shadowGen,
    sunLight,
    hemiLight,
    setRtxShadows,
    updateDayNightCycle
  };
}

// Backwards-compatible alias for existing imports
export const createCyberShrineMap = createKyotoMap;

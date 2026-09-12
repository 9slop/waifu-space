import {
  Scene,
  Vector3,
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  AbstractMesh,
  Camera,
  DynamicTexture,
  Texture,
  ShadowGenerator
} from '@babylonjs/core';
import { WeaponId } from './strike-types';
import { WEAPON_CATALOG } from './strike-weapons';

export interface BabylonAvatarOptions {
  name: string;
  hairColor?: string;
  outfitColor?: string;
  skinColor?: string;
}

/**
 * Creates procedural canvas textures with trilinear mipmapping and anisotropic filtering
 */
function createProcTexture(
  name: string,
  w: number,
  h: number,
  scene: Scene,
  drawFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
): DynamicTexture {
  const dt = new DynamicTexture(`tex_${name}`, { width: w, height: h }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  dt.wrapU = Texture.WRAP_ADDRESSMODE;
  dt.wrapV = Texture.WRAP_ADDRESSMODE;
  dt.anisotropicFilteringLevel = 4;
  const ctx = dt.getContext() as CanvasRenderingContext2D;
  if (ctx) {
    try {
      drawFn(ctx, w, h);
      dt.update(false);
    } catch (err) {
      console.warn(`[Avatar] Texture draw failed for ${name}:`, err);
    }
  }
  return dt;
}

function createTexturedMat(
  name: string,
  scene: Scene,
  diffuseColor: Color3,
  w: number,
  h: number,
  drawFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  specularColor = new Color3(0.2, 0.2, 0.2),
  emissiveColor?: Color3,
  specularPower = 32
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = diffuseColor;
  mat.specularColor = specularColor;
  mat.specularPower = specularPower;
  if (emissiveColor) mat.emissiveColor = emissiveColor;
  mat.maxSimultaneousLights = 4;
  const diffTex = createProcTexture(name, w, h, scene, drawFn);
  mat.diffuseTexture = diffTex;
  return mat;
}

/**
 * Creates textured 3D weapon meshes for Babylon.js first-person viewmodel or third-person avatar hands.
 */
export function createBabylonWeaponMesh(weaponId: WeaponId, scene: Scene): TransformNode {
  const root = new TransformNode(`WeaponRoot_${weaponId}_${Math.random()}`, scene);

  if (weaponId === 'rifle') {
    // Textured Rifle Materials
    const rifleBodyMat = createTexturedMat(`rifleBody_${Math.random()}`, scene, new Color3(0.9, 0.9, 0.9), 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1c1f26'; // Dark matte receiver
      ctx.fillRect(0, 0, w, h);
      // Split line
      ctx.fillStyle = '#0e1014';
      ctx.fillRect(0, h * 0.48, w, 4);
      // Ejection port
      ctx.fillStyle = '#12141a';
      ctx.fillRect(w * 0.45, h * 0.2, w * 0.35, h * 0.22);
      ctx.fillStyle = '#d4af37'; // Brass casing
      ctx.fillRect(w * 0.52, h * 0.26, w * 0.2, h * 0.1);
      // Ventilation slots
      ctx.fillStyle = '#0a0c0f';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(w * 0.08 + i * 18, h * 0.22, 10, h * 0.18);
      }
      // Fire selector markings
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('SAFE', w * 0.2, h * 0.82);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('SEMI', w * 0.45, h * 0.82);
      ctx.fillStyle = '#ff2b75';
      ctx.fillText('AUTO', w * 0.72, h * 0.82);
      // Edge highlights
      ctx.strokeStyle = '#383f4d';
      ctx.lineWidth = 3;
      if (ctx.strokeRect) ctx.strokeRect(2, 2, w - 4, h - 4);
    }, new Color3(0.25, 0.25, 0.28), undefined, 48);

    const rifleBarrelMat = createTexturedMat(`rifleBarrel_${Math.random()}`, scene, new Color3(0.85, 0.88, 0.9), 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#2b303b';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = '#181b22';
        ctx.fillRect(x, 0, 7, h);
        ctx.fillStyle = '#485060';
        ctx.fillRect(x + 7, 0, 2, h);
      }
    }, new Color3(0.4, 0.4, 0.45), undefined, 64);

    const rifleMagMat = createTexturedMat(`rifleMag_${Math.random()}`, scene, new Color3(1.0, 0.85, 0.9), 128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ff2b75'; // Cyberpunk hot pink
      ctx.fillRect(0, 0, w, h);
      // Diagonal ribbed waffle grip
      ctx.strokeStyle = '#d61858';
      ctx.lineWidth = 4;
      for (let y = -w; y < h + w; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + w);
        ctx.stroke();
      }
      // Transparent round indicator window
      ctx.fillStyle = '#181a20';
      ctx.fillRect(w * 0.7, h * 0.15, w * 0.22, h * 0.7);
      for (let r = 0; r < 6; r++) {
        ctx.fillStyle = '#eab308';
        ctx.fillRect(w * 0.72, h * 0.2 + r * 26, w * 0.18, 14);
      }
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('30', w * 0.12, h * 0.25);
      ctx.fillText('20', w * 0.12, h * 0.5);
      ctx.fillText('10', w * 0.12, h * 0.75);
    }, new Color3(0.2, 0.15, 0.18), new Color3(0.12, 0.03, 0.06), 32);

    const rifleStockMat = createTexturedMat(`rifleStock_${Math.random()}`, scene, new Color3(0.85, 0.85, 0.85), 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#16181d';
      ctx.fillRect(0, 0, w, h);
      // Carbon weave
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          ctx.fillStyle = ((x + y) % 16 === 0) ? '#282c35' : '#1b1e25';
          ctx.fillRect(x, y, 8, 8);
        }
      }
      // Rubber recoil pad
      ctx.fillStyle = '#0a0b0e';
      ctx.fillRect(w * 0.8, 0, w * 0.2, h);
      for (let y = 4; y < h; y += 10) {
        ctx.fillStyle = '#22262e';
        ctx.fillRect(w * 0.8, y, w * 0.2, 4);
      }
    }, new Color3(0.15, 0.15, 0.15), undefined, 24);

    const rifleSightMat = createTexturedMat(`rifleSight_${Math.random()}`, scene, new Color3(1.0, 0.8, 0.9), 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#ff2b75';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#22c55e'; // Tritium night sight dot
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    }, new Color3(0.3, 0.1, 0.2), new Color3(0.2, 0.35, 0.1), 40);

    // Receiver
    const body = MeshBuilder.CreateBox('rifleBody', { width: 0.08, height: 0.12, depth: 0.45 }, scene);
    body.material = rifleBodyMat;
    body.parent = root;

    // Barrel
    const barrel = MeshBuilder.CreateCylinder('rifleBarrel', { height: 0.38, diameter: 0.035 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new Vector3(0, 0.02, 0.38);
    barrel.material = rifleBarrelMat;
    barrel.parent = root;

    // Curved Magazine
    const mag = MeshBuilder.CreateBox('rifleMag', { width: 0.05, height: 0.22, depth: 0.09 }, scene);
    mag.position = new Vector3(0, -0.12, 0.06);
    mag.rotation.x = -0.25;
    mag.material = rifleMagMat;
    mag.parent = root;

    // Stock
    const stock = MeshBuilder.CreateBox('rifleStock', { width: 0.07, height: 0.14, depth: 0.22 }, scene);
    stock.position = new Vector3(0, -0.02, -0.3);
    stock.material = rifleStockMat;
    stock.parent = root;

    // Iron Sights
    const sight = MeshBuilder.CreateBox('rifleSight', { width: 0.04, height: 0.05, depth: 0.08 }, scene);
    sight.position = new Vector3(0, 0.08, 0.1);
    sight.material = rifleSightMat;
    sight.parent = root;
  } else if (weaponId === 'sniper') {
    // Textured Sniper Materials
    const sniperBodyMat = createTexturedMat(`sniperBody_${Math.random()}`, scene, new Color3(0.9, 0.95, 1.0), 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#12151b'; // Deep carbon chassis
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6) {
        ctx.fillStyle = (y % 12 === 0) ? '#1a1e27' : '#141720';
        ctx.fillRect(0, y, w, 6);
      }
      // Glowing cyan cyber circuit lines
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(10, h * 0.3);
      ctx.lineTo(w * 0.4, h * 0.3);
      ctx.lineTo(w * 0.5, h * 0.6);
      ctx.lineTo(w * 0.9, h * 0.6);
      ctx.stroke();
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(w * 0.9, h * 0.6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('AWM // .338 MAG', w * 0.15, h * 0.85);
    }, new Color3(0.2, 0.3, 0.35), new Color3(0.04, 0.15, 0.18), 48);

    const sniperBarrelMat = createTexturedMat(`sniperBarrel_${Math.random()}`, scene, new Color3(0.9, 0.9, 0.95), 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#222731';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 14) {
        ctx.fillStyle = '#13161c';
        ctx.fillRect(x, 0, 6, h);
        ctx.fillStyle = '#414959';
        ctx.fillRect(x + 6, 0, 2, h);
      }
    }, new Color3(0.35, 0.38, 0.42), undefined, 64);

    const sniperBrakeMat = createTexturedMat(`sniperBrake_${Math.random()}`, scene, new Color3(0.95, 0.9, 1.0), 128, 128, (ctx, w, h) => {
      const grad = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, w, 0) : null;
      if (grad) {
        grad.addColorStop(0.0, '#2b303c');
        grad.addColorStop(0.4, '#382a4d');
        grad.addColorStop(0.7, '#6b21a8');
        grad.addColorStop(1.0, '#00e5ff');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = '#6b21a8';
      }
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0b0d11';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(18 + i * 36, h * 0.2, 16, h * 0.6);
      }
    }, new Color3(0.3, 0.2, 0.4), new Color3(0.05, 0.05, 0.1), 48);

    const sniperScopeMat = createTexturedMat(`sniperScope_${Math.random()}`, scene, new Color3(0.85, 0.85, 0.88), 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#161920';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 6) {
        ctx.fillStyle = (x % 12 === 0) ? '#2d3340' : '#1a1d25';
        ctx.fillRect(x, h * 0.35, 3, h * 0.3);
      }
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('10x-40x56', 8, h * 0.85);
    }, new Color3(0.25, 0.25, 0.28), undefined, 32);

    const sniperLensMat = createTexturedMat(`sniperLens_${Math.random()}`, scene, new Color3(0.9, 1.0, 1.0), 128, 128, (ctx, w, h) => {
      const lensGrad = ctx.createRadialGradient ? ctx.createRadialGradient(w/2, h/2, 5, w/2, h/2, w/2) : null;
      if (lensGrad) {
        lensGrad.addColorStop(0.0, '#002b28');
        lensGrad.addColorStop(0.7, '#004d40');
        lensGrad.addColorStop(1.0, '#00b4d8');
        ctx.fillStyle = lensGrad;
      } else {
        ctx.fillStyle = '#004d40';
      }
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2, 6);
      ctx.lineTo(w / 2, h - 6);
      ctx.moveTo(6, h / 2);
      ctx.lineTo(w - 6, h / 2);
      ctx.stroke();
    }, new Color3(0.2, 0.5, 0.6), new Color3(0.1, 0.35, 0.4), 80);

    const sniperStockMat = createTexturedMat(`sniperStock_${Math.random()}`, scene, new Color3(0.85, 0.85, 0.85), 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#16181d';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          ctx.fillStyle = ((x + y) % 16 === 0) ? '#242831' : '#17191f';
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }, new Color3(0.2, 0.2, 0.2), undefined, 24);

    // Sleek long body
    const body = MeshBuilder.CreateBox('sniperBody', { width: 0.09, height: 0.13, depth: 0.65 }, scene);
    body.material = sniperBodyMat;
    body.parent = root;

    // Heavy long barrel
    const barrel = MeshBuilder.CreateCylinder('sniperBarrel', { height: 0.65, diameter: 0.04 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new Vector3(0, 0.02, 0.58);
    barrel.material = sniperBarrelMat;
    barrel.parent = root;

    // Muzzle Brake
    const brake = MeshBuilder.CreateBox('sniperBrake', { width: 0.06, height: 0.06, depth: 0.1 }, scene);
    brake.position = new Vector3(0, 0.02, 0.92);
    brake.material = sniperBrakeMat;
    brake.parent = root;

    // Large Sniper Scope
    const scopeTube = MeshBuilder.CreateCylinder('sniperScope', { height: 0.35, diameter: 0.07 }, scene);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position = new Vector3(0, 0.12, 0.05);
    scopeTube.material = sniperScopeMat;
    scopeTube.parent = root;

    // Scope Lens accent ring
    const lensFront = MeshBuilder.CreateCylinder('sniperLens', { height: 0.05, diameter: 0.085 }, scene);
    lensFront.rotation.x = Math.PI / 2;
    lensFront.position = new Vector3(0, 0.12, 0.22);
    lensFront.material = sniperLensMat;
    lensFront.parent = root;

    // Sniper Stock
    const stock = MeshBuilder.CreateBox('sniperStock', { width: 0.07, height: 0.16, depth: 0.32 }, scene);
    stock.position = new Vector3(0, -0.02, -0.45);
    stock.material = sniperStockMat;
    stock.parent = root;
  } else if (weaponId === 'pistol') {
    // Textured Pistol Materials
    const pistolSlideMat = createTexturedMat(`pistolSlide_${Math.random()}`, scene, new Color3(0.95, 0.95, 0.98), 256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#7a8291';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = (y % 6 === 0) ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, y, w, 1.5);
      }
      ctx.fillStyle = '#373d48';
      for (let s = 0; s < 5; s++) {
        ctx.fillRect(16 + s * 10, h * 0.15, 5, h * 0.7);
        ctx.fillRect(w - 65 + s * 10, h * 0.15, 5, h * 0.7);
      }
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#22262e';
      ctx.fillText('WAIFU-9 // 9x19 MATCH', w * 0.28, h * 0.58);
    }, new Color3(0.45, 0.48, 0.55), undefined, 64);

    const pistolGripMat = createTexturedMat(`pistolGrip_${Math.random()}`, scene, new Color3(0.9, 0.9, 0.9), 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#1e2128';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          ctx.fillStyle = ((x + y) % 16 === 0) ? '#313744' : '#14161b';
          ctx.fillRect(x, y, 4, 4);
        }
      }
      ctx.fillStyle = '#ff2b75';
      ctx.fillRect(w * 0.75, h * 0.25, 14, 10);
    }, new Color3(0.18, 0.18, 0.2), undefined, 28);

    // Slide
    const slide = MeshBuilder.CreateBox('pistolSlide', { width: 0.06, height: 0.08, depth: 0.24 }, scene);
    slide.material = pistolSlideMat;
    slide.parent = root;

    // Barrel
    const barrel = MeshBuilder.CreateCylinder('pistolBarrel', { height: 0.08, diameter: 0.025 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new Vector3(0, 0.01, 0.12);
    barrel.material = pistolSlideMat;
    barrel.parent = root;

    // Grip
    const grip = MeshBuilder.CreateBox('pistolGrip', { width: 0.05, height: 0.16, depth: 0.09 }, scene);
    grip.position = new Vector3(0, -0.1, -0.05);
    grip.rotation.x = -0.2;
    grip.material = pistolGripMat;
    grip.parent = root;
  } else if (weaponId === 'knife') {
    // Textured Damascus Knife Materials
    const knifeBladeMat = createTexturedMat(`knifeBlade_${Math.random()}`, scene, new Color3(0.98, 0.98, 1.0), 256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#bcc4d1';
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 18; i++) {
        const yBase = i * 8;
        ctx.strokeStyle = (i % 2 === 0) ? 'rgba(75, 85, 102, 0.45)' : 'rgba(240, 245, 255, 0.55)';
        ctx.beginPath();
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= w; x += 20) {
          const wave = Math.sin(x * 0.08 + i * 1.5) * 6;
          ctx.lineTo(x, yBase + wave);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      ctx.fillStyle = '#475569';
      ctx.fillRect(w * 0.15, h * 0.38, w * 0.65, 3.5);
    }, new Color3(0.55, 0.58, 0.65), undefined, 96);

    const knifeGuardMat = createTexturedMat(`knifeGuard_${Math.random()}`, scene, new Color3(0.9, 0.85, 0.8), 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#2c313a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      if (ctx.strokeRect) ctx.strokeRect(2, 2, w - 4, h - 4);
    }, new Color3(0.35, 0.32, 0.25), undefined, 48);

    const knifeHandleMat = createTexturedMat(`knifeHandle_${Math.random()}`, scene, new Color3(0.9, 0.9, 0.9), 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#1c1f26';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2d3340';
      ctx.lineWidth = 5;
      for (let y = -w; y < h + w; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + 24);
        ctx.stroke();
      }
      ctx.fillStyle = '#ff2b75';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 7, 0, Math.PI * 2);
      ctx.fill();
    }, new Color3(0.2, 0.2, 0.2), undefined, 24);

    // Blade
    const blade = MeshBuilder.CreateBox('knifeBlade', { width: 0.02, height: 0.06, depth: 0.28 }, scene);
    blade.position = new Vector3(0, 0, 0.14);
    blade.material = knifeBladeMat;
    blade.parent = root;

    // Guard
    const guard = MeshBuilder.CreateBox('knifeGuard', { width: 0.08, height: 0.02, depth: 0.04 }, scene);
    guard.material = knifeGuardMat;
    guard.parent = root;

    // Handle
    const handle = MeshBuilder.CreateCylinder('knifeHandle', { height: 0.14, diameter: 0.03 }, scene);
    handle.rotation.x = Math.PI / 2;
    handle.position = new Vector3(0, 0, -0.09);
    handle.material = knifeHandleMat;
    handle.parent = root;
  }

  // Ensure weapon viewmodel parts never block player shooting raycasts
  root.getChildMeshes().forEach((m) => {
    m.isPickable = false;
  });

  return root;
}

/**
 * First-person viewmodel rendered directly in front of the camera.
 */
export class BabylonViewmodel {
  public root: TransformNode;
  private weaponMeshGroup: TransformNode;
  private scene: Scene;
  private camera: Camera;

  // Recoil and animation states
  private recoilOffset = new Vector3(0, 0, 0);
  private recoilRot = new Vector3(0, 0, 0);
  private bobOffset = new Vector3(0, 0, 0);

  // Smooth monotonic walk cycle (integrated over dt - immune to camera rotation spikes)
  private walkCycle = 0;

  // Melee knife slash animation
  private isMeleeAttacking = false;
  private isHeavyMelee = false;
  private meleeProgress = 0;
  private meleeSlashSide = 1;

  // Tactical wall proximity tuck
  private wallTuck = 0;
  private smoothedWallTuck = 0;

  // Weapon equip / draw animation
  private drawProgress = 0;

  // Sniper bolt-action cycle animation
  private boltActionProgress = 0;

  // Reload animation
  private reloadProgress = 0;
  private isReloading = false;

  constructor(scene: Scene, camera: Camera) {
    this.scene = scene;
    this.camera = camera;

    // Viewmodel rendering group: group 1 with depth clearing renders viewmodel over world geometry without clipping
    try {
      this.scene.setRenderingAutoClearDepthStencil(1, true, true, false);
    } catch {
      // Ignored in NullEngine test environments
    }

    this.root = new TransformNode('FirstPersonViewmodelRoot', scene);
    this.root.parent = camera;

    this.weaponMeshGroup = new TransformNode('ViewmodelWeaponMount', scene);
    this.weaponMeshGroup.parent = this.root;

    // Default right-hand weapon position relative to camera
    this.root.position = new Vector3(0.24, -0.22, 0.48);

    this.setWeapon('rifle');
  }

  public setWeapon(id: WeaponId) {
    // Dispose old weapon meshes
    const children = this.weaponMeshGroup.getChildren();
    for (const child of children) {
      child.dispose();
    }

    const mesh = createBabylonWeaponMesh(id, this.scene);
    const def = WEAPON_CATALOG[id];
    mesh.scaling = new Vector3(def.viewmodelScale, def.viewmodelScale, def.viewmodelScale);
    mesh.parent = this.weaponMeshGroup;

    // Set rendering group 1 recursively across all viewmodel meshes to prevent wall clipping
    mesh.renderingGroupId = 1;
    for (const child of mesh.getChildMeshes(false)) {
      child.renderingGroupId = 1;
    }

    // Trigger weapon equip / draw animation
    this.drawProgress = 1.0;
    this.isMeleeAttacking = false;
    this.isHeavyMelee = false;
    this.meleeProgress = 0;
    this.boltActionProgress = 0;
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  /** Sets wall proximity from forward raycast to smoothly tuck weapon when standing close to walls */
  public setWallProximity(dist: number) {
    if (dist < 0.65) {
      this.wallTuck = Math.min(1.0, (0.65 - dist) / 0.45);
    } else {
      this.wallTuck = 0;
    }
  }

  /**
   * Triggers visual weapon attack animation (knife slash/thrust or gun recoil).
   */
  public triggerAttack(weaponId: WeaponId, vertical = 0.03, horizontal = 0.015, isHeavy = false) {
    if (weaponId === 'knife') {
      // Dynamic anime knife slash/thrust animation
      this.isMeleeAttacking = true;
      this.isHeavyMelee = isHeavy;
      this.meleeProgress = 1.0;
      if (!isHeavy) {
        this.meleeSlashSide = -this.meleeSlashSide; // alternate left/right slashes for quick slashes
      }
      return;
    }

    if (weaponId === 'sniper') {
      // Heavy AWP railgun kickback + bolt-action chambering
      this.recoilOffset.z -= 0.16;
      this.recoilOffset.y += 0.05;
      this.recoilRot.x -= 0.32;
      this.recoilRot.z -= 0.06;
      this.boltActionProgress = 1.0;
      return;
    }

    if (weaponId === 'pistol') {
      // Snappy Deagle upward muzzle flip
      this.recoilOffset.z -= 0.065;
      this.recoilOffset.y += 0.038;
      this.recoilRot.x -= 0.28;
      this.recoilRot.z += (Math.random() - 0.5) * 0.05;
      return;
    }

    // Rifle: Punchy automatic recoil kick
    this.recoilOffset.z -= 0.07;
    this.recoilOffset.y += Math.max(0.015, vertical * 0.5);
    this.recoilRot.x -= Math.max(0.14, vertical * 2.2);
    this.recoilRot.y += (Math.random() - 0.5) * Math.max(0.02, horizontal * 2);
    this.recoilRot.z += (Math.random() - 0.5) * 0.03;
  }

  public triggerRecoil(vertical = 0.03, horizontal = 0.015) {
    this.triggerAttack('rifle', vertical, horizontal);
  }

  public triggerReload(reloadTimeMs: number) {
    this.isReloading = true;
    this.reloadProgress = 1.0;
  }

  public update(dt: number, isMoving: boolean, speedNorm: number) {
    // 1. Recoil spring recovery (rapid snappy return)
    this.recoilOffset = Vector3.Lerp(this.recoilOffset, Vector3.Zero(), Math.min(1, dt * 16));
    this.recoilRot.x = this.lerp(this.recoilRot.x, 0, Math.min(1, dt * 16));
    this.recoilRot.y = this.lerp(this.recoilRot.y, 0, Math.min(1, dt * 16));
    this.recoilRot.z = this.lerp(this.recoilRot.z, 0, Math.min(1, dt * 16));

    // 2. Smooth monotonic weapon bobbing while moving
    // Integrating over dt prevents violent speed/direction camera rotation phase jumping
    if (isMoving && speedNorm > 0.1) {
      const walkRate = 7.5 * Math.min(1.2, Math.max(0.35, speedNorm));
      this.walkCycle += dt * walkRate;
      this.bobOffset.x = Math.sin(this.walkCycle) * 0.012;
      this.bobOffset.y = Math.abs(Math.cos(this.walkCycle)) * 0.008;
    } else {
      this.bobOffset = Vector3.Lerp(this.bobOffset, Vector3.Zero(), Math.min(1, dt * 8));
    }

    // 3. Melee Knife Animation (Quick slash or heavy thrust)
    let slashOffsetX = 0;
    let slashOffsetY = 0;
    let slashOffsetZ = 0;
    let slashRotX = 0;
    let slashRotY = 0;
    let slashRotZ = 0;

    if (this.isMeleeAttacking) {
      const animSpeed = this.isHeavyMelee ? 2.5 : 3.8; // Heavy stab takes ~0.4s, quick slash ~0.26s
      this.meleeProgress -= dt * animSpeed;
      if (this.meleeProgress <= 0) {
        this.isMeleeAttacking = false;
        this.isHeavyMelee = false;
        this.meleeProgress = 0;
      }
      const p = Math.sin(this.meleeProgress * Math.PI); // Smooth 0 -> 1 -> 0 arc
      if (this.isHeavyMelee) {
        // Heavy thrust stab straight forward
        slashOffsetX = 0;
        slashOffsetY = -p * 0.08;
        slashOffsetZ = p * 0.42; // Deep forward heavy reach
        slashRotX = p * 0.65;
        slashRotY = 0;
        slashRotZ = p * 0.25;
      } else {
        // Quick slash
        slashOffsetX = this.meleeSlashSide * p * -0.16;
        slashOffsetY = -p * 0.05;
        slashOffsetZ = p * 0.24; // Forward stab/thrust
        slashRotX = p * 0.35;
        slashRotY = this.meleeSlashSide * p * -0.65;
        slashRotZ = this.meleeSlashSide * p * 0.85;
      }
    }

    // 4. Weapon Equip / Draw Swoop Animation
    let drawOffsetY = 0;
    let drawRotX = 0;
    if (this.drawProgress > 0) {
      this.drawProgress -= dt * 4.2; // ~0.24s draw animation
      if (this.drawProgress <= 0) this.drawProgress = 0;
      const dp = this.drawProgress;
      drawOffsetY = -dp * 0.28; // Swoop up from bottom
      drawRotX = dp * 0.55; // Tilt up into view
    }

    // 5. Sniper Bolt-Action Cycle Animation
    let boltDipY = 0;
    let boltTiltZ = 0;
    if (this.boltActionProgress > 0) {
      this.boltActionProgress -= dt * 1.8;
      if (this.boltActionProgress <= 0) this.boltActionProgress = 0;
      const bp = Math.sin(this.boltActionProgress * Math.PI);
      boltDipY = -bp * 0.04;
      boltTiltZ = bp * 0.12;
    }

    // 6. Reload animation (dip down and return)
    if (this.isReloading) {
      this.reloadProgress -= dt * 1.3;
      if (this.reloadProgress <= 0) {
        this.isReloading = false;
        this.reloadProgress = 0;
      }
    }
    const reloadDip = Math.sin(this.reloadProgress * Math.PI) * 0.22;

    // 7. Tactical Wall Proximity Tuck (smoothly pull back & tilt up when facing a wall)
    this.smoothedWallTuck = this.lerp(this.smoothedWallTuck, this.wallTuck, Math.min(1, dt * 12));
    const tuckZ = -this.smoothedWallTuck * 0.22;
    const tuckY = -this.smoothedWallTuck * 0.08;
    const tuckRotX = -this.smoothedWallTuck * 0.38;

    // Apply combined transforms to viewmodel root
    this.root.position = new Vector3(
      0.24 + this.recoilOffset.x + this.bobOffset.x + slashOffsetX,
      -0.22 + this.recoilOffset.y + this.bobOffset.y - reloadDip + drawOffsetY + slashOffsetY + boltDipY + tuckY,
      0.48 + this.recoilOffset.z + slashOffsetZ + tuckZ
    );

    this.root.rotation = new Vector3(
      this.recoilRot.x + drawRotX + slashRotX + tuckRotX,
      this.recoilRot.y + slashRotY,
      this.recoilRot.z + this.bobOffset.x * 1.8 + slashRotZ + boltTiltZ
    );
  }

  private lerp(start: number, end: number, amt: number) {
    return (1 - amt) * start + amt * end;
  }

  public dispose() {
    this.root.dispose();
  }
}

/**
 * Low-poly stylized 3D anime waifu character model in Babylon.js.
 */
export class BabylonAvatarModel {
  public root: TransformNode;
  public headMesh: AbstractMesh;
  public bodyMesh: AbstractMesh;
  public weaponMount: TransformNode;

  private leftLeg: AbstractMesh;
  private rightLeg: AbstractMesh;
  private leftArm: AbstractMesh;
  private rightArm: AbstractMesh;

  public playerId: string | number;
  public nameplateMesh: AbstractMesh;
  private nameplateTexture: DynamicTexture;
  private scene: Scene;

  constructor(id: string | number, opts: BabylonAvatarOptions, scene: Scene, shadowGenerator?: ShadowGenerator) {
    this.playerId = id;
    this.scene = scene;
    this.root = new TransformNode(`PlayerAvatar_${id}`, scene);

    // ==================== PROCEDURAL WAIFU TEXTURES ====================
    // 1. Anime Face Texture (Big expressive gradient eyes, lashes, blush, smile)
    const faceMat = createTexturedMat(`faceMat_${id}`, scene, new Color3(1.0, 0.98, 0.98), 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ffe4d6'; // Fair anime skin base
      ctx.fillRect(0, 0, w, h);

      const eyeY = h * 0.44;
      const leftEyeX = w * 0.32;
      const rightEyeX = w * 0.68;
      const eyeW = 26;
      const eyeH = 32;

      const drawEye = (cx: number, cy: number) => {
        // Sclera
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(cx, cy, eyeW * 0.5, eyeH * 0.5, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(cx, cy, eyeW * 0.5, 0, Math.PI * 2);
        }
        ctx.fill();

        // Gradient Iris (Deep indigo to vibrant cyan)
        const irisGrad = ctx.createLinearGradient ? ctx.createLinearGradient(cx, cy - eyeH * 0.4, cx, cy + eyeH * 0.4) : null;
        if (irisGrad) {
          irisGrad.addColorStop(0.0, '#312e81');
          irisGrad.addColorStop(0.5, '#4f46e5');
          irisGrad.addColorStop(1.0, '#06b6d4');
          ctx.fillStyle = irisGrad;
        } else {
          ctx.fillStyle = '#4f46e5';
        }
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(cx, cy + 2, eyeW * 0.42, eyeH * 0.42, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(cx, cy + 2, eyeW * 0.42, 0, Math.PI * 2);
        }
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(cx, cy + 1, eyeW * 0.22, eyeH * 0.24, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(cx, cy + 1, eyeW * 0.22, 0, Math.PI * 2);
        }
        ctx.fill();

        // Primary white specular circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 5, cy - 6, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Secondary small twinkle
        ctx.beginPath();
        ctx.arc(cx + 4, cy + 5, 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Eyelashes & upper lid line
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, eyeW * 0.52, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();

        // Crease
        ctx.strokeStyle = 'rgba(120, 80, 70, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 7, eyeW * 0.48, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();
      };

      drawEye(leftEyeX, eyeY);
      drawEye(rightEyeX, eyeY);

      // Styled anime eyebrows
      ctx.strokeStyle = opts.hairColor ? opts.hairColor : '#ff6b9d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY - 18, 16, Math.PI * 1.2, Math.PI * 1.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY - 18, 16, Math.PI * 1.3, Math.PI * 1.8);
      ctx.stroke();

      // Rosy anime cheek blush
      ctx.fillStyle = 'rgba(255, 120, 149, 0.45)';
      for (let i = -1; i <= 1; i++) {
        ctx.fillRect(leftEyeX - 10 + i * 5, eyeY + 18 + i * 2, 4, 10);
        ctx.fillRect(rightEyeX - 2 + i * 5, eyeY + 18 + i * 2, 4, 10);
      }

      // Petite anime smile
      ctx.strokeStyle = '#be185d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(w / 2, eyeY + 28, 10, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }, new Color3(0.08, 0.08, 0.08), undefined, 16);

    // 2. Hair Texture with anime "Angel Ring" sheen halo
    const baseHairColor = opts.hairColor ? opts.hairColor : '#ff6b9d';
    const hairMat = createTexturedMat(`hairMat_${id}`, scene, new Color3(1.0, 1.0, 1.0), 128, 256, (ctx, w, h) => {
      ctx.fillStyle = baseHairColor;
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = (x % 8 === 0) ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.10)';
        ctx.fillRect(x, 0, 2, h);
      }
      const sheenY = h * 0.32;
      const sheenGrad = ctx.createLinearGradient ? ctx.createLinearGradient(0, sheenY - 18, 0, sheenY + 18) : null;
      if (sheenGrad) {
        sheenGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
        sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
        sheenGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = sheenGrad;
        ctx.fillRect(0, sheenY - 18, w, 36);
      }
    }, new Color3(0.2, 0.2, 0.2), undefined, 32);

    // 3. Sailor Uniform Torso Texture
    const baseOutfitColor = opts.outfitColor ? opts.outfitColor : '#1e293b';
    const outfitMat = createTexturedMat(`outfitMat_${id}`, scene, new Color3(1.0, 1.0, 1.0), 256, 256, (ctx, w, h) => {
      ctx.fillStyle = baseOutfitColor;
      ctx.fillRect(0, 0, w, h);
      // Sailor collar bib
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 0);
      ctx.lineTo(w * 0.8, 0);
      ctx.lineTo(w * 0.5, h * 0.45);
      ctx.closePath();
      ctx.fill();
      // Nautical stripes
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.25, 0);
      ctx.lineTo(w * 0.5, h * 0.38);
      ctx.lineTo(w * 0.75, 0);
      ctx.stroke();
      // Gold uniform buttons
      for (let b = 0; b < 3; b++) {
        const by = h * 0.52 + b * 26;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(w / 2, by, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(w / 2 - 1, by - 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Waistband & buckle
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, h * 0.88, w, h * 0.12);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(w * 0.44, h * 0.89, w * 0.12, h * 0.1);
    }, new Color3(0.12, 0.12, 0.12), undefined, 24);

    // 4. Pleated Skirt Texture
    const skirtMat = createTexturedMat(`skirtMat_${id}`, scene, new Color3(1.0, 1.0, 1.0), 256, 128, (ctx, w, h) => {
      ctx.fillStyle = baseOutfitColor;
      ctx.fillRect(0, 0, w, h);
      const pleats = 16;
      const pw = w / pleats;
      for (let i = 0; i < pleats; i++) {
        const px = i * pw;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(px, 0, pw * 0.35, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.fillRect(px + pw * 0.35, 0, 2, h);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, h - 16, w, 3.5);
      ctx.fillRect(0, h - 8, w, 3.5);
    }, new Color3(0.12, 0.12, 0.12), undefined, 20);

    // 5. Thigh-High Stockings & Loafers Texture
    const legsMat = createTexturedMat(`legsMat_${id}`, scene, new Color3(1.0, 1.0, 1.0), 128, 256, (ctx, w, h) => {
      // Fair skin thigh
      ctx.fillStyle = '#ffe4d6';
      ctx.fillRect(0, 0, w, h * 0.18);
      // Lace band
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, h * 0.18, w, 6);
      // Microfiber stockings
      ctx.fillStyle = '#181b24';
      ctx.fillRect(0, h * 0.22, w, h * 0.58);
      // Shin sheen
      const shinGrad = ctx.createLinearGradient ? ctx.createLinearGradient(w * 0.3, 0, w * 0.7, 0) : null;
      if (shinGrad) {
        shinGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
        shinGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.16)');
        shinGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = shinGrad;
        ctx.fillRect(w * 0.25, h * 0.25, w * 0.5, h * 0.52);
      }
      // Leather loafers & sole
      ctx.fillStyle = '#0f1014';
      ctx.fillRect(0, h * 0.80, w, h * 0.20);
      ctx.fillStyle = '#3e2415';
      ctx.fillRect(0, h - 10, w, 10);
    }, new Color3(0.2, 0.2, 0.2), undefined, 36);

    // 6. Tactical Shooter Gloves & Arms Texture
    const armsMat = createTexturedMat(`armsMat_${id}`, scene, new Color3(1.0, 1.0, 1.0), 128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ffe4d6';
      ctx.fillRect(0, 0, w, h * 0.45);
      ctx.fillStyle = '#1e232d'; // Tactical glove
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
      ctx.fillStyle = '#11141a'; // Knuckle pads
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(8 + k * 16, h * 0.65, 12, 16);
      }
      ctx.fillStyle = '#0f1116';
      ctx.fillRect(0, h * 0.48, w, 12);
      ctx.fillStyle = '#ff2b75';
      ctx.fillRect(w * 0.7, h * 0.49, 16, 10);
    }, new Color3(0.18, 0.18, 0.22), undefined, 24);

    // 7. Bow Ribbon Material
    const ribbonMat = createTexturedMat(`ribbonMat_${id}`, scene, new Color3(1.0, 0.9, 0.9), 64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#ff2b75';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#be185d';
      ctx.lineWidth = 3;
      if (ctx.strokeRect) ctx.strokeRect(2, 2, w - 4, h - 4);
    }, new Color3(0.2, 0.1, 0.15), undefined, 20);

    // Hitbox transparent material: alpha 0.001 keeps it pickable by Babylon pickWithRay
    const hitboxMat = new StandardMaterial(`hitboxMat_${id}`, scene);
    hitboxMat.alpha = 0.001;
    hitboxMat.specularColor = new Color3(0, 0, 0);

    // ==================== 1. HEAD & HAIR ====================
    // Head Sphere (Hitbox: head)
    this.headMesh = MeshBuilder.CreateSphere(`avatarHead_${id}`, { diameter: 0.52, segments: 10 }, scene);
    this.headMesh.position = new Vector3(0, 1.55, 0);
    this.headMesh.material = faceMat;
    this.headMesh.parent = this.root;
    this.headMesh.isPickable = true;
    this.headMesh.receiveShadows = true;
    this.headMesh.metadata = { isHitbox: true, part: 'head', playerId: id };

    // Hair Cap
    const hairCap = MeshBuilder.CreateSphere(`hairCap_${id}`, { diameter: 0.56, segments: 10 }, scene);
    hairCap.position = new Vector3(0, 0.05, -0.03);
    hairCap.material = hairMat;
    hairCap.parent = this.headMesh;
    hairCap.isPickable = true;
    hairCap.metadata = { isHitbox: true, part: 'head', playerId: id };

    // Hair Bangs (anime waifu silhouette)
    const hairBangs = MeshBuilder.CreateBox(`hairBangs_${id}`, { width: 0.44, height: 0.18, depth: 0.18 }, scene);
    hairBangs.position = new Vector3(0, 0.14, 0.19);
    hairBangs.rotation.x = -0.25;
    hairBangs.material = hairMat;
    hairBangs.parent = this.headMesh;
    hairBangs.isPickable = false;

    // Twin tails
    const leftTail = MeshBuilder.CreateCylinder(`lTail_${id}`, { height: 0.5, diameterTop: 0.18, diameterBottom: 0.02 }, scene);
    leftTail.position = new Vector3(-0.28, 0.05, -0.08);
    leftTail.rotation.z = 0.38;
    leftTail.material = hairMat;
    leftTail.parent = this.headMesh;
    leftTail.isPickable = true;
    leftTail.metadata = { isHitbox: true, part: 'head', playerId: id };

    const rightTail = MeshBuilder.CreateCylinder(`rTail_${id}`, { height: 0.5, diameterTop: 0.18, diameterBottom: 0.02 }, scene);
    rightTail.position = new Vector3(0.28, 0.05, -0.08);
    rightTail.rotation.z = -0.38;
    rightTail.material = hairMat;
    rightTail.parent = this.headMesh;
    rightTail.isPickable = true;
    rightTail.metadata = { isHitbox: true, part: 'head', playerId: id };

    // Generous head hitbox volume for reliable hit registration
    const headHitbox = MeshBuilder.CreateSphere(`hitboxHead_${id}`, { diameter: 0.68, segments: 6 }, scene);
    headHitbox.position = new Vector3(0, 1.55, 0);
    headHitbox.material = hitboxMat;
    headHitbox.visibility = 0.999;
    headHitbox.isPickable = true;
    headHitbox.metadata = { isHitbox: true, part: 'head', playerId: id };
    headHitbox.parent = this.root;

    // ==================== 2. TORSO & SKIRT ====================
    // Body Box (Hitbox: torso)
    this.bodyMesh = MeshBuilder.CreateBox(`avatarBody_${id}`, { width: 0.44, height: 0.55, depth: 0.26 }, scene);
    this.bodyMesh.position = new Vector3(0, 1.15, 0);
    this.bodyMesh.material = outfitMat;
    this.bodyMesh.parent = this.root;
    this.bodyMesh.isPickable = true;
    this.bodyMesh.receiveShadows = true;
    this.bodyMesh.metadata = { isHitbox: true, part: 'torso', playerId: id };

    // Front Bow Ribbon
    const ribbonMesh = MeshBuilder.CreateBox(`ribbon_${id}`, { width: 0.18, height: 0.12, depth: 0.08 }, scene);
    ribbonMesh.position = new Vector3(0, 0.16, 0.15);
    ribbonMesh.material = ribbonMat;
    ribbonMesh.parent = this.bodyMesh;
    ribbonMesh.isPickable = false;

    // Skirt
    const skirt = MeshBuilder.CreateCylinder(`skirt_${id}`, { height: 0.26, diameterTop: 0.45, diameterBottom: 0.65, tessellation: 10 }, scene);
    skirt.position = new Vector3(0, -0.32, 0);
    skirt.material = skirtMat;
    skirt.parent = this.bodyMesh;
    skirt.isPickable = true;
    skirt.receiveShadows = true;
    skirt.metadata = { isHitbox: true, part: 'torso', playerId: id };

    // Torso Hitbox Volume
    const torsoHitbox = MeshBuilder.CreateBox(`hitboxTorso_${id}`, { width: 0.62, height: 0.72, depth: 0.44 }, scene);
    torsoHitbox.position = new Vector3(0, 1.12, 0);
    torsoHitbox.material = hitboxMat;
    torsoHitbox.visibility = 0.999;
    torsoHitbox.isPickable = true;
    torsoHitbox.metadata = { isHitbox: true, part: 'torso', playerId: id };
    torsoHitbox.parent = this.root;

    // ==================== 3. LEGS & LIMBS ====================
    this.leftLeg = MeshBuilder.CreateBox(`lLeg_${id}`, { width: 0.15, height: 0.74, depth: 0.17 }, scene);
    this.leftLeg.position = new Vector3(-0.13, 0.42, 0);
    this.leftLeg.material = legsMat;
    this.leftLeg.parent = this.root;
    this.leftLeg.isPickable = true;
    this.leftLeg.receiveShadows = true;
    this.leftLeg.metadata = { isHitbox: true, part: 'limb', playerId: id };

    this.rightLeg = MeshBuilder.CreateBox(`rLeg_${id}`, { width: 0.15, height: 0.74, depth: 0.17 }, scene);
    this.rightLeg.position = new Vector3(0.13, 0.42, 0);
    this.rightLeg.material = legsMat;
    this.rightLeg.parent = this.root;
    this.rightLeg.isPickable = true;
    this.rightLeg.receiveShadows = true;
    this.rightLeg.metadata = { isHitbox: true, part: 'limb', playerId: id };

    // ==================== 4. ARMS & WEAPON MOUNT ====================
    this.leftArm = MeshBuilder.CreateBox(`lArm_${id}`, { width: 0.12, height: 0.46, depth: 0.13 }, scene);
    this.leftArm.position = new Vector3(-0.29, 1.15, 0);
    this.leftArm.material = armsMat;
    this.leftArm.parent = this.root;
    this.leftArm.isPickable = true;
    this.leftArm.metadata = { isHitbox: true, part: 'limb', playerId: id };

    this.rightArm = MeshBuilder.CreateBox(`rArm_${id}`, { width: 0.12, height: 0.46, depth: 0.13 }, scene);
    this.rightArm.position = new Vector3(0.29, 1.15, 0);
    this.rightArm.material = armsMat;
    this.rightArm.parent = this.root;
    this.rightArm.isPickable = true;
    this.rightArm.metadata = { isHitbox: true, part: 'limb', playerId: id };

    // Limbs Hitbox Volume
    const limbsHitbox = MeshBuilder.CreateBox(`hitboxLimbs_${id}`, { width: 0.65, height: 0.78, depth: 0.42 }, scene);
    limbsHitbox.position = new Vector3(0, 0.4, 0);
    limbsHitbox.material = hitboxMat;
    limbsHitbox.visibility = 0.999;
    limbsHitbox.isPickable = true;
    limbsHitbox.metadata = { isHitbox: true, part: 'limb', playerId: id };
    limbsHitbox.parent = this.root;

    // Real-time Shadow Casting for character avatar
    const shadowGen = shadowGenerator || (scene.lights.map((l) => l.getShadowGenerator()).find(Boolean) as ShadowGenerator | undefined);
    if (shadowGen) {
      shadowGen.addShadowCaster(this.headMesh);
      shadowGen.addShadowCaster(hairCap);
      shadowGen.addShadowCaster(hairBangs);
      shadowGen.addShadowCaster(leftTail);
      shadowGen.addShadowCaster(rightTail);
      shadowGen.addShadowCaster(this.bodyMesh);
      shadowGen.addShadowCaster(skirt);
      shadowGen.addShadowCaster(ribbonMesh);
      shadowGen.addShadowCaster(this.leftLeg);
      shadowGen.addShadowCaster(this.rightLeg);
      shadowGen.addShadowCaster(this.leftArm);
      shadowGen.addShadowCaster(this.rightArm);
    }

    this.weaponMount = new TransformNode(`avatarWeaponMount_${id}`, scene);
    this.weaponMount.position = new Vector3(0.25, 1.05, 0.28);
    this.weaponMount.parent = this.root;

    // 3D Billboard Nameplate & Health Bar
    const nameplateMat = new StandardMaterial(`nameplateMat_${id}`, scene);
    this.nameplateTexture = new DynamicTexture(`nameplateTex_${id}`, { width: 256, height: 64 }, scene, false);
    nameplateMat.diffuseTexture = this.nameplateTexture;
    nameplateMat.specularColor = new Color3(0, 0, 0);
    nameplateMat.emissiveColor = new Color3(1, 1, 1);
    nameplateMat.backFaceCulling = false;

    this.nameplateMesh = MeshBuilder.CreatePlane(`nameplate_${id}`, { width: 1.4, height: 0.35 }, scene);
    this.nameplateMesh.position = new Vector3(0, 2.15, 0);
    this.nameplateMesh.parent = this.root;
    this.nameplateMesh.material = nameplateMat;
    this.nameplateMesh.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
    this.nameplateMesh.isPickable = false;

    this.updateNameplate(opts.name || 'Player', 150, 150);

    this.setWeapon('rifle');
  }

  // Attack animation state
  private attackProgress = 0;
  private attackWeaponId: WeaponId = 'rifle';
  private walkCycle = 0;

  public setWeapon(weaponId: WeaponId) {
    const children = this.weaponMount.getChildren();
    for (const child of children) {
      child.dispose();
    }
    const mesh = createBabylonWeaponMesh(weaponId, this.scene);
    mesh.scaling = new Vector3(0.85, 0.85, 0.85);
    mesh.parent = this.weaponMount;
  }

  public setPitch(pitch: number) {
    const clamped = Math.max(-0.85, Math.min(0.85, pitch));
    this.headMesh.rotation.x = clamped;
    if (this.weaponMount) {
      this.weaponMount.rotation.x = clamped * 0.75;
    }
  }

  public updateAnimation(animState: number, dt: number, pitch?: number) {
    if (pitch !== undefined) {
      this.setPitch(pitch);
    }
    if (animState === 1 || animState === 2) {
      // Walking / running: swing legs and arms smoothly
      const freq = animState === 2 ? 10 : 6;
      this.walkCycle += dt * freq;
      const legAngle = Math.sin(this.walkCycle) * 0.55;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;

      this.leftArm.rotation.x = -legAngle * 0.6;
      this.rightArm.rotation.x = legAngle * 0.4;
    } else {
      // Idle pose
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = -0.3; // Aiming forward
    }

    // Third-person attack animation
    if (this.attackProgress > 0) {
      this.attackProgress -= dt * 4.0;
      if (this.attackProgress <= 0) this.attackProgress = 0;
      const ap = Math.sin(this.attackProgress * Math.PI);
      if (this.attackWeaponId === 'knife') {
        this.rightArm.rotation.x = -0.3 - ap * 1.1; // Forward slash
        this.rightArm.rotation.y = ap * 0.55;
      } else {
        this.rightArm.rotation.x = -0.3 + ap * 0.45; // Gunfire recoil
      }
    } else {
      this.rightArm.rotation.y = 0;
    }
  }

  public updateNameplate(name: string, hp: number, maxHp = 150) {
    if (!this.nameplateTexture) return;
    const ctx = this.nameplateTexture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 64);

    // Background rounded pill
    ctx.fillStyle = 'rgba(12, 16, 23, 0.85)';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(4, 4, 248, 56, 10);
    } else {
      ctx.rect(4, 4, 248, 56);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 206, 201, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Name text
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, 16), 128, 26);

    // Health bar track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(24, 34, 208, 16);

    // Health bar fill
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    ctx.fillStyle = pct > 0.5 ? '#2ed573' : pct > 0.25 ? '#ffa502' : '#ff4757';
    ctx.fillRect(24, 34, Math.round(208 * pct), 16);

    // Health text
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${hp} HP`, 128, 47);

    this.nameplateTexture.update();
  }

  public setVisible(visible: boolean) {
    this.root.setEnabled(visible);
    const meshes = this.root.getChildMeshes(false);
    for (const m of meshes) {
      m.isVisible = visible;
      m.isPickable = visible;
    }
  }

  public dispose() {
    this.nameplateTexture?.dispose();
    this.root.dispose();
  }
}

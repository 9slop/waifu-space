import {
  Scene,
  Vector3,
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  AbstractMesh,
  Camera,
  DynamicTexture
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
 * Creates low-poly 3D weapon meshes for Babylon.js first-person viewmodel or third-person avatar hands.
 */
export function createBabylonWeaponMesh(weaponId: WeaponId, scene: Scene): TransformNode {
  const root = new TransformNode(`WeaponRoot_${weaponId}_${Math.random()}`, scene);

  // Materials
  const darkMetal = new StandardMaterial(`darkMetal_${weaponId}`, scene);
  darkMetal.diffuseColor = new Color3(0.16, 0.18, 0.22);
  darkMetal.specularColor = new Color3(0.3, 0.3, 0.3);

  const lightMetal = new StandardMaterial(`lightMetal_${weaponId}`, scene);
  lightMetal.diffuseColor = new Color3(0.42, 0.46, 0.52);

  const accentPink = new StandardMaterial(`accentPink_${weaponId}`, scene);
  accentPink.diffuseColor = new Color3(1.0, 0.42, 0.62);
  accentPink.emissiveColor = new Color3(0.3, 0.08, 0.15);

  const goldMat = new StandardMaterial(`goldMat_${weaponId}`, scene);
  goldMat.diffuseColor = new Color3(0.95, 0.76, 0.24);

  if (weaponId === 'rifle') {
    // Receiver
    const body = MeshBuilder.CreateBox('rifleBody', { width: 0.08, height: 0.12, depth: 0.45 }, scene);
    body.material = darkMetal;
    body.parent = root;

    // Barrel
    const barrel = MeshBuilder.CreateCylinder('rifleBarrel', { height: 0.38, diameter: 0.035 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new Vector3(0, 0.02, 0.38);
    barrel.material = lightMetal;
    barrel.parent = root;

    // Curved Magazine
    const mag = MeshBuilder.CreateBox('rifleMag', { width: 0.05, height: 0.22, depth: 0.09 }, scene);
    mag.position = new Vector3(0, -0.12, 0.06);
    mag.rotation.x = -0.25;
    mag.material = accentPink;
    mag.parent = root;

    // Stock
    const stock = MeshBuilder.CreateBox('rifleStock', { width: 0.07, height: 0.14, depth: 0.22 }, scene);
    stock.position = new Vector3(0, -0.02, -0.3);
    stock.material = darkMetal;
    stock.parent = root;

    // Iron Sights
    const sight = MeshBuilder.CreateBox('rifleSight', { width: 0.04, height: 0.05, depth: 0.08 }, scene);
    sight.position = new Vector3(0, 0.08, 0.1);
    sight.material = accentPink;
    sight.parent = root;
  } else if (weaponId === 'sniper') {
    // Sleek long body
    const body = MeshBuilder.CreateBox('sniperBody', { width: 0.09, height: 0.13, depth: 0.65 }, scene);
    body.material = darkMetal;
    body.parent = root;

    // Heavy long barrel
    const barrel = MeshBuilder.CreateCylinder('sniperBarrel', { height: 0.65, diameter: 0.04 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new Vector3(0, 0.02, 0.58);
    barrel.material = lightMetal;
    barrel.parent = root;

    // Muzzle Brake
    const brake = MeshBuilder.CreateBox('sniperBrake', { width: 0.06, height: 0.06, depth: 0.1 }, scene);
    brake.position = new Vector3(0, 0.02, 0.92);
    brake.material = accentPink;
    brake.parent = root;

    // Large Sniper Scope
    const scopeTube = MeshBuilder.CreateCylinder('sniperScope', { height: 0.35, diameter: 0.07 }, scene);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position = new Vector3(0, 0.12, 0.05);
    scopeTube.material = darkMetal;
    scopeTube.parent = root;

    // Scope Lens accent ring
    const lensFront = MeshBuilder.CreateCylinder('sniperLens', { height: 0.05, diameter: 0.085 }, scene);
    lensFront.rotation.x = Math.PI / 2;
    lensFront.position = new Vector3(0, 0.12, 0.22);
    lensFront.material = accentPink;
    lensFront.parent = root;

    // Sniper Stock
    const stock = MeshBuilder.CreateBox('sniperStock', { width: 0.07, height: 0.16, depth: 0.32 }, scene);
    stock.position = new Vector3(0, -0.02, -0.45);
    stock.material = darkMetal;
    stock.parent = root;
  } else if (weaponId === 'pistol') {
    // Slide
    const slide = MeshBuilder.CreateBox('pistolSlide', { width: 0.06, height: 0.08, depth: 0.24 }, scene);
    slide.material = lightMetal;
    slide.parent = root;

    // Grip
    const grip = MeshBuilder.CreateBox('pistolGrip', { width: 0.05, height: 0.16, depth: 0.09 }, scene);
    grip.position = new Vector3(0, -0.1, -0.05);
    grip.rotation.x = -0.2;
    grip.material = accentPink;
    grip.parent = root;
  } else if (weaponId === 'knife') {
    // Blade
    const blade = MeshBuilder.CreateBox('knifeBlade', { width: 0.02, height: 0.06, depth: 0.28 }, scene);
    blade.position = new Vector3(0, 0, 0.14);
    blade.material = goldMat;
    blade.parent = root;

    // Guard
    const guard = MeshBuilder.CreateBox('knifeGuard', { width: 0.08, height: 0.02, depth: 0.04 }, scene);
    guard.material = darkMetal;
    guard.parent = root;

    // Handle
    const handle = MeshBuilder.CreateCylinder('knifeHandle', { height: 0.14, diameter: 0.03 }, scene);
    handle.rotation.x = Math.PI / 2;
    handle.position = new Vector3(0, 0, -0.09);
    handle.material = accentPink;
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
  private meleeProgress = 0;
  private meleeSlashSide = 1;

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

    // Trigger weapon equip / draw animation
    this.drawProgress = 1.0;
    this.isMeleeAttacking = false;
    this.meleeProgress = 0;
    this.boltActionProgress = 0;
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  /**
   * Triggers visual weapon attack animation (knife slash or gun recoil).
   */
  public triggerAttack(weaponId: WeaponId, vertical = 0.03, horizontal = 0.015) {
    if (weaponId === 'knife') {
      // Dynamic anime knife slash/thrust animation
      this.isMeleeAttacking = true;
      this.meleeProgress = 1.0;
      this.meleeSlashSide = -this.meleeSlashSide; // alternate left/right slashes
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

    // 3. Melee Knife Slash Animation
    let slashOffsetX = 0;
    let slashOffsetY = 0;
    let slashOffsetZ = 0;
    let slashRotX = 0;
    let slashRotY = 0;
    let slashRotZ = 0;

    if (this.isMeleeAttacking) {
      this.meleeProgress -= dt * 3.8; // ~0.26s total swing duration
      if (this.meleeProgress <= 0) {
        this.isMeleeAttacking = false;
        this.meleeProgress = 0;
      }
      const p = Math.sin(this.meleeProgress * Math.PI); // Smooth 0 -> 1 -> 0 arc
      slashOffsetX = this.meleeSlashSide * p * -0.16;
      slashOffsetY = -p * 0.05;
      slashOffsetZ = p * 0.24; // Big forward stab/thrust
      slashRotX = p * 0.35;
      slashRotY = this.meleeSlashSide * p * -0.65;
      slashRotZ = this.meleeSlashSide * p * 0.85;
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

    // Apply combined transforms to viewmodel root
    this.root.position = new Vector3(
      0.24 + this.recoilOffset.x + this.bobOffset.x + slashOffsetX,
      -0.22 + this.recoilOffset.y + this.bobOffset.y - reloadDip + drawOffsetY + slashOffsetY + boltDipY,
      0.48 + this.recoilOffset.z + slashOffsetZ
    );

    this.root.rotation = new Vector3(
      this.recoilRot.x + drawRotX + slashRotX,
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

  constructor(id: string | number, opts: BabylonAvatarOptions, scene: Scene) {
    this.playerId = id;
    this.scene = scene;
    this.root = new TransformNode(`PlayerAvatar_${id}`, scene);

    const skinMat = new StandardMaterial(`skinMat_${id}`, scene);
    skinMat.diffuseColor = new Color3(1.0, 0.90, 0.72);

    const hairMat = new StandardMaterial(`hairMat_${id}`, scene);
    hairMat.diffuseColor = opts.hairColor
      ? Color3.FromHexString(opts.hairColor)
      : new Color3(1.0, 0.45, 0.62);

    const outfitMat = new StandardMaterial(`outfitMat_${id}`, scene);
    outfitMat.diffuseColor = opts.outfitColor
      ? Color3.FromHexString(opts.outfitColor)
      : new Color3(0.18, 0.20, 0.26);

    const whiteMat = new StandardMaterial(`whiteMat_${id}`, scene);
    whiteMat.diffuseColor = new Color3(0.95, 0.95, 0.95);

    // Hitbox transparent material: alpha 0.001 keeps it pickable by Babylon pickWithRay
    const hitboxMat = new StandardMaterial(`hitboxMat_${id}`, scene);
    hitboxMat.alpha = 0.001;
    hitboxMat.specularColor = new Color3(0, 0, 0);

    // ==================== 1. HEAD & HAIR ====================
    // Head Sphere (Hitbox: head)
    this.headMesh = MeshBuilder.CreateSphere(`avatarHead_${id}`, { diameter: 0.52, segments: 10 }, scene);
    this.headMesh.position = new Vector3(0, 1.55, 0);
    this.headMesh.material = skinMat;
    this.headMesh.parent = this.root;
    this.headMesh.isPickable = true;
    this.headMesh.metadata = { isHitbox: true, part: 'head', playerId: id };

    // Hair Cap
    const hairCap = MeshBuilder.CreateSphere(`hairCap_${id}`, { diameter: 0.56, segments: 10 }, scene);
    hairCap.position = new Vector3(0, 0.05, -0.03);
    hairCap.material = hairMat;
    hairCap.parent = this.headMesh;
    hairCap.isPickable = true;
    hairCap.metadata = { isHitbox: true, part: 'head', playerId: id };

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

    // Anime Eyes
    const eyeMat = new StandardMaterial(`eyeMat_${id}`, scene);
    eyeMat.diffuseColor = new Color3(0.15, 0.15, 0.2);
    eyeMat.emissiveColor = new Color3(0.15, 0.15, 0.2);

    const leftEye = MeshBuilder.CreatePlane(`lEye_${id}`, { size: 0.07 }, scene);
    leftEye.position = new Vector3(-0.09, 0.02, 0.25);
    leftEye.material = eyeMat;
    leftEye.parent = this.headMesh;
    leftEye.isPickable = false;

    const rightEye = MeshBuilder.CreatePlane(`rEye_${id}`, { size: 0.07 }, scene);
    rightEye.position = new Vector3(0.09, 0.02, 0.25);
    rightEye.material = eyeMat;
    rightEye.parent = this.headMesh;
    rightEye.isPickable = false;

    // Generous head hitbox volume for reliable hit registration (visibility > 0 so pickWithRay hits it)
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
    this.bodyMesh.metadata = { isHitbox: true, part: 'torso', playerId: id };

    // Skirt
    const skirt = MeshBuilder.CreateCylinder(`skirt_${id}`, { height: 0.26, diameterTop: 0.45, diameterBottom: 0.65, tessellation: 10 }, scene);
    skirt.position = new Vector3(0, -0.32, 0);
    skirt.material = outfitMat;
    skirt.parent = this.bodyMesh;
    skirt.isPickable = true;
    skirt.metadata = { isHitbox: true, part: 'torso', playerId: id };

    // Torso Hitbox Volume (visibility > 0 so pickWithRay hits it)
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
    this.leftLeg.material = whiteMat;
    this.leftLeg.parent = this.root;
    this.leftLeg.isPickable = true;
    this.leftLeg.metadata = { isHitbox: true, part: 'limb', playerId: id };

    this.rightLeg = MeshBuilder.CreateBox(`rLeg_${id}`, { width: 0.15, height: 0.74, depth: 0.17 }, scene);
    this.rightLeg.position = new Vector3(0.13, 0.42, 0);
    this.rightLeg.material = whiteMat;
    this.rightLeg.parent = this.root;
    this.rightLeg.isPickable = true;
    this.rightLeg.metadata = { isHitbox: true, part: 'limb', playerId: id };

    // ==================== 4. ARMS & WEAPON MOUNT ====================
    this.leftArm = MeshBuilder.CreateBox(`lArm_${id}`, { width: 0.12, height: 0.46, depth: 0.13 }, scene);
    this.leftArm.position = new Vector3(-0.29, 1.15, 0);
    this.leftArm.material = skinMat;
    this.leftArm.parent = this.root;
    this.leftArm.isPickable = true;
    this.leftArm.metadata = { isHitbox: true, part: 'limb', playerId: id };

    this.rightArm = MeshBuilder.CreateBox(`rArm_${id}`, { width: 0.12, height: 0.46, depth: 0.13 }, scene);
    this.rightArm.position = new Vector3(0.29, 1.15, 0);
    this.rightArm.material = skinMat;
    this.rightArm.parent = this.root;
    this.rightArm.isPickable = true;
    this.rightArm.metadata = { isHitbox: true, part: 'limb', playerId: id };

    // Limbs Hitbox Volume (visibility > 0 so pickWithRay hits it)
    const limbsHitbox = MeshBuilder.CreateBox(`hitboxLimbs_${id}`, { width: 0.65, height: 0.78, depth: 0.42 }, scene);
    limbsHitbox.position = new Vector3(0, 0.4, 0);
    limbsHitbox.material = hitboxMat;
    limbsHitbox.visibility = 0.999;
    limbsHitbox.isPickable = true;
    limbsHitbox.metadata = { isHitbox: true, part: 'limb', playerId: id };
    limbsHitbox.parent = this.root;

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

  public triggerAttack(weaponId: WeaponId) {
    this.attackProgress = 1.0;
    this.attackWeaponId = weaponId;
  }

  public updateAnimation(animState: number, dt: number) {
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

  public dispose() {
    this.nameplateTexture?.dispose();
    this.root.dispose();
  }
}

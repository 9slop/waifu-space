import {
  Scene,
  Vector3,
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  AbstractMesh,
  Camera
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

  private recoilOffset = new Vector3(0, 0, 0);
  private recoilRot = new Vector3(0, 0, 0);
  private bobOffset = new Vector3(0, 0, 0);
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
  }

  public triggerRecoil(vertical = 0.03, horizontal = 0.015) {
    this.recoilOffset.z -= 0.06;
    this.recoilOffset.y += vertical * 0.4;
    this.recoilRot.x -= vertical * 1.6;
    this.recoilRot.y += (Math.random() - 0.5) * horizontal * 2;
  }

  public triggerReload(reloadTimeMs: number) {
    this.isReloading = true;
    this.reloadProgress = 1.0;
  }

  public update(dt: number, isMoving: boolean, speedNorm: number) {
    // 1. Recoil spring recovery
    this.recoilOffset = Vector3.Lerp(this.recoilOffset, Vector3.Zero(), dt * 15);
    this.recoilRot.x = this.lerp(this.recoilRot.x, 0, dt * 15);
    this.recoilRot.y = this.lerp(this.recoilRot.y, 0, dt * 15);

    // 2. Weapon bobbing while moving
    if (isMoving && speedNorm > 0.1) {
      const time = performance.now() * 0.008 * speedNorm;
      this.bobOffset.x = Math.sin(time) * 0.014;
      this.bobOffset.y = Math.cos(time * 2) * 0.009;
    } else {
      this.bobOffset = Vector3.Lerp(this.bobOffset, Vector3.Zero(), dt * 8);
    }

    // 3. Reload animation (dip down and return)
    if (this.isReloading) {
      this.reloadProgress -= dt * 1.3;
      if (this.reloadProgress <= 0) {
        this.isReloading = false;
        this.reloadProgress = 0;
      }
    }
    const reloadDip = Math.sin(this.reloadProgress * Math.PI) * 0.22;

    this.root.position = new Vector3(
      0.24 + this.recoilOffset.x + this.bobOffset.x,
      -0.22 + this.recoilOffset.y + this.bobOffset.y - reloadDip,
      0.48 + this.recoilOffset.z
    );

    this.root.rotation = new Vector3(
      this.recoilRot.x,
      this.recoilRot.y,
      this.bobOffset.x * 2
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

    // Generous head hitbox volume for reliable hit registration
    const headHitbox = MeshBuilder.CreateSphere(`hitboxHead_${id}`, { diameter: 0.68, segments: 6 }, scene);
    headHitbox.position = new Vector3(0, 1.55, 0);
    headHitbox.visibility = 0;
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

    // Torso Hitbox Volume
    const torsoHitbox = MeshBuilder.CreateBox(`hitboxTorso_${id}`, { width: 0.62, height: 0.72, depth: 0.44 }, scene);
    torsoHitbox.position = new Vector3(0, 1.12, 0);
    torsoHitbox.visibility = 0;
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

    // Limbs Hitbox Volume
    const limbsHitbox = MeshBuilder.CreateBox(`hitboxLimbs_${id}`, { width: 0.65, height: 0.78, depth: 0.42 }, scene);
    limbsHitbox.position = new Vector3(0, 0.4, 0);
    limbsHitbox.visibility = 0;
    limbsHitbox.isPickable = true;
    limbsHitbox.metadata = { isHitbox: true, part: 'limb', playerId: id };
    limbsHitbox.parent = this.root;

    this.weaponMount = new TransformNode(`avatarWeaponMount_${id}`, scene);
    this.weaponMount.position = new Vector3(0.25, 1.05, 0.28);
    this.weaponMount.parent = this.root;

    this.setWeapon('rifle');
  }

  public setWeapon(weaponId: WeaponId) {
    const children = this.weaponMount.getChildren();
    for (const child of children) {
      child.dispose();
    }
    const mesh = createBabylonWeaponMesh(weaponId, this.scene);
    mesh.scaling = new Vector3(0.85, 0.85, 0.85);
    mesh.parent = this.weaponMount;
  }

  public updateAnimation(animState: number, timeSec: number) {
    if (animState === 1 || animState === 2) {
      // Walking / running: swing legs and arms
      const freq = animState === 2 ? 10 : 6;
      const legAngle = Math.sin(timeSec * freq) * 0.55;
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
  }

  public dispose() {
    this.root.dispose();
  }
}

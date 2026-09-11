import * as THREE from 'three';
import { WeaponId } from './strike-types';
import { WEAPON_CATALOG } from './strike-weapons';

export interface AvatarOptions {
  name: string;
  hairColor?: string;
  outfitColor?: string;
  skinColor?: string;
  hairstyle?: 'twintails' | 'ponytail' | 'long' | 'short';
}

/**
 * Creates a low-poly 3D weapon model for first-person view or third-person hand attachment.
 */
export function createWeaponMesh(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();
  group.name = `WeaponMesh_${weaponId}`;

  const darkMetal = new THREE.MeshLambertMaterial({ color: 0x2d3436 });
  const lightMetal = new THREE.MeshLambertMaterial({ color: 0x636e72 });
  const accentPink = new THREE.MeshBasicMaterial({ color: 0xff7597 });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xfdcb6e });

  if (weaponId === 'rifle') {
    // Receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.45), darkMetal);
    group.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), lightMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.35);
    group.add(barrel);

    // Curved magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), accentPink);
    mag.position.set(0, -0.12, -0.05);
    mag.rotation.x = 0.25;
    group.add(mag);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.22), darkMetal);
    stock.position.set(0, -0.02, 0.3);
    group.add(stock);

    // Iron sights / holo
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.08), accentPink);
    sight.position.set(0, 0.08, -0.1);
    group.add(sight);
  } else if (weaponId === 'sniper') {
    // Sleek long body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.65), darkMetal);
    group.add(body);

    // Heavy long barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8), lightMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.55);
    group.add(barrel);

    // Muzzle brake
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.1), accentPink);
    brake.position.set(0, 0.02, -0.85);
    group.add(brake);

    // Large Sniper Scope
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 12), darkMetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.11, -0.05);
    group.add(scopeTube);

    // Scope lens accents
    const lensFront = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.05, 12), accentPink);
    lensFront.rotation.x = Math.PI / 2;
    lensFront.position.set(0, 0.11, -0.21);
    group.add(lensFront);

    // Long sniper stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.3), darkMetal);
    stock.position.set(0, -0.02, 0.45);
    group.add(stock);
  } else if (weaponId === 'pistol') {
    // Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.24), lightMetal);
    group.add(slide);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.09), accentPink);
    grip.position.set(0, -0.1, 0.05);
    grip.rotation.x = 0.2;
    group.add(grip);
  } else if (weaponId === 'knife') {
    // Blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.28), goldMat);
    blade.position.set(0, 0, -0.14);
    group.add(blade);

    // Guard
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.04), darkMetal);
    guard.position.set(0, 0, 0);
    group.add(guard);

    // Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), accentPink);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, 0.09);
    group.add(handle);
  }

  return group;
}

/**
 * First-person viewmodel holding the active weapon.
 * Attached directly to camera; renders floating anime arms with sway and recoil.
 */
export class FirstPersonViewmodel {
  public root: THREE.Group;
  private weaponMeshGroup: THREE.Group;
  private currentWeaponId: WeaponId = 'rifle';

  private recoilOffset = new THREE.Vector3();
  private recoilRot = new THREE.Euler();
  private bobOffset = new THREE.Vector3();
  private reloadProgress = 0;
  private isReloading = false;

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'FirstPersonViewmodel';

    this.weaponMeshGroup = new THREE.Group();
    this.root.add(this.weaponMeshGroup);

    // Default position relative to camera: right hand, slightly down and forward
    this.root.position.set(0.24, -0.22, -0.45);

    this.setWeapon('rifle');
  }

  public setWeapon(id: WeaponId) {
    this.currentWeaponId = id;
    while (this.weaponMeshGroup.children.length > 0) {
      this.weaponMeshGroup.remove(this.weaponMeshGroup.children[0]);
    }
    const mesh = createWeaponMesh(id);
    const def = WEAPON_CATALOG[id];
    mesh.scale.setScalar(def.viewmodelScale);
    this.weaponMeshGroup.add(mesh);
  }

  public triggerRecoil(vertical = 0.03, horizontal = 0.015) {
    this.recoilOffset.z += 0.05;
    this.recoilOffset.y += vertical * 0.5;
    this.recoilRot.x -= vertical * 1.5;
    this.recoilRot.y += (Math.random() - 0.5) * horizontal * 2;
  }

  public triggerReload(reloadTimeMs: number) {
    this.isReloading = true;
    this.reloadProgress = 1.0;
  }

  public update(dt: number, isMoving: boolean, speedNorm: number) {
    // 1. Recoil spring recovery
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), dt * 15);
    this.recoilRot.x = THREE.MathUtils.lerp(this.recoilRot.x, 0, dt * 15);
    this.recoilRot.y = THREE.MathUtils.lerp(this.recoilRot.y, 0, dt * 15);

    // 2. Weapon bobbing while moving
    if (isMoving && speedNorm > 0.1) {
      const time = performance.now() * 0.008 * speedNorm;
      this.bobOffset.x = Math.sin(time) * 0.015;
      this.bobOffset.y = Math.cos(time * 2) * 0.01;
    } else {
      this.bobOffset.lerp(new THREE.Vector3(0, 0, 0), dt * 8);
    }

    // 3. Reload animation (dip down and return)
    if (this.isReloading) {
      this.reloadProgress -= dt * 1.2;
      if (this.reloadProgress <= 0) {
        this.isReloading = false;
        this.reloadProgress = 0;
      }
    }
    const reloadDip = Math.sin(this.reloadProgress * Math.PI) * 0.2;

    this.root.position.set(
      0.24 + this.recoilOffset.x + this.bobOffset.x,
      -0.22 + this.recoilOffset.y + this.bobOffset.y - reloadDip,
      -0.45 + this.recoilOffset.z
    );

    this.root.rotation.set(
      this.recoilRot.x,
      this.recoilRot.y,
      this.bobOffset.x * 2
    );
  }
}

/**
 * Third-person stylized anime character model used for opponents and bots.
 */
export class ThirdPersonAvatarModel {
  public root: THREE.Group;
  public headMesh: THREE.Mesh;
  public bodyMesh: THREE.Mesh;
  public weaponMount: THREE.Group;

  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;

  public playerId: number;

  constructor(id: number, opts: AvatarOptions) {
    this.playerId = id;
    this.root = new THREE.Group();
    this.root.name = `PlayerAvatar_${id}`;

    const skinColor = opts.skinColor ? new THREE.Color(opts.skinColor) : new THREE.Color('#ffeaa7');
    const hairColor = opts.hairColor ? new THREE.Color(opts.hairColor) : new THREE.Color('#ff7597');
    const outfitColor = opts.outfitColor ? new THREE.Color(opts.outfitColor) : new THREE.Color('#2d3436');

    const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const hairMat = new THREE.MeshLambertMaterial({ color: hairColor });
    const outfitMat = new THREE.MeshLambertMaterial({ color: outfitColor });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // 1. HEAD & HAIR (Height: ~1.55m)
    const headGeo = new THREE.SphereGeometry(0.24, 12, 10);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.set(0, 1.55, 0);
    this.headMesh.castShadow = true;
    this.root.add(this.headMesh);

    // Hair cap
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), hairMat);
    hairCap.position.set(0, 0.05, -0.02);
    this.headMesh.add(hairCap);

    // Twintails / Ponytail
    const tailGeo = new THREE.ConeGeometry(0.09, 0.45, 6);
    const leftTail = new THREE.Mesh(tailGeo, hairMat);
    leftTail.position.set(-0.25, 0.05, -0.05);
    leftTail.rotation.z = 0.4;
    this.headMesh.add(leftTail);

    const rightTail = new THREE.Mesh(tailGeo, hairMat);
    rightTail.position.set(0.25, 0.05, -0.05);
    rightTail.rotation.z = -0.4;
    this.headMesh.add(rightTail);

    // Cute stylized anime eye planes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2d3436 });
    const leftEye = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), eyeMat);
    leftEye.position.set(-0.08, 0, 0.23);
    this.headMesh.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), eyeMat);
    rightEye.position.set(0.08, 0, 0.23);
    this.headMesh.add(rightEye);

    // 2. TORSO (Height: 0.9m to 1.35m)
    const torsoGeo = new THREE.BoxGeometry(0.42, 0.52, 0.24);
    this.bodyMesh = new THREE.Mesh(torsoGeo, outfitMat);
    this.bodyMesh.position.set(0, 1.15, 0);
    this.bodyMesh.castShadow = true;
    this.root.add(this.bodyMesh);

    // Skirt
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.25, 8), outfitMat);
    skirt.position.set(0, -0.32, 0);
    this.bodyMesh.add(skirt);

    // 3. LEGS
    const legGeo = new THREE.BoxGeometry(0.14, 0.72, 0.16);
    this.leftLeg = new THREE.Mesh(legGeo, whiteMat);
    this.leftLeg.position.set(-0.13, 0.42, 0);
    this.leftLeg.castShadow = true;
    this.root.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, whiteMat);
    this.rightLeg.position.set(0.13, 0.42, 0);
    this.rightLeg.castShadow = true;
    this.root.add(this.rightLeg);

    // 4. ARMS & WEAPON MOUNT
    const armGeo = new THREE.BoxGeometry(0.11, 0.45, 0.12);
    this.leftArm = new THREE.Mesh(armGeo, skinMat);
    this.leftArm.position.set(-0.28, 1.15, 0);
    this.root.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, skinMat);
    this.rightArm.position.set(0.28, 1.15, 0);
    this.root.add(this.rightArm);

    // Weapon mount placed in front of right hand
    this.weaponMount = new THREE.Group();
    this.weaponMount.position.set(0.24, 1.05, 0.3);
    this.root.add(this.weaponMount);

    this.setWeapon('rifle');
  }

  public setWeapon(weaponId: WeaponId) {
    while (this.weaponMount.children.length > 0) {
      this.weaponMount.remove(this.weaponMount.children[0]);
    }
    const mesh = createWeaponMesh(weaponId);
    mesh.scale.setScalar(0.85);
    this.weaponMount.add(mesh);
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
}

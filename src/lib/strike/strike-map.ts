import * as THREE from 'three';
import { Vector3D } from './strike-types';

export interface MapCollider {
  min: Vector3D;
  max: Vector3D;
  tag?: string;
}

export interface MapSpawnPoint {
  position: Vector3D;
  yaw: number;
}

export interface StrikeMapData {
  sceneGroup: THREE.Group;
  colliders: MapCollider[];
  spawnPoints: MapSpawnPoint[];
  botWaypoints: Vector3D[];
}

/**
 * Procedural texture atlas generated on an offscreen HTML5 canvas.
 * Produces crisp, stylized pixel-art / anime textures with ZERO network download.
 */
function createProceduralTexture(
  baseColor: string,
  gridColor: string,
  accentColor?: string
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    return new THREE.CanvasTexture(null as any);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 128, 128);

    // Subtle grid pattern
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 124, 124);
    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(64, 128);
    ctx.moveTo(0, 64);
    ctx.lineTo(128, 64);
    ctx.stroke();

    if (accentColor) {
      ctx.fillStyle = accentColor;
      ctx.fillRect(56, 56, 16, 16);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Builds the compact low-poly "Cyber Shrine" tactical deathmatch map.
 */
export function createCyberShrineMap(): StrikeMapData {
  const group = new THREE.Group();
  group.name = 'CyberShrineMap';

  const colliders: MapCollider[] = [];

  // Materials
  const stoneTex = createProceduralTexture('#2d3436', '#3b4346', '#00cec9');
  stoneTex.repeat.set(16, 16);
  const floorMat = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0x888899 });

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x24283b });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b3a3a }); // Shrine vermilion red
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xe1b12c });
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xd35400 });
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00cec9 });
  const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff7597 });

  function addBoxCollider(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    tag = 'wall'
  ) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);

    colliders.push({
      min: { x: x - w / 2, y: y - h / 2, z: z - d / 2 },
      max: { x: x + w / 2, y: y + h / 2, z: z + d / 2 },
      tag
    });
    return mesh;
  }

  // 1. MAIN GROUND (60m x 60m)
  const groundGeo = new THREE.BoxGeometry(60, 2, 60);
  const groundMesh = new THREE.Mesh(groundGeo, floorMat);
  groundMesh.position.set(0, -1, 0);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);
  colliders.push({
    min: { x: -30, y: -2, z: -30 },
    max: { x: 30, y: 0, z: 30 },
    tag: 'ground'
  });

  // 2. PERIMETER BOUNDARY WALLS (Height: 6m)
  addBoxCollider(0, 3, -30, 60, 6, 1, wallMat, 'boundary'); // North
  addBoxCollider(0, 3, 30, 60, 6, 1, wallMat, 'boundary');  // South
  addBoxCollider(-30, 3, 0, 1, 6, 60, wallMat, 'boundary'); // West
  addBoxCollider(30, 3, 0, 1, 6, 60, wallMat, 'boundary');  // East

  // Decorative cyber neon trims on perimeter walls
  const neonNorth = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 0.1), neonPinkMat);
  neonNorth.position.set(0, 5.8, -29.4);
  group.add(neonNorth);

  const neonSouth = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 0.1), neonCyanMat);
  neonSouth.position.set(0, 5.8, 29.4);
  group.add(neonSouth);

  // 3. GRAND TORII ARCH (Center: 0, 0, 0)
  // Left pillar
  addBoxCollider(-4, 3, 0, 0.8, 6, 0.8, woodMat, 'torii');
  // Right pillar
  addBoxCollider(4, 3, 0, 0.8, 6, 0.8, woodMat, 'torii');
  // Top crossbeam
  addBoxCollider(0, 6.2, 0, 10.5, 0.8, 1.2, woodMat, 'torii');
  // Sub-beam
  addBoxCollider(0, 5.0, 0, 9.2, 0.4, 0.8, woodMat, 'torii');

  // 4. CENTRAL SHRINE PAVILION & STEPS (North of Center)
  // Raised platform
  addBoxCollider(0, 0.6, -14, 14, 1.2, 10, floorMat, 'platform');
  // Shrine building roof
  addBoxCollider(0, 5.5, -14, 16, 0.6, 12, woodMat, 'roof');
  // Shrine back wall
  addBoxCollider(0, 2.5, -18.5, 13, 4, 1, wallMat, 'wall');
  // Shrine pillar supports
  addBoxCollider(-6, 2.5, -10, 0.8, 4, 0.8, goldMat, 'pillar');
  addBoxCollider(6, 2.5, -10, 0.8, 4, 0.8, goldMat, 'pillar');
  // Central altar cover in shrine
  addBoxCollider(0, 1.8, -14, 3, 1.2, 2, goldMat, 'cover');

  // 5. CATWALK & SNIPER BALCONY (West Wing: x = -18, z = -5 to 15, height = 3.5m)
  addBoxCollider(-18, 3.5, 5, 6, 0.4, 20, floorMat, 'catwalk');
  // Catwalk safety railing / peeking cover
  addBoxCollider(-15.2, 4.2, 5, 0.4, 1.0, 20, wallMat, 'railing');
  // Catwalk access ramp from South
  const rampGeo = new THREE.BoxGeometry(4, 0.4, 10);
  rampGeo.rotateX(Math.atan2(3.5, 10));
  const rampMesh = new THREE.Mesh(rampGeo, floorMat);
  rampMesh.position.set(-18, 1.75, 20);
  group.add(rampMesh);
  // Approximation collider for ramp
  colliders.push({
    min: { x: -20, y: 0, z: 15 },
    max: { x: -16, y: 3.5, z: 25 },
    tag: 'ramp'
  });

  // 6. EAST CORRIDOR & TEA HOUSE (East Wing: x = 18)
  addBoxCollider(18, 2, 0, 1, 4, 24, wallMat, 'wall'); // Divider wall with door cuts
  addBoxCollider(24, 1.5, -8, 8, 3, 8, floorMat, 'building');
  addBoxCollider(24, 1.5, 10, 8, 3, 8, floorMat, 'building');

  // 7. TACTICAL COVER CRATES & OBSTACLES (CS-style peek spots)
  // Mid crates (near Torii gate)
  addBoxCollider(2.5, 1.0, 4, 2.0, 2.0, 2.0, crateMat, 'crate');
  addBoxCollider(3.5, 2.5, 4, 1.5, 1.0, 1.5, crateMat, 'crate'); // Stacked double crate
  addBoxCollider(-3.0, 0.75, -5, 1.5, 1.5, 1.5, crateMat, 'crate');

  // Courtyard flank crates
  addBoxCollider(-8, 1.0, 8, 2.0, 2.0, 2.0, crateMat, 'crate');
  addBoxCollider(8, 1.0, -6, 2.0, 2.0, 2.0, crateMat, 'crate');
  addBoxCollider(14, 0.8, 4, 1.6, 1.6, 1.6, crateMat, 'crate');

  // Stone lanterns with warm glow
  for (const pos of [
    [-6, 0, -4],
    [6, 0, -4],
    [-6, 0, 6],
    [6, 0, 6],
    [-15, 0, -10],
    [15, 0, -10]
  ]) {
    addBoxCollider(pos[0], 0.9, pos[2], 0.8, 1.8, 0.8, stoneMat, 'lantern');
    const light = new THREE.PointLight(0xffaa44, 0.8, 8);
    light.position.set(pos[0], 1.8, pos[2]);
    group.add(light);
  }

  // Lighting
  const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.2);
  dirLight.position.set(25, 45, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 100;
  dirLight.shadow.camera.left = -35;
  dirLight.shadow.camera.right = 35;
  dirLight.shadow.camera.top = 35;
  dirLight.shadow.camera.bottom = -35;
  group.add(dirLight);

  const ambLight = new THREE.AmbientLight(0x708090, 0.8);
  group.add(ambLight);

  // 8. TACTICAL SPAWN POINTS (Distributed around courtyard and wings)
  const spawnPoints: MapSpawnPoint[] = [
    { position: { x: 0, y: 0.1, z: 24 }, yaw: 0 },             // South Main Spawn
    { position: { x: 0, y: 1.5, z: -12 }, yaw: Math.PI },        // North Shrine Altar
    { position: { x: -18, y: 3.7, z: 2 }, yaw: Math.PI / 2 },    // West Catwalk Balcony
    { position: { x: -24, y: 0.1, z: -20 }, yaw: Math.PI / 4 },  // North-West Alley
    { position: { x: 24, y: 0.1, z: -20 }, yaw: -Math.PI / 4 }, // North-East Garden
    { position: { x: -22, y: 0.1, z: 22 }, yaw: -Math.PI / 4 }, // South-West Courtyard
    { position: { x: 22, y: 0.1, z: 22 }, yaw: Math.PI / 4 },   // South-East Courtyard
    { position: { x: 12, y: 0.1, z: 0 }, yaw: Math.PI },        // East Flank
    { position: { x: -12, y: 0.1, z: 0 }, yaw: 0 },             // West Flank
    { position: { x: 0, y: 0.1, z: 6 }, yaw: 0 }                // Torii Front
  ];

  // 9. BOT WAYPOINTS (For navigation and tactical patrol paths)
  const botWaypoints: Vector3D[] = [
    { x: 0, y: 0, z: 18 },
    { x: 0, y: 0, z: 4 },
    { x: 0, y: 1.2, z: -12 },
    { x: -10, y: 0, z: 5 },
    { x: 10, y: 0, z: -5 },
    { x: -18, y: 3.5, z: 5 },
    { x: -18, y: 0, z: 22 },
    { x: 22, y: 0, z: -10 },
    { x: 22, y: 0, z: 12 },
    { x: -20, y: 0, z: -15 },
    { x: 0, y: 0, z: -6 },
    { x: -6, y: 0, z: 12 }
  ];

  return {
    sceneGroup: group,
    colliders,
    spawnPoints,
    botWaypoints
  };
}

/**
 * Swept sphere-AABB collision check for player movement.
 * Resolves player penetration against all map colliders and slides along surfaces.
 */
export function resolveMovementCollision(
  position: Vector3D,
  velocity: Vector3D,
  playerRadius = 0.45,
  playerHeight = 1.8,
  colliders: MapCollider[]
): { position: Vector3D; velocity: Vector3D; onGround: boolean } {
  const nextPos = {
    x: position.x + velocity.x,
    y: position.y + velocity.y,
    z: position.z + velocity.z
  };

  let onGround = false;

  for (const c of colliders) {
    // Check Y axis first (floor / ceiling)
    const withinXZ =
      nextPos.x + playerRadius > c.min.x &&
      nextPos.x - playerRadius < c.max.x &&
      nextPos.z + playerRadius > c.min.z &&
      nextPos.z - playerRadius < c.max.z;

    if (withinXZ) {
      // Landing on top of a surface
      if (position.y >= c.max.y - 0.25 && nextPos.y <= c.max.y) {
        nextPos.y = c.max.y;
        velocity.y = 0;
        onGround = true;
      }
      // Hitting ceiling
      else if (position.y + playerHeight <= c.min.y + 0.25 && nextPos.y + playerHeight >= c.min.y) {
        nextPos.y = c.min.y - playerHeight;
        velocity.y = 0;
      }
    }

    // Check X and Z wall collisions
    const withinY = nextPos.y < c.max.y && nextPos.y + playerHeight > c.min.y;
    if (withinY) {
      // X collision
      if (
        nextPos.z + playerRadius > c.min.z &&
        nextPos.z - playerRadius < c.max.z
      ) {
        // Hitting west face of obstacle
        if (position.x + playerRadius <= c.min.x && nextPos.x + playerRadius > c.min.x) {
          nextPos.x = c.min.x - playerRadius;
          velocity.x = 0;
        }
        // Hitting east face of obstacle
        else if (position.x - playerRadius >= c.max.x && nextPos.x - playerRadius < c.max.x) {
          nextPos.x = c.max.x + playerRadius;
          velocity.x = 0;
        }
      }

      // Z collision
      if (
        nextPos.x + playerRadius > c.min.x &&
        nextPos.x - playerRadius < c.max.x
      ) {
        // Hitting north face of obstacle
        if (position.z + playerRadius <= c.min.z && nextPos.z + playerRadius > c.min.z) {
          nextPos.z = c.min.z - playerRadius;
          velocity.z = 0;
        }
        // Hitting south face of obstacle
        else if (position.z - playerRadius >= c.max.z && nextPos.z - playerRadius < c.max.z) {
          nextPos.z = c.max.z + playerRadius;
          velocity.z = 0;
        }
      }
    }
  }

  // World floor safety clamp
  if (nextPos.y <= 0) {
    nextPos.y = 0;
    velocity.y = 0;
    onGround = true;
  }

  return { position: nextPos, velocity, onGround };
}

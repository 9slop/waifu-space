import {
  Scene,
  Vector3,
  Color3,
  StandardMaterial,
  DynamicTexture,
  Texture,
  MeshBuilder,
  GroundMesh
} from '@babylonjs/core';
import { applyHeightmapToMesh } from './terrain';

/**
 * Texture-brush ("paint") support for the map editor.
 *
 * Each painted ground gets a transparent overlay ground that shares the base
 * mesh's subdivisions + heightfield (lifted a few centimetres), textured with
 * an RGBA DynamicTexture. Brush strokes sample a source material's procedural
 * texture and composite soft-edged tiles into the overlay, which is persisted
 * on the ground object as a base64 PNG data URL (`MapGroundObject.paint`).
 */

/** Overlay texture resolution (square, stretched across the ground's UVs). */
export const PAINT_TEX_SIZE = 1024;
/** Vertical lift of the overlay so it never z-fights with the base ground. */
export const PAINT_LIFT = 0.03;

export interface PaintSource {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Repeats of the source texture across the ground, matching its tiling. */
  uScale: number;
  vScale: number;
}

export interface PaintOverlay {
  mesh: GroundMesh;
  texture: DynamicTexture;
  material: StandardMaterial;
}

export interface PaintOverlayOptions {
  id: string;
  width: number;
  height: number;
  subdivisions: number;
  heights: number[] | null;
  position: Vector3;
  paint?: string | null;
  editor: boolean;
}

function canUseCanvas(): boolean {
  return typeof document !== 'undefined' && !!document.createElement;
}

/** Clears (or fills transparent) a fresh RGBA overlay texture. */
export function createPaintTexture(scene: Scene, name: string): DynamicTexture {
  const texture = new DynamicTexture(
    name,
    { width: PAINT_TEX_SIZE, height: PAINT_TEX_SIZE },
    scene,
    true,
    Texture.TRILINEAR_SAMPLINGMODE
  );
  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  const ctx = texture.getContext() as CanvasRenderingContext2D | null;
  ctx?.clearRect(0, 0, PAINT_TEX_SIZE, PAINT_TEX_SIZE);
  texture.update(false);
  return texture;
}

/** Overlay material: alpha-blended, unlit by specular, drawn above the ground. */
export function createPaintMaterial(scene: Scene, name: string, texture: DynamicTexture): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseTexture = texture;
  mat.opacityTexture = texture;
  mat.useAlphaFromDiffuseTexture = true;
  mat.specularColor = new Color3(0, 0, 0);
  mat.backFaceCulling = false;
  mat.zOffset = -2;
  mat.maxSimultaneousLights = 4;
  return mat;
}

/** Builds the functional overlay mesh + texture + material for a ground. */
export function createPaintOverlay(scene: Scene, opts: PaintOverlayOptions): PaintOverlay {
  const mesh = MeshBuilder.CreateGround(
    `${opts.id}__paint`,
    { width: opts.width, height: opts.height, subdivisions: opts.subdivisions },
    scene
  ) as GroundMesh;
  mesh.position = opts.position.clone();
  if (opts.heights && opts.heights.length > 0) {
    applyHeightmapToMesh(mesh, opts.heights, opts.subdivisions, PAINT_LIFT);
  }
  mesh.isPickable = false;
  mesh.checkCollisions = false;
  mesh.receiveShadows = true;
  mesh.renderingGroupId = 1;
  if (opts.editor) {
    mesh.metadata = { editorId: opts.id, paintOverlay: true };
  }

  const texture = createPaintTexture(scene, `${opts.id}__paintTex`);
  const material = createPaintMaterial(scene, `${opts.id}__paintMat`, texture);
  mesh.material = material;
  if (opts.paint) loadPaintTexture(texture, opts.paint);

  return { mesh, texture, material };
}

/** Finds an already-built overlay for a ground id (e.g. after a rebuild). */
export function findPaintOverlay(scene: Scene, id: string): PaintOverlay | null {
  const mesh = scene.getMeshByName(`${id}__paint`);
  if (!(mesh instanceof GroundMesh)) return null;
  const material = mesh.material;
  if (!(material instanceof StandardMaterial) || !(material.diffuseTexture instanceof DynamicTexture)) {
    return null;
  }
  return { mesh, texture: material.diffuseTexture, material };
}

function makeSolidSource(color: Color3): PaintSource | null {
  if (!canUseCanvas()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = color.toHexString();
  ctx.fillRect(0, 0, 8, 8);
  return { canvas, width: 8, height: 8, uScale: 1, vScale: 1 };
}

/** Extracts a stampable source texture from a material (or a solid fallback). */
export function getPaintSource(material: StandardMaterial | undefined | null): PaintSource | null {
  if (!material) return null;
  const texture = material.diffuseTexture;
  if (texture instanceof DynamicTexture) {
    const ctx = texture.getContext() as CanvasRenderingContext2D | null;
    const canvas = ctx?.canvas as HTMLCanvasElement | undefined;
    const size = texture.getSize();
    if (canvas && size.width > 0 && size.height > 0) {
      return {
        canvas,
        width: size.width,
        height: size.height,
        uScale: texture.uScale || 1,
        vScale: texture.vScale || 1
      };
    }
  }
  return makeSolidSource(material.diffuseColor ?? new Color3(0.6, 0.6, 0.6));
}

/**
 * Stamps one soft-edged brush footprint of `source` onto the overlay texture at
 * a local-space ground position. Returns false when canvas APIs are missing.
 */
export function stampPaint(
  texture: DynamicTexture,
  source: PaintSource | null,
  localX: number,
  localZ: number,
  width: number,
  height: number,
  radiusMeters: number,
  alpha: number
): boolean {
  if (!source || !canUseCanvas()) return false;
  const ctx = texture.getContext() as CanvasRenderingContext2D | null;
  if (!ctx) return false;

  const u = localX / width + 0.5;
  const v = 0.5 - localZ / height;
  const cx = u * PAINT_TEX_SIZE;
  const cy = v * PAINT_TEX_SIZE;
  const overlayPxPerMeter = PAINT_TEX_SIZE / width;
  const radius = Math.max(1, radiusMeters * overlayPxPerMeter);
  const srcPxPerMeter = (source.width * Math.max(1, source.uScale)) / Math.max(0.0001, width);
  const scale = overlayPxPerMeter / Math.max(0.0001, srcPxPerMeter);

  const size = Math.max(2, Math.ceil(radius * 2));
  const stamp = document.createElement('canvas');
  stamp.width = size;
  stamp.height = size;
  const sctx = stamp.getContext('2d');
  if (!sctx) return false;

  const pattern = sctx.createPattern(source.canvas, 'repeat');
  if (pattern && typeof DOMMatrix !== 'undefined' && typeof pattern.setTransform === 'function') {
    const srcX = (((u * source.uScale) % 1) + 1) % 1 * source.width;
    const srcY = (((v * source.vScale) % 1) + 1) % 1 * source.height;
    const matrix = new DOMMatrix();
    matrix.translateSelf(radius, radius).scaleSelf(scale).translateSelf(-srcX, -srcY);
    pattern.setTransform(matrix);
    sctx.fillStyle = pattern;
    sctx.fillRect(0, 0, size, size);
  } else {
    sctx.drawImage(source.canvas, 0, 0, source.width, source.height, 0, 0, size, size);
  }

  const falloff = sctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  falloff.addColorStop(0, 'rgba(0,0,0,1)');
  falloff.addColorStop(0.7, 'rgba(0,0,0,0.6)');
  falloff.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.globalCompositeOperation = 'destination-in';
  sctx.fillStyle = falloff;
  sctx.fillRect(0, 0, size, size);
  sctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(stamp, cx - radius, cy - radius);
  ctx.restore();
  texture.update(false);
  return true;
}

/** Serializes the overlay texture to a base64 PNG data URL, or null. */
export function savePaintTexture(texture: DynamicTexture): string | null {
  try {
    const ctx = texture.getContext() as CanvasRenderingContext2D | null;
    const canvas = ctx?.canvas as HTMLCanvasElement | undefined;
    return canvas ? canvas.toDataURL('image/png') : null;
  } catch {
    return null;
  }
}

/** Redraws a saved paint data URL into a fresh overlay texture (async image load). */
export function loadPaintTexture(texture: DynamicTexture, dataUrl: string): void {
  if (typeof Image === 'undefined') return;
  const image = new Image();
  image.onload = () => {
    const ctx = texture.getContext() as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.clearRect(0, 0, PAINT_TEX_SIZE, PAINT_TEX_SIZE);
    ctx.drawImage(image, 0, 0, PAINT_TEX_SIZE, PAINT_TEX_SIZE);
    texture.update(false);
  };
  image.src = dataUrl;
}

import { GroundMesh, type Mesh } from '@babylonjs/core';

/**
 * Pure terrain heightfield helpers for the map editor.
 *
 * A sculpted ground stores an optional `subdivisions` count and a flat
 * `heightmap` array of local-space Y offsets (one per vertex, row-major,
 * `(subdivisions + 1)²` entries) that matches the vertex layout of
 * `MeshBuilder.CreateGround` (row 0 at +Z, col 0 at -X).
 *
 * Brush geometry is expressed in grid coordinates. Non-square grounds are
 * handled by using separate per-axis radii in grid units so the brush stays
 * circular in world space.
 */

export const TERRAIN_SUBDIVISIONS = 64;
export const TERRAIN_MIN_SUBDIVISIONS = 2;

/** Grid side length in vertices for `subdivisions` (== subdivisions + 1). */
export function terrainGridSize(subdivisions: number): number {
  return subdivisions + 1;
}

/**
 * Derives the subdivisions count from a heightmap's vertex count
 * (`(subdivisions + 1)²`), or null when the length isn't a perfect square.
 */
export function subdivisionsFromHeightmap(vertexCount: number): number | null {
  if (vertexCount <= 0) return null;
  const side = Math.round(Math.sqrt(vertexCount));
  if (side * side !== vertexCount) return null;
  return side - 1;
}

/** Number of vertices in a heightmap for `subdivisions`. */
export function terrainVertexCount(subdivisions: number): number {
  const size = terrainGridSize(subdivisions);
  return size * size;
}

/** Fresh zeroed heightmap for `subdivisions`. */
export function makeTerrainHeights(subdivisions: number): number[] {
  return new Array<number>(terrainVertexCount(subdivisions)).fill(0);
}

/** Clamped, finite copy of a candidate heightmap, or null when malformed. */
export function sanitizeTerrainHeights(
  value: unknown,
  subdivisions: number,
  fallback = 0
): number[] | null {
  if (!Array.isArray(value)) return null;
  const expected = terrainVertexCount(subdivisions);
  if (value.length !== expected) return null;
  const out: number[] = [];
  for (let i = 0; i < expected; i++) {
    const v = value[i];
    out.push(typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  }
  return out;
}

/** Terrain index (row-major) for a grid col/row. */
export function terrainIndex(col: number, row: number, subdivisions: number): number {
  return row * terrainGridSize(subdivisions) + col;
}

export interface TerrainGridPos {
  col: number;
  row: number;
}

/**
 * Maps a LOCAL x/z (the point transformed into the ground mesh's own frame,
 * ignoring y) to float grid coordinates, clamped to [0, subdivisions].
 */
export function terrainWorldToGrid(
  localX: number,
  localZ: number,
  width: number,
  height: number,
  subdivisions: number
): TerrainGridPos {
  const cellX = width / subdivisions;
  const cellZ = height / subdivisions;
  const col = Math.min(subdivisions, Math.max(0, (localX + width / 2) / cellX));
  const row = Math.min(subdivisions, Math.max(0, (height / 2 - localZ) / cellZ));
  return { col, row };
}

/** World-space size (meters) of one cell along X for a ground. */
export function terrainCellSizeX(width: number, subdivisions: number): number {
  return width / subdivisions;
}

/** World-space size (meters) of one cell along Z for a ground. */
export function terrainCellSizeZ(height: number, subdivisions: number): number {
  return height / subdivisions;
}

/** Brush centered on grid floats with per-axis radii (in grid cells). */
export interface TerrainBrushSpec {
  centerCol: number;
  centerRow: number;
  radiusCols: number;
  radiusRows: number;
}

/**
 * Smooth quadratic falloff in [0, 1]: 1 at the brush center, 0 at (and
 * beyond) the brush edge.
 */
export function brushFalloff(dist: number, radius: number): number {
  if (radius <= 0 || dist >= radius) return 0;
  const t = 1 - (dist / radius) * (dist / radius);
  return t * t;
}

function forEachCellInBrush(
  subdivisions: number,
  spec: TerrainBrushSpec,
  fn: (col: number, row: number, weight: number) => void
): void {
  const n = subdivisions;
  if (spec.radiusCols <= 0 || spec.radiusRows <= 0) return;
  const c0 = Math.max(0, Math.floor(spec.centerCol - spec.radiusCols - 1));
  const c1 = Math.min(n, Math.ceil(spec.centerCol + spec.radiusCols + 1));
  const r0 = Math.max(0, Math.floor(spec.centerRow - spec.radiusRows - 1));
  const r1 = Math.min(n, Math.ceil(spec.centerRow + spec.radiusRows + 1));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const dc = (col - spec.centerCol) / spec.radiusCols;
      const dr = (row - spec.centerRow) / spec.radiusRows;
      const dist = Math.sqrt(dc * dc + dr * dr);
      const weight = brushFalloff(dist, 1);
      if (weight > 0) fn(col, row, weight);
    }
  }
}

/** Raises every grid point under the brush by `amount * falloff`. */
export function raiseHeights(
  heights: number[],
  subdivisions: number,
  spec: TerrainBrushSpec,
  amount: number
): void {
  if (amount === 0) return;
  forEachCellInBrush(subdivisions, spec, (col, row, weight) => {
    heights[terrainIndex(col, row, subdivisions)] += amount * weight;
  });
}

/** Lowers every grid point under the brush by `amount * falloff`. */
export function lowerHeights(
  heights: number[],
  subdivisions: number,
  spec: TerrainBrushSpec,
  amount: number
): void {
  raiseHeights(heights, subdivisions, spec, -amount);
}

/**
 * Blends grid points under the brush toward the average of their four
 * orthogonal neighbors, weighted by `factor` and the brush falloff.
 */
export function smoothHeights(
  heights: number[],
  subdivisions: number,
  spec: TerrainBrushSpec,
  factor: number
): void {
  if (factor === 0) return;
  const snapshot = heights.slice();
  const size = terrainGridSize(subdivisions);
  forEachCellInBrush(subdivisions, spec, (col, row, weight) => {
    const idx = terrainIndex(col, row, subdivisions);
    let sum = 0;
    let count = 0;
    if (row > 0) {
      sum += snapshot[terrainIndex(col, row - 1, subdivisions)];
      count++;
    }
    if (row < subdivisions) {
      sum += snapshot[terrainIndex(col, row + 1, subdivisions)];
      count++;
    }
    if (col > 0) {
      sum += snapshot[terrainIndex(col - 1, row, subdivisions)];
      count++;
    }
    if (col < subdivisions) {
      sum += snapshot[terrainIndex(col + 1, row, subdivisions)];
      count++;
    }
    if (count === 0) return;
    const avg = sum / count;
    heights[idx] += (avg - heights[idx]) * factor * weight;
  });
}

/**
 * Writes a heightmap into a ground mesh's vertex Y positions, recomputes
 * smooth normals and refreshes collision height quads so
 * `getHeightAtCoordinates` keeps matching the visible surface. `lift` raises
 * the whole surface (used by the paint overlay so it sits above the ground).
 */
export function applyHeightmapToMesh(mesh: Mesh, heights: number[], subdivisions: number, lift = 0): void {
  const expected = terrainVertexCount(subdivisions);
  if (heights.length !== expected) return;
  mesh.updateMeshPositions((positions) => {
    for (let i = 0; i < expected; i++) {
      positions[i * 3 + 1] = heights[i] + lift;
    }
  }, true);
  mesh.refreshBoundingInfo();
  if (mesh instanceof GroundMesh) {
    mesh.updateCoordinateHeights();
  }
}
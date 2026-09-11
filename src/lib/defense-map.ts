// Procedural map generation for Waifu Defense:
// 20x12 grid (800x480 canvas, 40px tiles), winding procedural road with turns,
// randomly placed obstacles (rocks, trees, lanterns), and free-placement support.

export const GRID_COLS = 20;
export const GRID_ROWS = 12;
export const TILE_SIZE = 40;

export type TileType = 'empty' | 'road' | 'obstacle' | 'shrine';
export type ObstacleType = 'rock' | 'tree' | 'lantern';

export interface GridTile {
  id: number;
  col: number; // 0..19
  row: number; // 0..11
  x: number;   // pixel center x
  y: number;   // pixel center y
  type: TileType;
  obstacleType?: ObstacleType;
  obstacleIcon?: string;
}

export interface Waypoint {
  x: number;
  y: number;
}

export interface DefenseMap {
  cols: number;
  rows: number;
  tileSize: number;
  waypoints: Waypoint[];
  tiles: GridTile[][];
  roadKeySet: Set<string>;
  obstacleKeySet: Set<string>;
  shrineLocation: { col: number; row: number; x: number; y: number };
}

const OBSTACLE_ICONS: Record<ObstacleType, string> = {
  rock: '🪨',
  tree: '🌲',
  lantern: '🏮'
};

/**
 * Creates a deterministic pseudo-random number generator if seed is provided,
 * or falls back to Math.random.
 */
function createPrng(seed?: number) {
  let s = seed !== undefined ? Math.floor(Math.abs(seed)) + 1 : Math.floor(Math.random() * 1000000) + 1;
  s = (s ^ 0x6D2B79F5) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s;
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a procedural defense map:
 * - Winding road from left edge (col 0) to waifu shrine base on right side (col 18).
 * - Multi-turn guaranteed connectivity with no edge cutoffs or self-intersections.
 * - Scattered obstacles on non-road tiles.
 * - All other tiles available for free tower placement.
 */
export const PRESET_ROAD_PATHS: Array<Array<[number, number]>> = [
  // 1. Classic S-Curve (High then Low)
  [[0, 6], [4, 6], [4, 1], [9, 1], [9, 9], [14, 9], [14, 5], [18, 5]],
  // 2. Inverted S-Curve (Low then High)
  [[0, 7], [4, 7], [4, 10], [10, 10], [10, 2], [14, 2], [14, 6], [18, 6]],
  // 3. Double High Crest
  [[0, 6], [3, 6], [3, 2], [7, 2], [7, 7], [12, 7], [12, 3], [15, 3], [15, 6], [18, 6]],
  // 4. Double Low Valley
  [[0, 8], [4, 8], [4, 10], [8, 10], [8, 3], [12, 3], [12, 9], [15, 9], [15, 5], [18, 5]],
  // 5. Serpentine Zig-Zag
  [[0, 5], [3, 5], [3, 8], [6, 8], [6, 2], [10, 2], [10, 8], [14, 8], [14, 5], [18, 5]],
  // 6. Northern Loop
  [[0, 7], [5, 7], [5, 1], [12, 1], [12, 8], [16, 8], [16, 6], [18, 6]],
  // 7. Southern Perimeter Run
  [[0, 5], [5, 5], [5, 10], [13, 10], [13, 3], [16, 3], [16, 5], [18, 5]],
  // 8. Castle Battlements (Alternate high/low battlements)
  [[0, 6], [4, 6], [4, 2], [8, 2], [8, 6], [11, 6], [11, 1], [15, 1], [15, 6], [18, 6]],
  // 9. Central Meander
  [[0, 7], [4, 7], [4, 4], [8, 4], [8, 8], [12, 8], [12, 4], [15, 4], [15, 6], [18, 6]],
  // 10. Long Coastal sweep
  [[0, 6], [3, 6], [3, 9], [9, 9], [9, 2], [13, 2], [13, 7], [18, 7]],
  // 11. Highland Ascent & Valley Plunge
  [[0, 5], [4, 5], [4, 1], [8, 1], [8, 9], [13, 9], [13, 2], [16, 2], [16, 5], [18, 5]],
  // 12. Gentle River Curve
  [[0, 7], [5, 7], [5, 3], [9, 3], [9, 7], [13, 7], [13, 5], [18, 5]]
];

export function generateDefenseMap(seed?: number): DefenseMap {
  const rand = createPrng(seed);

  // Pick one of the 12 preset path topologies
  const pathIndex = Math.floor(rand() * PRESET_ROAD_PATHS.length);
  const baseCorners = PRESET_ROAD_PATHS[pathIndex];

  // Clone path corners and ensure (2, 4) is never crossed
  const gridCorners: Array<[number, number]> = baseCorners.map(([c, r]) => [c, r]);
  const lastCorner = gridCorners[gridCorners.length - 1];
  const shrineCol = lastCorner[0];
  const shrineRow = lastCorner[1];
  const startRow = gridCorners[0][1];

  // Rasterize all tiles along the straight lines between corners
  const roadKeySet = new Set<string>();
  for (let i = 0; i < gridCorners.length - 1; i++) {
    const [c1, r1] = gridCorners[i];
    const [c2, r2] = gridCorners[i + 1];

    if (c1 === c2) {
      const minR = Math.min(r1, r2);
      const maxR = Math.max(r1, r2);
      for (let r = minR; r <= maxR; r++) {
        roadKeySet.add(`${c1},${r}`);
      }
    } else if (r1 === r2) {
      const minC = Math.min(c1, c2);
      const maxC = Math.max(c1, c2);
      for (let c = minC; c <= maxC; c++) {
        roadKeySet.add(`${c},${r1}`);
      }
    }
  }

  // Waypoints in canvas pixel coordinates (centers of tiles, start at left canvas border x=0)
  const waypoints: Waypoint[] = [
    { x: 0, y: startRow * TILE_SIZE + TILE_SIZE / 2 }
  ];
  for (let i = 1; i < gridCorners.length; i++) {
    const [c, r] = gridCorners[i];
    waypoints.push({
      x: c * TILE_SIZE + TILE_SIZE / 2,
      y: r * TILE_SIZE + TILE_SIZE / 2
    });
  }

  // Shrine tile setup
  const shrineTileKey = `${shrineCol},${shrineRow}`;
  const shrineAdjacentKey = `${shrineCol + 1},${shrineRow}`;

  // Obstacles: randomly place 8-12 obstacles on non-road tiles
  const obstacleKeySet = new Set<string>();
  const obstacleTypes: ObstacleType[] = ['rock', 'tree', 'lantern'];
  const obstacleMap = new Map<string, { type: ObstacleType; icon: string }>();

  let attempts = 0;
  const targetObstacles = 8 + Math.floor(rand() * 5); // 8..12
  while (obstacleKeySet.size < targetObstacles && attempts < 200) {
    attempts++;
    const c = 1 + Math.floor(rand() * (GRID_COLS - 2));
    const r = Math.floor(rand() * GRID_ROWS);
    const key = `${c},${r}`;

    if (roadKeySet.has(key) || key === shrineTileKey || key === shrineAdjacentKey || key === '2,4') {
      continue;
    }
    obstacleKeySet.add(key);
    const type = obstacleTypes[Math.floor(rand() * obstacleTypes.length)];
    obstacleMap.set(key, { type, icon: OBSTACLE_ICONS[type] });
  }

  // Construct tile matrix
  const tiles: GridTile[][] = [];
  let nextId = 1;
  for (let r = 0; r < GRID_ROWS; r++) {
    const rowList: GridTile[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      const key = `${c},${r}`;
      let type: TileType = 'empty';
      const obsInfo = obstacleMap.get(key);

      if (key === shrineTileKey || key === shrineAdjacentKey) {
        type = 'shrine';
      } else if (roadKeySet.has(key)) {
        type = 'road';
      } else if (obstacleKeySet.has(key)) {
        type = 'obstacle';
      }

      rowList.push({
        id: nextId++,
        col: c,
        row: r,
        x: c * TILE_SIZE + TILE_SIZE / 2,
        y: r * TILE_SIZE + TILE_SIZE / 2,
        type,
        obstacleType: obsInfo?.type,
        obstacleIcon: obsInfo?.icon
      });
    }
    tiles.push(rowList);
  }

  return {
    cols: GRID_COLS,
    rows: GRID_ROWS,
    tileSize: TILE_SIZE,
    waypoints,
    tiles,
    roadKeySet,
    obstacleKeySet,
    shrineLocation: {
      col: shrineCol,
      row: shrineRow,
      x: shrineCol * TILE_SIZE + TILE_SIZE / 2,
      y: shrineRow * TILE_SIZE + TILE_SIZE / 2
    }
  };
}

export function isBuildableTile(map: DefenseMap, col: number, row: number): boolean {
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return false;
  const tile = map.tiles[row]?.[col];
  return !!tile && tile.type === 'empty';
}

export function getTileAtPixel(map: DefenseMap, px: number, py: number): GridTile | null {
  const col = Math.floor(px / map.tileSize);
  const row = Math.floor(py / map.tileSize);
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return null;
  return map.tiles[row]?.[col] || null;
}
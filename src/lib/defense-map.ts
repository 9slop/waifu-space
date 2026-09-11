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
  let s = seed !== undefined ? Math.floor(Math.abs(seed)) + 1 : Math.floor(Math.random() * 100000) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates a procedural defense map:
 * - Winding road from left edge (col 0) to waifu shrine base on right side (col 18).
 * - Multi-turn guaranteed connectivity with no edge cutoffs or self-intersections.
 * - Scattered obstacles on non-road tiles.
 * - All other tiles available for free tower placement.
 */
export function generateDefenseMap(seed?: number): DefenseMap {
  const rand = createPrng(seed);

  // Pick start and end rows with comfortable margins (avoiding tile 2,4)
  const startRow = 6;
  const shrineRow = 5 + Math.floor(rand() * 2); // 5..6
  const shrineCol = 18;

  // Turn columns (spaced evenly across 20 columns)
  const col1 = 4;
  const row1 = 1 + Math.floor(rand() * 2); // 1..2

  const col2 = 8 + Math.floor(rand() * 3); // 8..10
  const row2 = 8 + Math.floor(rand() * 2); // alternate height

  const col3 = 13 + Math.floor(rand() * 2); // 13..14
  const row3 = shrineRow;

  // Key turning points in grid (col, row)
  const gridCorners: Array<[number, number]> = [
    [0, startRow],
    [col1, startRow],
    [col1, row1],
    [col2, row1],
    [col2, row2],
    [col3, row2],
    [col3, row3],
    [shrineCol, row3]
  ];

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
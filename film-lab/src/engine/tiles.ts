export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Split an image into non-overlapping tiles that exactly cover it. */
export function computeTiles(width: number, height: number, tileSize: number): Rect[] {
  if (width <= 0 || height <= 0) return [];
  const size = Math.max(1, Math.floor(tileSize));
  const tiles: Rect[] = [];
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      tiles.push({ x, y, width: Math.min(size, width - x), height: Math.min(size, height - y) });
    }
  }
  return tiles;
}

/** Fit (w,h) inside a square of `maxSide`, never upscaling. */
export function fitSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

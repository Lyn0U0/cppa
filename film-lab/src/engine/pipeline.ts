/**
 * CPU reference implementation of the FILM LAB pipeline.
 *
 * Mirrors FRAGMENT_SHADER in `shaders.ts` stage by stage. Used for:
 *   • unit tests (the maths is verifiable in Node),
 *   • a GPU/CPU consistency check,
 *   • export fallback when WebGL is unavailable.
 */
import type { EngineParams, Vec3 } from './types';

const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const glMod = (x: number, y: number) => x - y * Math.floor(x / y);

const srgbToLinear = (c: number) => (c >= 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92);
const linearToSrgb = (c: number) =>
  c >= 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : c * 12.92;

const permute = (x: number) => glMod((x * 34 + 1) * x, 289);

export function hash(px: number, py: number): number {
  const x = glMod(px, 289);
  const y = glMod(py, 289);
  return permute(permute(permute(x) + y) + 17) / 289;
}

export function valueNoise(qx: number, qy: number): number {
  const ix = Math.floor(qx);
  const iy = Math.floor(qy);
  const fx = qx - ix;
  const fy = qy - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  const ab = a + (b - a) * ux;
  const cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy;
}

/** Grain cell size in source pixels: proportional to the image, so grain
 *  looks the same in the downscaled preview and the full-size export. */
export function grainCellSize(imageWidth: number, imageHeight: number, factor: number): number {
  const shortSide = Math.min(imageWidth, imageHeight);
  return Math.max(1, shortSide / 1600) * factor * 1.4;
}

export interface PixelContext {
  /** Full image size in pixels (in whatever space the grain/vignette live). */
  imageWidth: number;
  imageHeight: number;
  /** Cell size for grain, same units as image size. */
  grainCell: number;
}

/**
 * Process a single pixel. `x`/`y` are the pixel's *centre* coordinates in
 * full-image space (e.g. 0.5, 0.5 for the top-left pixel), matching the
 * fragment coordinates the GPU sees.
 */
export function processPixel(
  rgb: Vec3,
  x: number,
  y: number,
  p: EngineParams,
  ctx: PixelContext,
): Vec3 {
  // 1–3
  let r = srgbToLinear(rgb[0]) * p.exposureGain * p.whiteBalance[0];
  let g = srgbToLinear(rgb[1]) * p.exposureGain * p.whiteBalance[1];
  let b = srgbToLinear(rgb[2]) * p.exposureGain * p.whiteBalance[2];
  const m = p.mixer;
  // GLSL mat3 is column-major; we upload transpose(row-major) so u_mixer * v == M_row * v.
  const mr = m[0] * r + m[1] * g + m[2] * b;
  const mg = m[3] * r + m[4] * g + m[5] * b;
  const mb = m[6] * r + m[7] * g + m[8] * b;
  r = Math.max(mr, 0);
  g = Math.max(mg, 0);
  b = Math.max(mb, 0);

  // 4
  r = linearToSrgb(r);
  g = linearToSrgb(g);
  b = linearToSrgb(b);

  // 5
  const L = clamp01(r * LR + g * LG + b * LB);
  const sMask = 1 - smoothstep(0, 0.6, L);
  const hMask = smoothstep(0.35, 1, L);
  const sh = p.shadows * 0.3 * sMask + p.highlights * 0.3 * hMask;
  r += sh;
  g += sh;
  b += sh;

  // 6
  r = clamp01(r);
  g = clamp01(g);
  b = clamp01(b);
  if (p.contrast >= 0) {
    r = r + (r * r * (3 - 2 * r) - r) * p.contrast;
    g = g + (g * g * (3 - 2 * g) - g) * p.contrast;
    b = b + (b * b * (3 - 2 * b) - b) * p.contrast;
  } else {
    const k = -p.contrast * 0.5;
    r = r + (0.5 - r) * k;
    g = g + (0.5 - g) * k;
    b = b + (0.5 - b) * k;
  }

  // 7
  const L2 = r * LR + g * LG + b * LB;
  r = L2 + (r - L2) * p.saturation;
  g = L2 + (g - L2) * p.saturation;
  b = L2 + (b - L2) * p.saturation;

  // 8
  const mono = r * p.monoWeights[0] + g * p.monoWeights[1] + b * p.monoWeights[2];
  r = r + (mono - r) * p.mono;
  g = g + (mono - g) * p.mono;
  b = b + (mono - b) * p.mono;

  // 9
  const L3 = clamp01(r * LR + g * LG + b * LB);
  const ws = (1 - L3) * (1 - L3);
  const wh = L3 * L3;
  r += p.shadowTint[0] * ws + p.highlightTint[0] * wh;
  g += p.shadowTint[1] * ws + p.highlightTint[1] * wh;
  b += p.shadowTint[2] * ws + p.highlightTint[2] * wh;

  // 10
  r = p.fadeBlack[0] + clamp01(r) * (p.fadeWhite - p.fadeBlack[0]);
  g = p.fadeBlack[1] + clamp01(g) * (p.fadeWhite - p.fadeBlack[1]);
  b = p.fadeBlack[2] + clamp01(b) * (p.fadeWhite - p.fadeBlack[2]);

  // 11
  const u = x / ctx.imageWidth - 0.5;
  const v = y / ctx.imageHeight - 0.5;
  const rad = Math.sqrt(u * u * 4 + v * v * 4) * 0.70710678;
  const vMask = smoothstep(0.3, 1, rad);
  if (p.vignette >= 0) {
    const f = 1 - p.vignette * 0.75 * vMask;
    r *= f;
    g *= f;
    b *= f;
  } else {
    const k = -p.vignette * 0.6 * vMask;
    r += (1 - r) * k;
    g += (1 - g) * k;
    b += (1 - b) * k;
  }

  // 12
  if (p.grain > 0) {
    const qx = x / ctx.grainCell;
    const qy = y / ctx.grainCell;
    const n = valueNoise(qx, qy) * 0.6 + valueNoise(qx * 2.03 + 17, qy * 2.03 + 59) * 0.4 - 0.5;
    const Lg = clamp01(r * LR + g * LG + b * LB);
    const w = 1 - (2 * Lg - 1) * (2 * Lg - 1) * 0.7;
    const d = n * p.grain * 0.22 * w;
    r += d;
    g += d;
    b += d;
  }

  return [clamp01(r), clamp01(g), clamp01(b)];
}

export interface RegionInfo {
  /** Offset of this buffer inside the full image. */
  offsetX: number;
  offsetY: number;
  /** Size of this buffer. */
  width: number;
  height: number;
}

/**
 * Process an RGBA8 buffer in place-safe fashion (writes to `out`).
 * Alpha is passed through untouched.
 */
export function processRGBA(
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  region: RegionInfo,
  params: EngineParams,
  ctx: PixelContext,
): void {
  const inv = 1 / 255;
  const rgb: Vec3 = [0, 0, 0];
  for (let j = 0; j < region.height; j++) {
    const y = region.offsetY + j + 0.5;
    for (let i = 0; i < region.width; i++) {
      const idx = (j * region.width + i) * 4;
      rgb[0] = src[idx] * inv;
      rgb[1] = src[idx + 1] * inv;
      rgb[2] = src[idx + 2] * inv;
      const o = processPixel(rgb, region.offsetX + i + 0.5, y, params, ctx);
      out[idx] = Math.round(o[0] * 255);
      out[idx + 1] = Math.round(o[1] * 255);
      out[idx + 2] = Math.round(o[2] * 255);
      out[idx + 3] = src[idx + 3];
    }
  }
}

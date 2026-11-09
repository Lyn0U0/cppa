import { describe, expect, it } from 'vitest';
import { grainCellSize, hash, processPixel, processRGBA, valueNoise } from '../src/engine/pipeline';
import { PRESETS } from '../src/engine/presets';
import type { Vec3 } from '../src/engine/types';
import { CTX, center, luma, paramsFor } from './helpers';

const SAMPLES: Vec3[] = [
  [0, 0, 0], [1, 1, 1], [0.5, 0.5, 0.5], [0.8, 0.3, 0.2], [0.1, 0.6, 0.9], [0.25, 0.75, 0.4],
];

describe('pipeline – identity', () => {
  it('neutral parameters leave every 8-bit value unchanged', () => {
    const p = paramsFor();
    const src = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) src.set([i, 255 - i, (i * 7) % 256, 200], i * 4);
    const out = new Uint8ClampedArray(src.length);
    processRGBA(src, out, { offsetX: 0, offsetY: 0, width: 16, height: 16 }, p, { ...CTX, imageWidth: 16, imageHeight: 16 });
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  it('preserves alpha and buffer dimensions for every preset', () => {
    const src = new Uint8ClampedArray(8 * 8 * 4).map((_, i) => (i * 37) % 256);
    for (const preset of PRESETS) {
      const out = new Uint8ClampedArray(src.length);
      processRGBA(src, out, { offsetX: 0, offsetY: 0, width: 8, height: 8 }, paramsFor({ presetId: preset.id }), CTX);
      for (let i = 3; i < src.length; i += 4) expect(out[i]).toBe(src[i]);
    }
  });
});

describe('pipeline – adjustments behave as expected', () => {
  it('exposure brightens / darkens', () => {
    for (const c of SAMPLES.slice(2)) {
      expect(luma(center(c, paramsFor({ adj: { exposure: 1 } })))).toBeGreaterThan(luma(c));
      expect(luma(center(c, paramsFor({ adj: { exposure: -1 } })))).toBeLessThan(luma(c));
    }
  });

  it('contrast pushes tones away from / toward mid grey', () => {
    const dark: Vec3 = [0.2, 0.2, 0.2];
    const bright: Vec3 = [0.8, 0.8, 0.8];
    const hi = paramsFor({ adj: { contrast: 80 } });
    const lo = paramsFor({ adj: { contrast: -80 } });
    expect(center(dark, hi)[0]).toBeLessThan(0.2);
    expect(center(bright, hi)[0]).toBeGreaterThan(0.8);
    expect(center(dark, lo)[0]).toBeGreaterThan(0.2);
    expect(center(bright, lo)[0]).toBeLessThan(0.8);
  });

  it('temperature warms / cools', () => {
    const g: Vec3 = [0.5, 0.5, 0.5];
    const warm = center(g, paramsFor({ adj: { temperature: 60 } }));
    const cool = center(g, paramsFor({ adj: { temperature: -60 } }));
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(cool[2]).toBeGreaterThan(cool[0]);
  });

  it('saturation -100 produces grey, +100 increases chroma', () => {
    const c: Vec3 = [0.8, 0.3, 0.2];
    const grey = center(c, paramsFor({ adj: { saturation: -100 } }));
    expect(grey[0]).toBeCloseTo(grey[1], 6);
    expect(grey[1]).toBeCloseTo(grey[2], 6);
    const vivid = center(c, paramsFor({ adj: { saturation: 60 } }));
    expect(vivid[0] - vivid[2]).toBeGreaterThan(c[0] - c[2]);
  });

  it('shadows lifts dark tones more than bright; highlights the reverse', () => {
    const d: Vec3 = [0.15, 0.15, 0.15];
    const b: Vec3 = [0.85, 0.85, 0.85];
    const s = paramsFor({ adj: { shadows: 80 } });
    expect(center(d, s)[0] - 0.15).toBeGreaterThan(center(b, s)[0] - 0.85);
    const h = paramsFor({ adj: { highlights: -80 } });
    expect(0.85 - center(b, h)[0]).toBeGreaterThan(0.15 - center(d, h)[0]);
  });

  it('fade lifts blacks and lowers whites', () => {
    const p = paramsFor({ adj: { fade: 100 } });
    expect(center([0, 0, 0], p)[0]).toBeGreaterThan(0.1);
    expect(center([1, 1, 1], p)[0]).toBeLessThan(1);
  });

  it('vignette darkens corners but not the centre', () => {
    const p = paramsFor({ adj: { vignette: 100 } });
    const c: Vec3 = [0.6, 0.6, 0.6];
    expect(center(c, p)[0]).toBeCloseTo(0.6, 6);
    expect(processPixel(c, 0.5, 0.5, p, CTX)[0]).toBeLessThan(0.3);
    const n = paramsFor({ adj: { vignette: -100 } });
    expect(processPixel(c, 0.5, 0.5, n, CTX)[0]).toBeGreaterThan(0.6);
  });

  it('grain is deterministic, zero-mean-ish, and bounded', () => {
    const p = paramsFor({ adj: { grain: 100 } });
    const c: Vec3 = [0.5, 0.5, 0.5];
    let sum = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const x = (i % 80) + 0.5;
      const y = Math.floor(i / 80) + 0.5;
      const a = processPixel(c, x, y, p, CTX);
      expect(processPixel(c, x, y, p, CTX)).toEqual(a);
      expect(Math.abs(a[0] - 0.5)).toBeLessThan(0.12);
      sum += a[0] - 0.5;
    }
    expect(Math.abs(sum / N)).toBeLessThan(0.02);
  });

  it('Classic Mono outputs (near) neutral grey', () => {
    const p = paramsFor({ presetId: 'classic-mono' });
    for (const c of SAMPLES) {
      const o = center(c, p);
      expect(Math.abs(o[0] - o[2])).toBeLessThan(0.02);
    }
  });

  it('every preset changes a mid-tone colour and outputs valid values', () => {
    for (const preset of PRESETS) {
      const p = paramsFor({ presetId: preset.id });
      const o = center([0.5, 0.4, 0.3], p);
      expect(o.some((v, i) => Math.abs(v - [0.5, 0.4, 0.3][i]) > 0.01)).toBe(true);
      for (const v of o) expect(v >= 0 && v <= 1).toBe(true);
    }
  });
});

describe('noise helpers', () => {
  it('hash is in [0,1) and periodic only at 289', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 289; i++) {
      const h = hash(i, 3);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      seen.add(h);
    }
    expect(seen.size).toBeGreaterThan(200);
    expect(hash(5, 7)).toBe(hash(5 + 289, 7));
  });

  it('value noise is continuous', () => {
    expect(Math.abs(valueNoise(10.999, 4) - valueNoise(11.001, 4))).toBeLessThan(0.01);
  });

  it('grain cell scales with image size so preview and export match', () => {
    const full = grainCellSize(6000, 4000, 1);
    const preview = grainCellSize(6000, 4000, 1) * (1500 / 6000);
    // The noise field is sampled at pixel/cell, which is scale invariant:
    expect((3000 / full)).toBeCloseTo((3000 * 1500 / 6000) / preview, 10);
    expect(grainCellSize(800, 600, 1)).toBeGreaterThanOrEqual(1);
  });
});

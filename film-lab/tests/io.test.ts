import { describe, expect, it } from 'vitest';
import { parseRecipe, serializeRecipe } from '../src/editor/recipe';
import { FilmLabError } from '../src/engine/errors';
import { exportFileName } from '../src/engine/exporter';
import { MAX_FILE_BYTES, validateDimensions, validateFile } from '../src/engine/image';
import { createInitialEditState } from '../src/engine/params';
import { computeTiles, fitSize } from '../src/engine/tiles';

const code = (fn: () => void) => {
  try { fn(); } catch (e) { return (e as FilmLabError).code; }
  return null;
};

describe('file validation', () => {
  it('accepts JPG / PNG / WebP', () => {
    expect(code(() => validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }))).toBeNull();
    expect(code(() => validateFile({ name: 'a.PNG', type: 'image/png', size: 10 }))).toBeNull();
    expect(code(() => validateFile({ name: 'a.webp', type: 'image/webp', size: 10 }))).toBeNull();
    expect(code(() => validateFile({ name: 'a.webp', type: '', size: 10 }))).toBeNull();
  });
  it('rejects other formats, empty and oversized files', () => {
    expect(code(() => validateFile({ name: 'a.gif', type: 'image/gif', size: 10 }))).toBe('unsupported_format');
    expect(code(() => validateFile({ name: 'a.heic', type: '', size: 10 }))).toBe('unsupported_format');
    expect(code(() => validateFile({ name: 'a.pdf', type: 'application/pdf', size: 10 }))).toBe('unsupported_format');
    expect(code(() => validateFile({ name: 'a.jpg', type: 'image/jpeg', size: MAX_FILE_BYTES + 1 }))).toBe('file_too_large');
    expect(code(() => validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 0 }))).toBe('decode_failed');
  });
  it('rejects images too large for memory', () => {
    expect(code(() => validateDimensions(20000, 20000))).toBe('too_many_pixels');
    expect(code(() => validateDimensions(6000, 4000))).toBeNull();
  });
});

describe('tiles', () => {
  it('cover the image exactly once', () => {
    for (const [w, h, t] of [[6000, 4000, 2048], [100, 100, 4096], [4097, 1, 4096], [513, 1025, 512]]) {
      const tiles = computeTiles(w, h, t);
      const area = tiles.reduce((s, r) => s + r.width * r.height, 0);
      expect(area).toBe(w * h);
      for (const r of tiles) {
        expect(r.width).toBeLessThanOrEqual(t);
        expect(r.x + r.width).toBeLessThanOrEqual(w);
        expect(r.y + r.height).toBeLessThanOrEqual(h);
      }
    }
  });
  it('fitSize keeps aspect and never upscales', () => {
    expect(fitSize(6000, 4000, 2000)).toEqual({ width: 2000, height: 1333 });
    expect(fitSize(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });
});

describe('recipe JSON', () => {
  it('round-trips', () => {
    const s = createInitialEditState();
    s.presetId = 'soft-pastel';
    s.intensity = 70;
    s.adjustments.exposure = 0.5;
    expect(parseRecipe(serializeRecipe(s))).toEqual(s);
  });
  it('clamps values and rejects garbage', () => {
    const s = parseRecipe(JSON.stringify({ app: 'film-lab', intensity: 400, adjustments: { contrast: 900, bogus: 1 } }));
    expect(s.intensity).toBe(100);
    expect(s.adjustments.contrast).toBe(100);
    expect(() => parseRecipe('{')).toThrow(FilmLabError);
    expect(() => parseRecipe('{"app":"other"}')).toThrow(FilmLabError);
    expect(() => parseRecipe('{"app":"film-lab","presetId":"nope"}')).toThrow(FilmLabError);
  });
  it('export file names keep the original base name', () => {
    expect(exportFileName('IMG_001.HEIC.jpeg', 'jpeg')).toBe('IMG_001.HEIC_filmlab.jpg');
    expect(exportFileName('beach.webp', 'png')).toBe('beach_filmlab.png');
  });
});

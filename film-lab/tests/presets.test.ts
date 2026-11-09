import { describe, expect, it } from 'vitest';
import { PRESETS, validatePreset } from '../src/engine/presets';

describe('presets.json', () => {
  it('contains the six MVP presets with unique ids', () => {
    expect(PRESETS.map((p) => p.name)).toEqual([
      'Portra Warm', 'Fuji Green', 'Golden Hour', 'Night Cinema', 'Soft Pastel', 'Classic Mono',
    ]);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(6);
  });

  it('every preset passes validation', () => {
    for (const p of PRESETS) expect(validatePreset(p)).toEqual([]);
  });

  it('each preset has its own colour parameters', () => {
    const sigs = PRESETS.map((p) => JSON.stringify(p.color) + JSON.stringify(p.adjustments));
    expect(new Set(sigs).size).toBe(PRESETS.length);
  });

  it('mixer rows sum to ~1 so neutrals stay neutral', () => {
    for (const p of PRESETS) {
      const m = p.color.mixer;
      for (let r = 0; r < 3; r++) expect(m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2]).toBeCloseTo(1, 2);
    }
  });

  it('validation catches bad data', () => {
    expect(validatePreset(null)).not.toEqual([]);
    const bad = structuredClone(PRESETS[0]) as unknown as Record<string, any>;
    bad.adjustments.contrast = 999;
    bad.adjustments.sharpness = 3;
    bad.color.mixer = [1, 2];
    const errs = validatePreset(bad);
    expect(errs.some((e) => e.includes('contrast'))).toBe(true);
    expect(errs.some((e) => e.includes('sharpness'))).toBe(true);
    expect(errs.some((e) => e.includes('mixer'))).toBe(true);
  });
});

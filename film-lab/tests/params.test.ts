import { describe, expect, it } from 'vitest';
import {
  ADJUSTMENT_DEFS, createInitialEditState, effectiveAdjustments, isIdentityEdit, resolveParams, whiteBalance,
} from '../src/engine/params';
import { PRESETS, getPreset } from '../src/engine/presets';

describe('resolveParams', () => {
  it('neutral state resolves to identity parameters', () => {
    const p = resolveParams(createInitialEditState(), null);
    expect(p.exposureGain).toBe(1);
    expect(p.mixer).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(p.whiteBalance.map((v) => +v.toFixed(6))).toEqual([1, 1, 1]);
    expect(p.saturation).toBe(1);
    expect(p.mono).toBe(0);
    expect(p.grain).toBe(0);
    expect(p.fadeBlack).toEqual([0, 0, 0]);
    expect(p.fadeWhite).toBe(1);
  });

  it('preset at 0% intensity equals no preset', () => {
    for (const preset of PRESETS) {
      const s = { ...createInitialEditState(), presetId: preset.id, intensity: 0 };
      const a = resolveParams(s, preset);
      const b = resolveParams(createInitialEditState(), null);
      const norm = (o: object) => JSON.parse(JSON.stringify({ ...o, monoWeights: null }));
      expect(norm(a)).toEqual(norm(b));
      expect(isIdentityEdit(s, preset)).toBe(true);
    }
  });

  it('intensity scales preset contributions linearly', () => {
    const preset = getPreset('golden-hour')!;
    const half = effectiveAdjustments({ ...createInitialEditState(), presetId: preset.id, intensity: 50 }, preset);
    expect(half.temperature).toBeCloseTo(preset.adjustments.temperature! / 2);
    const p50 = resolveParams({ ...createInitialEditState(), presetId: preset.id, intensity: 50 }, preset);
    expect(p50.mixer[0]).toBeCloseTo(1 + (preset.color.mixer[0] - 1) / 2);
  });

  it('user adjustments stack on top of the preset and are clamped', () => {
    const preset = getPreset('night-cinema')!;
    const s = createInitialEditState();
    s.presetId = preset.id;
    s.adjustments.contrast = 100;
    const a = effectiveAdjustments(s, preset);
    expect(a.contrast).toBe(100);
    s.adjustments.contrast = -10;
    expect(effectiveAdjustments(s, preset).contrast).toBe(preset.adjustments.contrast! - 10);
  });

  it('every adjustment has a sane definition', () => {
    for (const d of ADJUSTMENT_DEFS) {
      expect(d.min).toBeLessThan(d.max);
      expect(['light', 'color', 'film']).toContain(d.group);
    }
  });

  it('white balance preserves neutral luminance', () => {
    for (const [t, m] of [[100, 0], [-100, 0], [0, 100], [50, -50]]) {
      const wb = whiteBalance(t, m);
      expect(0.2126 * wb[0] + 0.7152 * wb[1] + 0.0722 * wb[2]).toBeCloseTo(1, 10);
    }
    const warm = whiteBalance(50, 0);
    expect(warm[0]).toBeGreaterThan(warm[2]);
  });
});

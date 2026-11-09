import type {
  AdjustmentKey,
  Adjustments,
  EditState,
  EngineParams,
  Mat3,
  Preset,
  Vec3,
} from './types';

export interface AdjustmentDef {
  key: AdjustmentKey;
  label: string;
  group: 'light' | 'color' | 'film';
  min: number;
  max: number;
  step: number;
  /** Format a value for display. */
  format?: (v: number) => string;
}

const signed = (v: number) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);

export const ADJUSTMENT_DEFS: AdjustmentDef[] = [
  {
    key: 'exposure',
    label: '曝光',
    group: 'light',
    min: -2,
    max: 2,
    step: 0.01,
    format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`,
  },
  { key: 'contrast', label: '對比', group: 'light', min: -100, max: 100, step: 1, format: signed },
  { key: 'highlights', label: '亮部', group: 'light', min: -100, max: 100, step: 1, format: signed },
  { key: 'shadows', label: '陰影', group: 'light', min: -100, max: 100, step: 1, format: signed },
  { key: 'temperature', label: '色溫', group: 'color', min: -100, max: 100, step: 1, format: signed },
  { key: 'tint', label: '色調', group: 'color', min: -100, max: 100, step: 1, format: signed },
  { key: 'saturation', label: '飽和度', group: 'color', min: -100, max: 100, step: 1, format: signed },
  { key: 'grain', label: '顆粒', group: 'film', min: 0, max: 100, step: 1 },
  { key: 'fade', label: '褪色', group: 'film', min: 0, max: 100, step: 1 },
  { key: 'vignette', label: '暈影', group: 'film', min: -100, max: 100, step: 1, format: signed },
];

export const ADJUSTMENT_KEYS: AdjustmentKey[] = ADJUSTMENT_DEFS.map((d) => d.key);

const DEF_BY_KEY = Object.fromEntries(ADJUSTMENT_DEFS.map((d) => [d.key, d])) as Record<
  AdjustmentKey,
  AdjustmentDef
>;

export function getAdjustmentDef(key: AdjustmentKey): AdjustmentDef {
  return DEF_BY_KEY[key];
}

export const NEUTRAL_ADJUSTMENTS: Readonly<Adjustments> = Object.freeze({
  exposure: 0,
  contrast: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  highlights: 0,
  shadows: 0,
  grain: 0,
  fade: 0,
  vignette: 0,
});

export const IDENTITY_MAT3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const REC709_LUMA: Vec3 = [0.2126, 0.7152, 0.0722];

export const DEFAULT_INTENSITY = 100;

export function createInitialEditState(): EditState {
  return { presetId: null, intensity: DEFAULT_INTENSITY, adjustments: { ...NEUTRAL_ADJUSTMENTS } };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const scaleVec3 = (a: Vec3, t: number): Vec3 => [a[0] * t, a[1] * t, a[2] * t];

/**
 * Combine the preset (scaled by intensity) with the user's own adjustments.
 * The result is still in slider units and clamped to slider ranges.
 */
export function effectiveAdjustments(state: EditState, preset: Preset | null): Adjustments {
  const k = preset ? clamp(state.intensity, 0, 100) / 100 : 0;
  const out = { ...NEUTRAL_ADJUSTMENTS } as Adjustments;
  for (const key of ADJUSTMENT_KEYS) {
    const def = DEF_BY_KEY[key];
    const fromPreset = (preset?.adjustments[key] ?? 0) * k;
    out[key] = clamp(fromPreset + (state.adjustments[key] ?? 0), def.min, def.max);
  }
  return out;
}

/** White-balance multipliers normalised so neutral luminance is preserved. */
export function whiteBalance(temperature: number, tint: number): Vec3 {
  const t = clamp(temperature, -100, 100) / 100;
  const m = clamp(tint, -100, 100) / 100;
  const wb: Vec3 = [1 + 0.3 * t, 1 - 0.22 * m, 1 - 0.3 * t];
  const y = wb[0] * REC709_LUMA[0] + wb[1] * REC709_LUMA[1] + wb[2] * REC709_LUMA[2];
  return [wb[0] / y, wb[1] / y, wb[2] / y];
}

/**
 * Turn an EditState into the uniform values used by the engine.
 * Pure and deterministic – the single source of truth for both
 * the live preview and the full-resolution export.
 */
export function resolveParams(state: EditState, preset: Preset | null): EngineParams {
  const k = preset ? clamp(state.intensity, 0, 100) / 100 : 0;
  const a = effectiveAdjustments(state, preset);
  const color = preset?.color;

  const fade = a.fade / 100;
  const fadeColor: Vec3 = color ? lerpVec3([1, 1, 1], color.fadeColor, k) : [1, 1, 1];

  return {
    exposureGain: Math.pow(2, a.exposure),
    whiteBalance: whiteBalance(a.temperature, a.tint),
    mixer: color
      ? (IDENTITY_MAT3.map((v, i) => lerp(v, color.mixer[i], k)) as Mat3)
      : [...IDENTITY_MAT3],
    contrast: a.contrast / 100,
    highlights: a.highlights / 100,
    shadows: a.shadows / 100,
    saturation: 1 + a.saturation / 100,
    mono: color ? color.mono * k : 0,
    monoWeights: color ? [...color.monoWeights] : [...REC709_LUMA],
    shadowTint: color ? scaleVec3(color.shadowTint, k) : [0, 0, 0],
    highlightTint: color ? scaleVec3(color.highlightTint, k) : [0, 0, 0],
    fadeBlack: scaleVec3(fadeColor, fade * 0.2),
    fadeWhite: 1 - fade * 0.08,
    vignette: a.vignette / 100,
    grain: a.grain / 100,
    grainSizeFactor: color ? lerp(1, color.grainSize, k) : 1,
  };
}

/** True if the edit leaves pixels untouched (useful for fast paths & tests). */
export function isIdentityEdit(state: EditState, preset: Preset | null): boolean {
  const a = effectiveAdjustments(state, preset);
  const k = preset ? state.intensity / 100 : 0;
  return k === 0 && ADJUSTMENT_KEYS.every((key) => a[key] === 0);
}

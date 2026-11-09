/**
 * FILM LAB data model.
 *
 * Everything the user does is described by an `EditState` – a small, JSON
 * serialisable object. The original pixels are never modified; the engine
 * re-renders from the untouched source every time (non-destructive editing).
 */

export type Vec3 = [number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** User facing slider adjustments. All values are in "slider units". */
export interface Adjustments {
  /** Exposure in EV stops, -2 … +2 */
  exposure: number;
  /** -100 … 100 */
  contrast: number;
  /** Colour temperature, -100 (cool) … 100 (warm) */
  temperature: number;
  /** Tint, -100 (green) … 100 (magenta) */
  tint: number;
  /** -100 … 100 */
  saturation: number;
  /** -100 … 100 */
  highlights: number;
  /** -100 … 100 */
  shadows: number;
  /** 0 … 100 */
  grain: number;
  /** 0 … 100 */
  fade: number;
  /** -100 (lighten edges) … 100 (darken edges) */
  vignette: number;
}

export type AdjustmentKey = keyof Adjustments;

/** Per-preset colour science that is not exposed as a slider. */
export interface PresetColor {
  /** Row-major 3×3 channel mixer applied in linear light. */
  mixer: Mat3;
  /** Additive colour offset weighted toward shadows (sRGB, ±0.1 typical). */
  shadowTint: Vec3;
  /** Additive colour offset weighted toward highlights. */
  highlightTint: Vec3;
  /** Colour that faded blacks are lifted toward (0…1). */
  fadeColor: Vec3;
  /** 0 = colour, 1 = fully monochrome. */
  mono: number;
  /** Channel weights used to build the monochrome image. */
  monoWeights: Vec3;
  /** Relative grain size, 0.5 … 2.5 (1 = default). */
  grainSize: number;
}

export interface Preset {
  id: string;
  name: string;
  /** Short Chinese description shown in the UI. */
  description: string;
  /** Offsets added to the neutral adjustments (scaled by intensity). */
  adjustments: Partial<Adjustments>;
  color: PresetColor;
}

/** The complete, serialisable description of an edit. */
export interface EditState {
  /** `null` = no preset (original colours). */
  presetId: string | null;
  /** Preset strength, 0 … 100 (%). */
  intensity: number;
  /** User adjustments, applied on top of the preset. */
  adjustments: Adjustments;
}

/**
 * Fully resolved, engine-ready parameters. Produced by `resolveParams`
 * and consumed identically by the WebGL shader and the CPU reference
 * implementation so preview and export can never drift apart.
 */
export interface EngineParams {
  exposureGain: number;
  whiteBalance: Vec3;
  mixer: Mat3;
  /** -1 … 1 */
  contrast: number;
  /** -1 … 1 */
  highlights: number;
  /** -1 … 1 */
  shadows: number;
  /** multiplier, 0 … 2 */
  saturation: number;
  mono: number;
  monoWeights: Vec3;
  shadowTint: Vec3;
  highlightTint: Vec3;
  /** Output black level (rgb) after fade. */
  fadeBlack: Vec3;
  /** Output white level after fade. */
  fadeWhite: number;
  /** -1 … 1 */
  vignette: number;
  /** 0 … 1 */
  grain: number;
  /** Grain cell size in source-image pixels. Derived from image size. */
  grainSizeFactor: number;
}

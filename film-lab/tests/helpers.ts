import { resolveParams, createInitialEditState } from '../src/engine/params';
import { getPreset } from '../src/engine/presets';
import type { EditState, EngineParams, Vec3 } from '../src/engine/types';
import { processPixel, type PixelContext } from '../src/engine/pipeline';

export const CTX: PixelContext = { imageWidth: 1000, imageHeight: 800, grainCell: 2 };

export function paramsFor(patch: Partial<EditState> & { adj?: Partial<EditState['adjustments']> } = {}): EngineParams {
  const base = createInitialEditState();
  const state: EditState = {
    presetId: patch.presetId ?? base.presetId,
    intensity: patch.intensity ?? base.intensity,
    adjustments: { ...base.adjustments, ...(patch.adj ?? {}) },
  };
  return resolveParams(state, getPreset(state.presetId));
}

export const luma = (c: Vec3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Process at the image centre (no vignette influence). */
export const center = (rgb: Vec3, p: EngineParams) => processPixel(rgb, 500, 400, p, CTX);

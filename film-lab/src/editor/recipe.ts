import { FilmLabError } from '../engine/errors';
import { ADJUSTMENT_DEFS, NEUTRAL_ADJUSTMENTS, clamp } from '../engine/params';
import { getPreset } from '../engine/presets';
import type { Adjustments, EditState } from '../engine/types';

/** A portable, versioned JSON "recipe" describing an edit. */
export interface Recipe {
  app: 'film-lab';
  version: 1;
  presetId: string | null;
  intensity: number;
  adjustments: Adjustments;
}

export function toRecipe(state: EditState): Recipe {
  return {
    app: 'film-lab',
    version: 1,
    presetId: state.presetId,
    intensity: state.intensity,
    adjustments: { ...state.adjustments },
  };
}

export function serializeRecipe(state: EditState): string {
  return JSON.stringify(toRecipe(state), null, 2);
}

/** Parse and sanitise a recipe. Unknown keys are ignored, values clamped. */
export function parseRecipe(json: string): EditState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new FilmLabError('invalid_recipe', '不是有效的 JSON');
  }
  if (!raw || typeof raw !== 'object') throw new FilmLabError('invalid_recipe');
  const r = raw as Record<string, unknown>;
  if (r.app !== 'film-lab') throw new FilmLabError('invalid_recipe', '不是 FILM LAB 配方');

  const presetId = typeof r.presetId === 'string' ? r.presetId : null;
  if (presetId && !getPreset(presetId)) throw new FilmLabError('invalid_recipe', `未知的預設 ${presetId}`);

  const intensity = typeof r.intensity === 'number' && Number.isFinite(r.intensity) ? clamp(r.intensity, 0, 100) : 100;
  const adjRaw = (r.adjustments && typeof r.adjustments === 'object' ? r.adjustments : {}) as Record<string, unknown>;
  const adjustments = { ...NEUTRAL_ADJUSTMENTS } as Adjustments;
  for (const def of ADJUSTMENT_DEFS) {
    const v = adjRaw[def.key];
    if (typeof v === 'number' && Number.isFinite(v)) adjustments[def.key] = clamp(v, def.min, def.max);
  }
  return { presetId, intensity, adjustments };
}

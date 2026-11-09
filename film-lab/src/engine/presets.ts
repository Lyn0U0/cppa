import rawPresets from '../presets/presets.json';
import { ADJUSTMENT_DEFS } from './params';
import type { Preset } from './types';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec = (v: unknown, n: number): boolean =>
  Array.isArray(v) && v.length === n && v.every(isNum);

/**
 * Validate a preset definition loaded from JSON. Returns a list of
 * human-readable problems (empty when valid).
 */
export function validatePreset(p: unknown): string[] {
  const errors: string[] = [];
  if (!p || typeof p !== 'object') return ['preset is not an object'];
  const preset = p as Record<string, unknown>;
  const id = String(preset.id ?? '?');
  if (typeof preset.id !== 'string' || !preset.id) errors.push('missing id');
  if (typeof preset.name !== 'string' || !preset.name) errors.push(`${id}: missing name`);

  const adj = (preset.adjustments ?? {}) as Record<string, unknown>;
  for (const def of ADJUSTMENT_DEFS) {
    const v = adj[def.key];
    if (v === undefined) continue;
    if (!isNum(v)) errors.push(`${id}: adjustments.${def.key} is not a number`);
    else if (v < def.min || v > def.max)
      errors.push(`${id}: adjustments.${def.key}=${v} out of range [${def.min}, ${def.max}]`);
  }
  for (const key of Object.keys(adj)) {
    if (!ADJUSTMENT_DEFS.some((d) => d.key === key)) errors.push(`${id}: unknown adjustment "${key}"`);
  }

  const c = preset.color as Record<string, unknown> | undefined;
  if (!c) {
    errors.push(`${id}: missing color`);
    return errors;
  }
  if (!isVec(c.mixer, 9)) errors.push(`${id}: color.mixer must be 9 numbers`);
  for (const k of ['shadowTint', 'highlightTint', 'fadeColor', 'monoWeights'] as const) {
    if (!isVec(c[k], 3)) errors.push(`${id}: color.${k} must be 3 numbers`);
  }
  if (!isNum(c.mono) || c.mono < 0 || c.mono > 1) errors.push(`${id}: color.mono must be 0…1`);
  if (!isNum(c.grainSize) || c.grainSize <= 0) errors.push(`${id}: color.grainSize must be > 0`);
  return errors;
}

function loadPresets(): Preset[] {
  const list = (rawPresets as { presets: unknown[] }).presets;
  const problems = list.flatMap(validatePreset);
  if (problems.length) throw new Error(`Invalid presets.json:\n${problems.join('\n')}`);
  return list as Preset[];
}

export const PRESETS: Preset[] = loadPresets();

export function getPreset(id: string | null): Preset | null {
  if (!id) return null;
  return PRESETS.find((p) => p.id === id) ?? null;
}

import { createInitialEditState } from '../engine/params';
import type { EditState } from '../engine/types';

/**
 * Undo / redo history for non-destructive edits.
 *
 * Slider drags call `preview` many times per second; only the state at the
 * start of the drag is recorded (on `commit`), so one drag = one undo step
 * and the history never fills up with intermediate values.
 */
export interface HistoryState {
  past: EditState[];
  present: EditState;
  future: EditState[];
  /** State before an in-progress (uncommitted) change, if any. */
  pendingBase: EditState | null;
}

export type HistoryAction =
  | { type: 'preview'; state: EditState }
  | { type: 'commit' }
  | { type: 'apply'; state: EditState }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  | { type: 'load'; state?: EditState };

export const HISTORY_LIMIT = 100;

export function editStatesEqual(a: EditState, b: EditState): boolean {
  if (a.presetId !== b.presetId || a.intensity !== b.intensity) return false;
  const ka = Object.keys(a.adjustments) as (keyof EditState['adjustments'])[];
  return ka.every((k) => a.adjustments[k] === b.adjustments[k]);
}

export function createHistory(initial: EditState = createInitialEditState()): HistoryState {
  return { past: [], present: initial, future: [], pendingBase: null };
}

function pushPast(past: EditState[], s: EditState): EditState[] {
  const next = [...past, s];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

function settle(h: HistoryState): HistoryState {
  if (!h.pendingBase) return h;
  if (editStatesEqual(h.pendingBase, h.present)) return { ...h, pendingBase: null };
  return { past: pushPast(h.past, h.pendingBase), present: h.present, future: [], pendingBase: null };
}

export function historyReducer(h: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'preview':
      return { ...h, present: action.state, pendingBase: h.pendingBase ?? h.present };
    case 'commit':
      return settle(h);
    case 'apply': {
      const s = settle(h);
      if (editStatesEqual(s.present, action.state)) return s;
      return { past: pushPast(s.past, s.present), present: action.state, future: [], pendingBase: null };
    }
    case 'undo': {
      const s = settle(h);
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future], pendingBase: null };
    }
    case 'redo': {
      const s = settle(h);
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { past: pushPast(s.past, s.present), present: next, future: rest, pendingBase: null };
    }
    case 'reset':
      return historyReducer(h, { type: 'apply', state: createInitialEditState() });
    case 'load':
      return createHistory(action.state ?? createInitialEditState());
  }
}

export const canUndo = (h: HistoryState) => h.past.length > 0 || (h.pendingBase !== null && !editStatesEqual(h.pendingBase, h.present));
export const canRedo = (h: HistoryState) => h.future.length > 0;

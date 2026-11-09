import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, canRedo, canUndo, createHistory, historyReducer as r } from '../src/editor/history';
import { createInitialEditState } from '../src/engine/params';
import type { EditState } from '../src/engine/types';

const withContrast = (v: number): EditState => {
  const s = createInitialEditState();
  s.adjustments.contrast = v;
  return s;
};

describe('history', () => {
  it('a slider drag (many previews + commit) is a single undo step', () => {
    let h = createHistory();
    for (let v = 1; v <= 50; v++) h = r(h, { type: 'preview', state: withContrast(v) });
    h = r(h, { type: 'commit' });
    expect(h.past).toHaveLength(1);
    expect(h.present.adjustments.contrast).toBe(50);
    h = r(h, { type: 'undo' });
    expect(h.present.adjustments.contrast).toBe(0);
    expect(canRedo(h)).toBe(true);
    h = r(h, { type: 'redo' });
    expect(h.present.adjustments.contrast).toBe(50);
  });

  it('commit with no net change records nothing', () => {
    let h = createHistory();
    h = r(h, { type: 'preview', state: withContrast(10) });
    h = r(h, { type: 'preview', state: withContrast(0) });
    h = r(h, { type: 'commit' });
    expect(h.past).toHaveLength(0);
    expect(canUndo(h)).toBe(false);
  });

  it('a new action clears the redo stack', () => {
    let h = createHistory();
    h = r(h, { type: 'apply', state: withContrast(10) });
    h = r(h, { type: 'apply', state: withContrast(20) });
    h = r(h, { type: 'undo' });
    h = r(h, { type: 'apply', state: withContrast(30) });
    expect(h.future).toHaveLength(0);
    expect(h.past.map((s) => s.adjustments.contrast)).toEqual([0, 10]);
  });

  it('undo during an uncommitted drag reverts the drag', () => {
    let h = createHistory();
    h = r(h, { type: 'preview', state: withContrast(40) });
    expect(canUndo(h)).toBe(true);
    h = r(h, { type: 'undo' });
    expect(h.present.adjustments.contrast).toBe(0);
  });

  it('reset is undoable', () => {
    let h = createHistory();
    h = r(h, { type: 'apply', state: { ...withContrast(25), presetId: 'fuji-green' } });
    h = r(h, { type: 'reset' });
    expect(h.present).toEqual(createInitialEditState());
    h = r(h, { type: 'undo' });
    expect(h.present.presetId).toBe('fuji-green');
  });

  it('history is capped', () => {
    let h = createHistory();
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = r(h, { type: 'apply', state: withContrast(i) });
    expect(h.past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  });
});

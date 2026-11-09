import { Film, Palette, Sun } from 'lucide-react';
import { useState } from 'react';
import { ADJUSTMENT_DEFS } from '../engine/params';
import type { AdjustmentKey, Adjustments, Preset } from '../engine/types';
import { Slider } from './Slider';

type Group = 'light' | 'color' | 'film';

const TABS: { id: Group; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'color', label: 'Color', icon: Palette },
  { id: 'film', label: 'Film Effects', icon: Film },
];

interface ControlPanelProps {
  preset: Preset | null;
  intensity: number;
  adjustments: Adjustments;
  onIntensity: (v: number) => void;
  onAdjust: (key: AdjustmentKey, v: number) => void;
  onCommit: () => void;
  onResetKey: (key: AdjustmentKey) => void;
  onResetIntensity: () => void;
  /** Desktop shows all groups stacked; mobile uses tabs. */
  layout: 'stacked' | 'tabs';
}

export function ControlPanel(props: ControlPanelProps) {
  const { preset, intensity, adjustments, onIntensity, onAdjust, onCommit, onResetKey, onResetIntensity, layout } = props;
  const [tab, setTab] = useState<Group>('light');

  const renderGroup = (g: Group) =>
    ADJUSTMENT_DEFS.filter((d) => d.group === g).map((d) => (
      <Slider
        key={d.key}
        label={d.label}
        value={adjustments[d.key]}
        min={d.min}
        max={d.max}
        step={d.step}
        format={d.format}
        onChange={(v) => onAdjust(d.key, v)}
        onCommit={onCommit}
        onReset={() => onResetKey(d.key)}
      />
    ));

  const intensitySlider = (
    <div className="rounded-lg border border-line bg-paper/60 px-3 py-1 md:py-2">
      {layout === 'stacked' && (
        <div className="mb-0.5 text-[11px] uppercase tracking-[0.12em] text-muted">{preset ? preset.name : '未選擇預設'}</div>
      )}
      <Slider
        label={layout === 'stacked' ? '預設強度' : `${preset ? preset.name : '未選擇預設'} · 強度`}
        value={intensity}
        min={0}
        max={100}
        step={1}
        defaultValue={100}
        disabled={!preset}
        format={(v) => `${Math.round(v)}%`}
        onChange={onIntensity}
        onCommit={onCommit}
        onReset={onResetIntensity}
      />
    </div>
  );

  if (layout === 'stacked') {
    return (
      <div className="space-y-5">
        {intensitySlider}
        {TABS.map((t) => (
          <section key={t.id}>
            <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <t.icon size={13} strokeWidth={2} /> {t.label}
            </h3>
            {renderGroup(t.id)}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-1">{intensitySlider}</div>
      <div className="mt-2 flex gap-1 border-b border-line px-4" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted'
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2" role="tabpanel">
        {renderGroup(tab)}
      </div>
    </div>
  );
}

import { useId } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Value the slider resets to on double-click. */
  defaultValue?: number;
  disabled?: boolean;
  format?: (v: number) => string;
  /** Called continuously while dragging (live preview). */
  onChange: (v: number) => void;
  /** Called when the interaction ends (records an undo step). */
  onCommit: () => void;
  /** Double-click reset. */
  onReset?: () => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  defaultValue = 0,
  disabled,
  format,
  onChange,
  onCommit,
  onReset,
}: SliderProps) {
  const id = useId();
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  // Bipolar sliders fill from the default (centre); unipolar from the left.
  const anchor = pct(Math.min(Math.max(defaultValue, min), max));
  const cur = pct(value);
  const from = Math.min(anchor, cur);
  const to = Math.max(anchor, cur);
  const changed = Math.abs(value - defaultValue) > 1e-9;
  const display = format ? format(value) : String(Math.round(value));

  return (
    <div className="group py-1.5">
      <div className="mb-0.5 flex items-baseline justify-between text-[13px]">
        <label
          htmlFor={id}
          className="select-none text-ink/80"
          onDoubleClick={onReset}
          title="雙擊重設"
        >
          {label}
        </label>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled || !changed}
          className={`tabular-nums text-xs transition-colors ${
            changed ? 'text-accent hover:underline' : 'text-muted'
          }`}
          title={changed ? '點擊重設' : undefined}
        >
          {display}
        </button>
      </div>
      <input
        id={id}
        type="range"
        className="fl-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ ['--from' as string]: `${from}%`, ['--to' as string]: `${to}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        onTouchEnd={onCommit}
        onDoubleClick={onReset}
      />
    </div>
  );
}

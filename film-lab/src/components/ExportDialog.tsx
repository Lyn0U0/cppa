import { Download, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExportFormat, ExportOptions } from '../engine/exporter';

interface ExportDialogProps {
  open: boolean;
  width: number;
  height: number;
  busy: boolean;
  progress: number;
  error: string | null;
  defaultOptions: ExportOptions;
  onClose: () => void;
  onExport: (opts: ExportOptions) => void;
}

export function ExportDialog({ open, width, height, busy, progress, error, defaultOptions, onClose, onExport }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>(defaultOptions.format);
  const [quality, setQuality] = useState(defaultOptions.quality);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  const mp = ((width * height) / 1e6).toFixed(1);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 backdrop-blur-[2px] md:items-center" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="export-title" className="text-base font-semibold">匯出照片</h2>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full p-1.5 text-muted hover:bg-paper disabled:opacity-40" aria-label="關閉">
            <X size={18} />
          </button>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-paper px-3 py-2.5 text-sm">
          <dt className="text-muted">輸出尺寸</dt>
          <dd className="text-right tabular-nums">{width} × {height} px</dd>
          <dt className="text-muted">解析度</dt>
          <dd className="text-right tabular-nums">{mp} MP · 原始尺寸</dd>
        </dl>

        <fieldset className="mb-4" disabled={busy}>
          <legend className="mb-2 text-sm text-muted">格式</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['jpeg', 'png'] as const).map((f) => (
              <label
                key={f}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                  format === f ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink/40'
                }`}
              >
                <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                {f === 'jpeg' ? 'JPG' : 'PNG'}
                <span className="block text-[11px] opacity-70">{f === 'jpeg' ? '檔案較小' : '無損 · 支援透明'}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={`mb-5 transition-opacity ${format === 'jpeg' ? '' : 'pointer-events-none opacity-40'}`}>
          <div className="mb-1 flex justify-between text-sm">
            <label htmlFor="quality" className="text-muted">JPG 品質</label>
            <span className="tabular-nums">{Math.round(quality * 100)}%</span>
          </div>
          <input
            id="quality"
            type="range"
            className="fl-range"
            min={0.6}
            max={1}
            step={0.01}
            value={quality}
            disabled={busy || format !== 'jpeg'}
            style={{ ['--from' as string]: '0%', ['--to' as string]: `${((quality - 0.6) / 0.4) * 100}%` }}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {busy && (
          <div className="mb-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">以原始解析度處理中… {Math.round(progress * 100)}%</p>
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => onExport({ format, quality })}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-medium text-paper transition hover:bg-ink/90 disabled:opacity-60"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? '匯出中…' : `匯出 ${format === 'jpeg' ? 'JPG' : 'PNG'}`}
        </button>
      </div>
    </div>
  );
}

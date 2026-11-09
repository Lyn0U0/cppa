import {
  Columns2,
  Copy,
  Download,
  FileUp,
  ImagePlus,
  Maximize,
  Redo2,
  RotateCcw,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { DropZone } from './components/DropZone';
import { ExportDialog, type ExportResultView } from './components/ExportDialog';
import { PresetStrip } from './components/PresetStrip';
import { PreviewStage } from './components/PreviewStage';
import { Toasts, type Toast, type ToastKind } from './components/Toasts';
import { canRedo, canUndo, createHistory, historyReducer } from './editor/history';
import { parseRecipe, serializeRecipe } from './editor/recipe';
import { createSampleFile } from './editor/sample';
import { renderPresetThumbnails } from './editor/thumbnails';
import type { RendererKind } from './editor/usePreviewRenderer';
import { toFilmLabError } from './engine/errors';
import { downloadBlob, exportImage, type ExportOptions } from './engine/exporter';
import { ACCEPT_ATTR, loadImage, type LoadedImage } from './engine/image';
import { NEUTRAL_ADJUSTMENTS, resolveParams } from './engine/params';
import { PRESETS, getPreset } from './engine/presets';
import type { AdjustmentKey } from './engine/types';

const ZOOM_LEVELS = [1, 1.5, 2, 3, 4];

function useIsDesktop() {
  const query = '(min-width: 900px)';
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return match;
}

function previewMaxSide(): number {
  const longScreen = Math.max(window.screen.width, window.screen.height) * Math.min(window.devicePixelRatio || 1, 2);
  return Math.round(Math.min(Math.max(longScreen, 1400), window.innerWidth < 900 ? 1800 : 2560));
}

const formatBytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export default function App() {
  const isDesktop = useIsDesktop();
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, dispatch] = useReducer(historyReducer, undefined, () => createHistory());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [compare, setCompare] = useState(false);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [rendererKind, setRendererKind] = useState<RendererKind | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ format: 'jpeg', quality: 0.92 });
  const [exportResult, setExportResult] = useState<ExportResultView | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const recipeInput = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);

  const state = history.present;
  const preset = getPreset(state.presetId);
  const params = useMemo(() => resolveParams(state, preset), [state, preset]);

  // ---------- toasts ----------
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const notify = useCallback(
    (kind: ToastKind, message: string, replaceId?: number) => {
      const id = ++toastId.current;
      setToasts((ts) => [...ts.filter((t) => t.id !== replaceId).slice(-2), { id, kind, message }]);
      if (kind !== 'loading') setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500);
      return id;
    },
    [dismiss],
  );

  // ---------- loading ----------
  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || loading) return;
      setLoading(true);
      const tid = notify('loading', `讀取「${file.name}」…`);
      try {
        const loaded = await loadImage(file, previewMaxSide());
        setImage((old) => {
          old?.preview.close();
          old?.thumb.close();
          return loaded;
        });
        setThumbs({});
        setZoomIdx(0);
        dispatch({ type: 'load' });
        notify('success', `已載入 ${loaded.width} × ${loaded.height} px`, tid);
      } catch (err) {
        notify('error', toFilmLabError(err, 'decode_failed').message, tid);
      } finally {
        setLoading(false);
      }
    },
    [loading, notify],
  );

  const loadSample = useCallback(async () => {
    handleFile(await createSampleFile());
  }, [handleFile]);

  // Demo builds open with the sample photo already loaded.
  const demoStarted = useRef(false);
  useEffect(() => {
    if (import.meta.env.VITE_DEMO !== '1' || demoStarted.current) return;
    demoStarted.current = true;
    createSampleFile().then(async (f) => {
      await handleFile(f);
      dispatch({ type: 'load', state: { presetId: 'portra-warm', intensity: 100, adjustments: { ...NEUTRAL_ADJUSTMENTS } } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preset thumbnails, rendered by the same engine.
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    renderPresetThumbnails(image.thumb, PRESETS, image.width)
      .then((t) => !cancelled && setThumbs(t))
      .catch((err) => console.warn('thumbnail render failed', err));
    return () => {
      cancelled = true;
    };
  }, [image]);

  useEffect(() => {
    if (rendererKind === 'cpu') notify('info', '此瀏覽器不支援 WebGL，已改用 CPU 模式（速度較慢）。');
  }, [rendererKind, notify]);

  // ---------- editing ----------
  const setAdjustment = (key: AdjustmentKey, v: number) =>
    dispatch({ type: 'preview', state: { ...state, adjustments: { ...state.adjustments, [key]: v } } });
  const resetAdjustment = (key: AdjustmentKey) =>
    dispatch({ type: 'apply', state: { ...state, adjustments: { ...state.adjustments, [key]: NEUTRAL_ADJUSTMENTS[key] } } });
  const setIntensity = (v: number) => dispatch({ type: 'preview', state: { ...state, intensity: v } });
  const selectPreset = (id: string | null) =>
    dispatch({ type: 'apply', state: { ...state, presetId: id, intensity: id === state.presetId ? state.intensity : 100 } });
  const commit = () => dispatch({ type: 'commit' });
  const undo = () => dispatch({ type: 'undo' });
  const redo = () => dispatch({ type: 'redo' });
  const reset = () => dispatch({ type: 'reset' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || exportOpen) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exportOpen]);

  // ---------- export ----------
  const runExport = async (opts: ExportOptions) => {
    if (!image) return;
    setExportOptions(opts);
    setExportBusy(true);
    setExportError(null);
    setExportProgress(0);
    try {
      const res = await exportImage(image.file, params, opts, setExportProgress);
      setExportResult({
        url: URL.createObjectURL(res.blob),
        fileName: res.fileName,
        width: res.width,
        height: res.height,
        size: formatBytes(res.blob.size),
        blob: res.blob,
      });
      void downloadBlob(res.blob, res.fileName);
      notify('success', `匯出完成：${res.fileName}（${res.width}×${res.height}，${formatBytes(res.blob.size)}）`);
    } catch (err) {
      const msg = toFilmLabError(err, 'export_failed').message;
      setExportError(msg);
      notify('error', msg);
    } finally {
      setExportBusy(false);
    }
  };

  // ---------- recipe JSON ----------
  const copyRecipe = async () => {
    const json = serializeRecipe(state);
    try {
      await navigator.clipboard.writeText(json);
      notify('success', '已複製調色配方 JSON');
    } catch {
      if (await downloadBlob(new Blob([json], { type: 'application/json' }), 'filmlab-recipe.json')) {
        notify('info', '已下載調色配方 JSON');
      }
    }
  };
  const loadRecipe = async (file: File | undefined) => {
    if (!file) return;
    try {
      dispatch({ type: 'apply', state: parseRecipe(await file.text()) });
      notify('success', '已套用配方');
    } catch (err) {
      notify('error', toFilmLabError(err, 'invalid_recipe').message);
    }
  };

  // ---------- drag & drop ----------
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const iconBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5 disabled:pointer-events-none disabled:opacity-30';

  const panel = (
    <ControlPanel
      preset={preset}
      intensity={state.intensity}
      adjustments={state.adjustments}
      onIntensity={setIntensity}
      onAdjust={setAdjustment}
      onCommit={commit}
      onResetKey={resetAdjustment}
      onResetIntensity={() => dispatch({ type: 'apply', state: { ...state, intensity: 100 } })}
      layout={isDesktop ? 'stacked' : 'tabs'}
    />
  );

  const recipeButtons = (
    <div className="flex gap-2 text-xs">
      <button type="button" onClick={copyRecipe} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-muted hover:border-ink/30 hover:text-ink">
        <Copy size={12} /> 複製配方 JSON
      </button>
      <button type="button" onClick={() => recipeInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-muted hover:border-ink/30 hover:text-ink">
        <FileUp size={12} /> 載入配方
      </button>
    </div>
  );

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-paper"
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={recipeInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          loadRecipe(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper/90 px-3 md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink">
            <span className="h-3 w-3 rounded-full border-2 border-accent" />
          </span>
          <span className="whitespace-nowrap text-[15px] font-bold tracking-[0.2em]">FILM LAB</span>
          {image && <span className="hidden truncate text-xs text-muted sm:inline">· {image.name} · {image.width}×{image.height}</span>}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {image && (
            <>
              <button type="button" className={iconBtn} onClick={undo} disabled={!canUndo(history)} title="撤銷 (Ctrl+Z)" aria-label="撤銷">
                <Undo2 size={18} />
              </button>
              <button type="button" className={iconBtn} onClick={redo} disabled={!canRedo(history)} title="重做 (Ctrl+Shift+Z)" aria-label="重做">
                <Redo2 size={18} />
              </button>
              <button type="button" className={iconBtn} onClick={reset} title="重設全部" aria-label="重設">
                <RotateCcw size={17} />
              </button>
              <span className="mx-1 h-5 w-px bg-line" />
              <button type="button" className={iconBtn} onClick={() => fileInput.current?.click()} title="更換照片" aria-label="更換照片">
                <ImagePlus size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportError(null);
                  setExportOpen(true);
                }}
                className="ml-1.5 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3.5 py-2 text-sm font-medium text-paper hover:bg-ink/90"
              >
                <Download size={15} /> <span>匯出</span>
              </button>
            </>
          )}
        </div>
      </header>

      {!image ? (
        <main className="min-h-0 flex-1">
          <DropZone loading={loading} onPick={() => fileInput.current?.click()} onSample={loadSample} />
        </main>
      ) : (
        <main className={`flex min-h-0 flex-1 ${isDesktop ? 'flex-row' : 'flex-col'}`}>
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <PreviewStage
                image={image}
                params={params}
                compare={compare}
                zoom={ZOOM_LEVELS[zoomIdx]}
                onRendererKind={setRendererKind}
                onContextEvent={(k) => notify(k === 'lost' ? 'loading' : 'success', k === 'lost' ? '顯示卡資源中斷，正在重建預覽…' : '預覽已恢復')}
              />
              {/* Preview toolbar */}
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-line bg-surface/95 p-1 shadow-sm backdrop-blur">
                <button
                  type="button"
                  onClick={() => setCompare((c) => !c)}
                  aria-pressed={compare}
                  className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium transition ${compare ? 'bg-ink text-paper' : 'text-ink/80 hover:bg-ink/5'}`}
                >
                  <Columns2 size={14} /> 前後比較
                </button>
                <span className="mx-0.5 h-4 w-px bg-line" />
                <button type="button" className={`${iconBtn} h-8 w-8`} onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} disabled={zoomIdx === 0} aria-label="縮小">
                  <ZoomOut size={15} />
                </button>
                <button type="button" className="h-8 min-w-12 rounded-full px-1 text-xs tabular-nums text-ink/80 hover:bg-ink/5" onClick={() => setZoomIdx(0)} title="符合視窗">
                  {zoomIdx === 0 ? <Maximize size={14} className="mx-auto" /> : `${ZOOM_LEVELS[zoomIdx]}×`}
                </button>
                <button type="button" className={`${iconBtn} h-8 w-8`} onClick={() => setZoomIdx((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))} disabled={zoomIdx === ZOOM_LEVELS.length - 1} aria-label="放大">
                  <ZoomIn size={15} />
                </button>
              </div>
            </div>
            <div className="shrink-0 border-t border-line bg-paper">
              <PresetStrip presets={PRESETS} activeId={state.presetId} thumbnails={thumbs} onSelect={selectPreset} />
            </div>
          </section>

          {isDesktop ? (
            <aside className="flex w-[320px] shrink-0 flex-col border-l border-line bg-surface lg:w-[340px]">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{panel}</div>
              <div className="border-t border-line px-5 py-3">{recipeButtons}</div>
            </aside>
          ) : (
            <aside className="flex h-[36dvh] min-h-[250px] shrink-0 flex-col border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
              <div className="min-h-0 flex-1 pt-2">{panel}</div>
              <div className="border-t border-line px-4 py-2">{recipeButtons}</div>
            </aside>
          )}
        </main>
      )}

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-paper/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-accent px-10 py-8 text-lg font-medium text-accent">放開以載入照片</div>
        </div>
      )}

      {image && (
        <ExportDialog
          open={exportOpen}
          width={image.width}
          height={image.height}
          busy={exportBusy}
          progress={exportProgress}
          error={exportError}
          defaultOptions={exportOptions}
          result={exportResult}
          onClose={() => {
            setExportOpen(false);
            setExportResult((r) => {
              if (r) URL.revokeObjectURL(r.url);
              return null;
            });
          }}
          onExport={runExport}
        />
      )}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

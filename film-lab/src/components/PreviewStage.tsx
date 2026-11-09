import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LoadedImage } from '../engine/image';
import type { EngineParams } from '../engine/types';
import { usePreviewRenderer, type RendererKind } from '../editor/usePreviewRenderer';

const PAD_X = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 64;

interface PreviewStageProps {
  image: LoadedImage;
  params: EngineParams;
  compare: boolean;
  zoom: number;
  onRendererKind?: (k: RendererKind | null) => void;
  onContextEvent?: (kind: 'lost' | 'restored') => void;
}

/**
 * Large photo preview. The "after" canvas is drawn by the film engine;
 * the "before" canvas shows the same preview bitmap untouched. In compare
 * mode the after-layer is clipped at the divider position.
 */
export function PreviewStage({ image, params, compare, zoom, onRendererKind, onContextEvent }: PreviewStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const afterHostRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ width: 0, height: 0 });
  const [split, setSplit] = useState(50);
  const dragging = useRef(false);

  const kind = usePreviewRenderer(afterHostRef, image, params, onContextEvent);
  useEffect(() => onRendererKind?.(kind), [kind, onRendererKind]);

  // Fit the photo inside the stage, preserving aspect ratio.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      // Leave room for the floating toolbar below the photo.
      const w = Math.max(1, el.clientWidth - PAD_X * 2);
      const h = Math.max(1, el.clientHeight - PAD_TOP - PAD_BOTTOM);
      const s = Math.min(w / image.width, h / image.height);
      setFit({ width: Math.floor(image.width * s), height: Math.floor(image.height * s) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [image.width, image.height]);

  // Draw the untouched "before" image.
  useEffect(() => {
    const c = beforeRef.current;
    if (!c) return;
    c.width = image.preview.width;
    c.height = image.preview.height;
    const ctx = c.getContext('2d');
    ctx?.clearRect(0, 0, c.width, c.height);
    ctx?.drawImage(image.preview, 0, 0);
  }, [image]);

  const setSplitFromEvent = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setSplit(Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100)));
  };

  const w = fit.width * zoom;
  const h = fit.height * zoom;

  return (
    <div ref={stageRef} className="relative h-full w-full overflow-auto">
      <div
        className="flex min-h-full min-w-full items-center justify-center"
        style={{ width: w ? w + PAD_X * 2 : undefined, padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px` }}
      >
        <div
          ref={boxRef}
          className="checker relative shrink-0 overflow-hidden rounded-sm shadow-[0_10px_40px_-12px_rgb(43_38_34/0.35)]"
          style={{ width: w, height: h, touchAction: compare ? 'none' : 'auto' }}
          onPointerDown={(e) => {
            if (!compare) return;
            dragging.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setSplitFromEvent(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && setSplitFromEvent(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <canvas ref={beforeRef} className="absolute inset-0 block h-full w-full" aria-label="原圖" />
          <div
            ref={afterHostRef}
            className="absolute inset-0"
            style={{ clipPath: compare ? `inset(0 0 0 ${split}%)` : undefined }}
          />
          {compare && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-white/90 shadow-[0_0_0_0.5px_rgb(0_0_0/0.25)]"
                style={{ left: `${split}%` }}
              />
              <div
                role="slider"
                tabIndex={0}
                aria-label="前後比較分隔線"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(split)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') setSplit((s) => Math.max(0, s - 2));
                  if (e.key === 'ArrowRight') setSplit((s) => Math.min(100, s + 2));
                }}
                className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white/95 text-ink shadow-md outline-none ring-accent focus-visible:ring-2"
                style={{ left: `${split}%` }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
                </svg>
              </div>
              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white backdrop-blur">
                BEFORE
              </span>
              <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white backdrop-blur">
                AFTER
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

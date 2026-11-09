import { useEffect, useRef, useState } from 'react';
import { CpuFilmRenderer } from '../engine/cpuRenderer';
import type { LoadedImage } from '../engine/image';
import { grainCellSize } from '../engine/pipeline';
import type { EngineParams } from '../engine/types';
import { WebGLFilmRenderer } from '../engine/webglRenderer';

export type RendererKind = 'webgl' | 'cpu';
type AnyRenderer = WebGLFilmRenderer | CpuFilmRenderer;

/**
 * Mounts a preview canvas into `hostRef` and keeps it rendered with the
 * latest params. Renders are coalesced to one per animation frame, the
 * texture is uploaded only when the image changes, and the canvas is
 * never cleared between frames – so slider drags don't flicker.
 */
export function usePreviewRenderer(
  hostRef: React.RefObject<HTMLDivElement | null>,
  image: LoadedImage | null,
  params: EngineParams,
  onContextEvent?: (kind: 'lost' | 'restored') => void,
): RendererKind | null {
  const rendererRef = useRef<AnyRenderer | null>(null);
  const [kind, setKind] = useState<RendererKind | null>(null);
  const paramsRef = useRef(params);
  const imageRef = useRef(image);
  const rafRef = useRef(0);
  const onContextEventRef = useRef(onContextEvent);
  onContextEventRef.current = onContextEvent;

  const scheduleDraw = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const r = rendererRef.current;
      const img = imageRef.current;
      if (!r || !img || !r.hasSource) return;
      const p = paramsRef.current;
      const pw = img.preview.width;
      const ph = img.preview.height;
      r.draw(p, {
        imageWidth: pw,
        imageHeight: ph,
        grainCell: grainCellSize(img.width, img.height, p.grainSizeFactor) * (pw / img.width),
      });
    });
  };

  // Create renderer + canvas once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full';
    canvas.setAttribute('aria-label', '調色後預覽');
    let renderer: AnyRenderer | null = WebGLFilmRenderer.create(canvas);
    let k: RendererKind = 'webgl';
    let activeCanvas = canvas;
    if (!renderer) {
      activeCanvas = document.createElement('canvas');
      activeCanvas.className = canvas.className;
      renderer = new CpuFilmRenderer(activeCanvas);
      k = 'cpu';
    }
    host.appendChild(activeCanvas);
    rendererRef.current = renderer;
    setKind(k);

    const onLost = (e: Event) => {
      e.preventDefault();
      onContextEventRef.current?.('lost');
    };
    const onRestored = () => {
      const r = rendererRef.current;
      const img = imageRef.current;
      if (r instanceof WebGLFilmRenderer) {
        r.restore();
        if (img) r.setSource(img.preview, img.preview.width, img.preview.height);
        scheduleDraw();
      }
      onContextEventRef.current?.('restored');
    };
    activeCanvas.addEventListener('webglcontextlost', onLost);
    activeCanvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      activeCanvas.removeEventListener('webglcontextlost', onLost);
      activeCanvas.removeEventListener('webglcontextrestored', onRestored);
      renderer?.dispose();
      activeCanvas.remove();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upload a new image.
  useEffect(() => {
    imageRef.current = image;
    const r = rendererRef.current;
    if (r && image) {
      r.setSource(image.preview, image.preview.width, image.preview.height);
      scheduleDraw();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, kind]);

  // Re-render on param change.
  useEffect(() => {
    paramsRef.current = params;
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return kind;
}

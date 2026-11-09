import { FilmLabError, toFilmLabError } from './errors';
import { decodeFull, validateDimensions } from './image';
import { grainCellSize, processRGBA } from './pipeline';
import { computeTiles } from './tiles';
import type { EngineParams } from './types';
import { WebGLFilmRenderer } from './webglRenderer';

export type ExportFormat = 'jpeg' | 'png';

export interface ExportOptions {
  format: ExportFormat;
  /** JPEG quality 0.5 … 1 */
  quality: number;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
  durationMs: number;
}

export function exportFileName(originalName: string, format: ExportFormat): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}_filmlab.${format === 'jpeg' ? 'jpg' : 'png'}`;
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

let sharedRenderer: WebGLFilmRenderer | null | undefined;
/** Off-screen renderer shared by export and thumbnails. */
export function getOffscreenRenderer(): WebGLFilmRenderer | null {
  if (sharedRenderer === undefined || sharedRenderer?.isContextLost) {
    sharedRenderer = WebGLFilmRenderer.create();
  }
  return sharedRenderer;
}

/**
 * Render `source` at its native resolution into a 2D canvas, tile by tile.
 * Uses WebGL when available and falls back to the CPU reference pipeline.
 */
export async function renderFullResolution(
  source: ImageBitmap,
  params: EngineParams,
  onProgress?: (fraction: number) => void,
): Promise<HTMLCanvasElement> {
  const { width, height } = source;
  validateDimensions(width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx || canvas.width !== width || canvas.height !== height) {
    throw new FilmLabError('out_of_memory', `${width}×${height}`);
  }

  const geo = { imageWidth: width, imageHeight: height, grainCell: grainCellSize(width, height, params.grainSizeFactor) };
  const renderer = getOffscreenRenderer();

  if (renderer) {
    const tiles = computeTiles(width, height, Math.min(renderer.maxRenderSize, 2048));
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const crop = await createImageBitmap(source, t.x, t.y, t.width, t.height, { premultiplyAlpha: 'none' });
      try {
        const pixels = renderer.renderRegion(crop, t, params, geo);
        ctx.putImageData(new ImageData(pixels, t.width, t.height), t.x, t.y);
      } finally {
        crop.close();
      }
      onProgress?.((i + 1) / tiles.length);
      await nextFrame();
    }
  } else {
    // CPU fallback: identical maths, slower.
    const tiles = computeTiles(width, height, 512);
    const scratch = document.createElement('canvas');
    const sctx = scratch.getContext('2d', { willReadFrequently: true })!;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      scratch.width = t.width;
      scratch.height = t.height;
      sctx.clearRect(0, 0, t.width, t.height);
      sctx.drawImage(source, t.x, t.y, t.width, t.height, 0, 0, t.width, t.height);
      const img = sctx.getImageData(0, 0, t.width, t.height);
      const out = new ImageData(t.width, t.height);
      processRGBA(img.data, out.data, { offsetX: t.x, offsetY: t.y, width: t.width, height: t.height }, params, geo);
      ctx.putImageData(out, t.x, t.y);
      onProgress?.((i + 1) / tiles.length);
      await nextFrame();
    }
  }
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new FilmLabError('out_of_memory', '編碼失敗'))),
      type,
      quality,
    );
  });
}

/** Decode the original file, render at full resolution, and encode. */
export async function exportImage(
  file: File,
  params: EngineParams,
  options: ExportOptions,
  onProgress?: (fraction: number) => void,
): Promise<ExportResult> {
  const started = performance.now();
  let source: ImageBitmap | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    source = await decodeFull(file);
    canvas = await renderFullResolution(source, params, (f) => onProgress?.(f * 0.9));
    if (options.format === 'jpeg') {
      // JPEG has no alpha: composite transparent areas onto white instead of black.
      const ctx = canvas.getContext('2d')!;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    const mime = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await canvasToBlob(canvas, mime, options.format === 'jpeg' ? options.quality : undefined);
    onProgress?.(1);
    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      fileName: exportFileName(file.name, options.format),
      durationMs: performance.now() - started,
    };
  } catch (err) {
    throw toFilmLabError(err, 'export_failed');
  } finally {
    source?.close();
    if (canvas) {
      // Release the large backing store promptly.
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

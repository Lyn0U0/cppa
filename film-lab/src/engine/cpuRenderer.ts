import { processRGBA } from './pipeline';
import { fitSize } from './tiles';
import type { EngineParams } from './types';
import type { DrawGeometry } from './webglRenderer';

/** Max preview size for the CPU fallback (keeps slider response reasonable). */
export const CPU_PREVIEW_MAX = 900;

/**
 * Fallback preview renderer for browsers without WebGL. Uses the exact
 * same per-pixel maths as the shader (pipeline.ts).
 */
export class CpuFilmRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private src: ImageData | null = null;
  private out: ImageData | null = null;

  constructor(canvas: HTMLCanvasElement = document.createElement('canvas')) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  setSource(source: CanvasImageSource, width: number, height: number): void {
    const s = fitSize(width, height, CPU_PREVIEW_MAX);
    this.canvas.width = s.width;
    this.canvas.height = s.height;
    this.ctx.clearRect(0, 0, s.width, s.height);
    this.ctx.drawImage(source, 0, 0, s.width, s.height);
    this.src = this.ctx.getImageData(0, 0, s.width, s.height);
    this.out = new ImageData(s.width, s.height);
  }

  get hasSource(): boolean {
    return this.src !== null;
  }

  /** Geometry passed in is for the preview size; rescale it to our canvas. */
  draw(params: EngineParams, geo: DrawGeometry): void {
    if (!this.src || !this.out) return;
    const { width, height } = this.src;
    const scale = width / geo.imageWidth;
    processRGBA(this.src.data, this.out.data, { offsetX: 0, offsetY: 0, width, height }, params, {
      imageWidth: width,
      imageHeight: height,
      grainCell: geo.grainCell * scale,
    });
    this.ctx.putImageData(this.out, 0, 0);
  }

  dispose(): void {
    this.src = null;
    this.out = null;
  }
}

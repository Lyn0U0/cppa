import { getOffscreenRenderer } from '../engine/exporter';
import { createInitialEditState, resolveParams } from '../engine/params';
import { grainCellSize, processRGBA } from '../engine/pipeline';
import type { Preset } from '../engine/types';

/** Render one preset (at 100 %) on the small thumbnail bitmap. */
async function renderThumb(thumb: ImageBitmap, preset: Preset | null, fullW: number): Promise<string> {
  const { width, height } = thumb;
  const params = resolveParams({ ...createInitialEditState(), presetId: preset?.id ?? null }, preset);
  const geo = {
    imageWidth: width,
    imageHeight: height,
    grainCell: grainCellSize(fullW, (fullW * height) / width, params.grainSizeFactor) * (width / fullW),
  };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const renderer = getOffscreenRenderer();
  if (renderer) {
    const pixels = renderer.renderRegion(thumb, { x: 0, y: 0, width, height }, params, geo);
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  } else {
    ctx.drawImage(thumb, 0, 0);
    const src = ctx.getImageData(0, 0, width, height);
    const out = new ImageData(width, height);
    processRGBA(src.data, out.data, { offsetX: 0, offsetY: 0, width, height }, params, geo);
    ctx.putImageData(out, 0, 0);
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function renderPresetThumbnails(
  thumb: ImageBitmap,
  presets: Preset[],
  fullWidth: number,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  out.__original = await renderThumb(thumb, null, fullWidth);
  for (const p of presets) {
    out[p.id] = await renderThumb(thumb, p, fullWidth);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

import { FilmLabError, toFilmLabError } from './errors';
import { fitSize } from './tiles';

export const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
export const MAX_FILE_BYTES = 80 * 1024 * 1024;
/** Hard ceiling on decoded pixels (≈ 4 bytes each, plus output canvas). */
export const MAX_PIXELS = 100_000_000;
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

/** Validate file type & size before attempting to decode. Throws FilmLabError. */
export function validateFile(file: FileLike): void {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const typeOk = (SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type);
  const extOk = SUPPORTED_EXTENSIONS.includes(ext);
  // Prefer the MIME type; fall back to the extension when the browser reports none.
  if (file.type ? !typeOk : !extOk) {
    throw new FilmLabError('unsupported_format', file.type || ext || undefined);
  }
  if (file.size > MAX_FILE_BYTES) throw new FilmLabError('file_too_large');
  if (file.size === 0) throw new FilmLabError('decode_failed', '檔案是空的');
}

export function validateDimensions(width: number, height: number): void {
  if (!width || !height) throw new FilmLabError('decode_failed');
  if (width * height > MAX_PIXELS) {
    throw new FilmLabError('too_many_pixels', `${width}×${height}`);
  }
}

/** Decode the file at full resolution, honouring EXIF orientation. */
export async function decodeFull(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image', premultiplyAlpha: 'none' });
  } catch (err) {
    throw toFilmLabError(err, 'decode_failed');
  }
}

export interface LoadedImage {
  file: File;
  name: string;
  /** Original pixel size (after EXIF orientation). */
  width: number;
  height: number;
  /** Downscaled bitmap used for live preview. */
  preview: ImageBitmap;
  /** Tiny bitmap used to render preset thumbnails. */
  thumb: ImageBitmap;
}

export async function loadImage(file: File, previewMaxSide: number): Promise<LoadedImage> {
  validateFile(file);
  const full = await decodeFull(file);
  try {
    validateDimensions(full.width, full.height);
    const p = fitSize(full.width, full.height, previewMaxSide);
    const t = fitSize(full.width, full.height, 240);
    const [preview, thumb] = await Promise.all([
      createImageBitmap(full, { resizeWidth: p.width, resizeHeight: p.height, resizeQuality: 'high', premultiplyAlpha: 'none' }),
      createImageBitmap(full, { resizeWidth: t.width, resizeHeight: t.height, resizeQuality: 'high', premultiplyAlpha: 'none' }),
    ]);
    return { file, name: file.name, width: full.width, height: full.height, preview, thumb };
  } catch (err) {
    throw toFilmLabError(err, 'out_of_memory');
  } finally {
    // The full-size decode is released; export re-decodes from the
    // untouched original file (non-destructive, memory friendly).
    full.close();
  }
}

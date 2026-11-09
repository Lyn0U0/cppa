export type FilmLabErrorCode =
  | 'unsupported_format'
  | 'file_too_large'
  | 'decode_failed'
  | 'too_many_pixels'
  | 'webgl_unavailable'
  | 'context_lost'
  | 'out_of_memory'
  | 'export_failed'
  | 'invalid_recipe';

const MESSAGES: Record<FilmLabErrorCode, string> = {
  unsupported_format: '不支援的檔案格式，請上傳 JPG、PNG 或 WebP 圖片。',
  file_too_large: '檔案過大，請上傳 80 MB 以下的圖片。',
  decode_failed: '無法讀取這張圖片，檔案可能已損毀或格式不正確。',
  too_many_pixels: '圖片解析度過高，超出瀏覽器可處理的記憶體範圍。',
  webgl_unavailable: '此瀏覽器不支援 WebGL，已改用 CPU 模式（速度較慢）。',
  context_lost: '顯示卡資源暫時中斷，正在重新建立預覽…',
  out_of_memory: '記憶體不足，無法完成處理。請關閉其他分頁或改用較小的圖片後再試。',
  export_failed: '匯出失敗，請再試一次。',
  invalid_recipe: '配方 JSON 格式不正確。',
};

export class FilmLabError extends Error {
  readonly code: FilmLabErrorCode;
  constructor(code: FilmLabErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]}（${detail}）` : MESSAGES[code]);
    this.code = code;
    this.name = 'FilmLabError';
  }
}

export function toFilmLabError(err: unknown, fallback: FilmLabErrorCode): FilmLabError {
  if (err instanceof FilmLabError) return err;
  if (err instanceof RangeError) return new FilmLabError('out_of_memory');
  if (err instanceof DOMException && /memory|allocation/i.test(err.message)) {
    return new FilmLabError('out_of_memory');
  }
  return new FilmLabError(fallback, err instanceof Error ? err.message : undefined);
}

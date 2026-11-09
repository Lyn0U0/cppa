import { ImagePlus, LoaderCircle } from 'lucide-react';

interface DropZoneProps {
  loading: boolean;
  onPick: () => void;
  onSample: () => void;
}

/** Empty state shown before a photo is loaded. */
export function DropZone({ loading, onPick, onSample }: DropZoneProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <button
        type="button"
        onClick={onPick}
        disabled={loading}
        className="group flex w-full max-w-xl flex-col items-center rounded-3xl border-2 border-dashed border-line bg-surface/70 px-8 py-16 text-center transition hover:border-accent/60 hover:bg-surface"
      >
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent transition group-hover:scale-105">
          {loading ? <LoaderCircle size={28} className="animate-spin" /> : <ImagePlus size={28} />}
        </span>
        <span className="text-lg font-semibold">{loading ? '讀取照片中…' : '上傳照片開始調色'}</span>
        <span className="mt-2 text-sm text-muted">點擊選擇或拖曳檔案到這裡 · JPG / PNG / WebP</span>
        <span className="mt-6 max-w-sm text-xs leading-relaxed text-muted/80">
          所有處理都在你的瀏覽器本機完成，照片不會上傳到任何伺服器。調色只改變像素顏色，不會改動構圖或影像內容。
        </span>
      </button>
      <button
        type="button"
        onClick={onSample}
        disabled={loading}
        className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink/80 hover:border-ink/30 disabled:opacity-50"
      >
        沒有照片？試用範例照片
      </button>
    </div>
  );
}

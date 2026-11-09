import { CircleAlert, CircleCheck, Info, LoaderCircle, X } from 'lucide-react';

export type ToastKind = 'info' | 'success' | 'error' | 'loading';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ICONS = {
  info: <Info size={16} className="text-muted" />,
  success: <CircleCheck size={16} className="text-success" />,
  error: <CircleAlert size={16} className="text-danger" />,
  loading: <LoaderCircle size={16} className="animate-spin text-accent" />,
};

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-2.5 text-sm shadow-lg ${
            t.kind === 'error' ? 'border-danger/30' : 'border-line'
          }`}
        >
          <span className="mt-0.5 shrink-0">{ICONS[t.kind]}</span>
          <span className="flex-1">{t.message}</span>
          {t.kind !== 'loading' && (
            <button type="button" onClick={() => onDismiss(t.id)} className="shrink-0 text-muted hover:text-ink" aria-label="關閉通知">
              <X size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

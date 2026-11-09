import type { Preset } from '../engine/types';

interface PresetStripProps {
  presets: Preset[];
  activeId: string | null;
  thumbnails: Record<string, string>;
  onSelect: (id: string | null) => void;
}

/** Horizontal, scrollable list of film presets with live thumbnails. */
export function PresetStrip({ presets, activeId, thumbnails, onSelect }: PresetStripProps) {
  const items: { id: string | null; name: string; description: string; key: string }[] = [
    { id: null, name: 'Original', description: '原始色彩', key: '__original' },
    ...presets.map((p) => ({ id: p.id, name: p.name, description: p.description, key: p.id })),
  ];
  return (
    <div className="scrollbar-none flex snap-x gap-3 overflow-x-auto px-4 py-3 md:px-6" role="listbox" aria-label="底片預設">
      {items.map((it) => {
        const active = it.id === activeId;
        const src = thumbnails[it.key];
        return (
          <button
            key={it.key}
            type="button"
            role="option"
            aria-selected={active}
            title={it.description}
            onClick={() => onSelect(it.id)}
            className="group shrink-0 snap-start text-left outline-none"
          >
            <div
              className={`relative h-[68px] w-[68px] overflow-hidden rounded-md bg-line transition md:h-[78px] md:w-[78px] ${
                active
                  ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper'
                  : 'ring-1 ring-line group-hover:ring-ink/30 group-focus-visible:ring-2 group-focus-visible:ring-accent'
              }`}
            >
              {src ? (
                <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="h-full w-full animate-pulse bg-line" />
              )}
            </div>
            <div className={`mt-1.5 w-[68px] truncate text-[11px] md:w-[78px] ${active ? 'font-semibold text-ink' : 'text-muted'}`}>
              {it.name}
            </div>
          </button>
        );
      })}
    </div>
  );
}

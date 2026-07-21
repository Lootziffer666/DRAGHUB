"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type MenuItem = {
  id: string;
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  shortcut?: string;
  separatorBefore?: boolean;
};

export type MenuState = {
  x: number;
  y: number;
  items: MenuItem[];
};

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const open = useCallback((x: number, y: number, items: MenuItem[]) => {
    setMenu({ x, y, items });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  return { menu, open, close };
}

export function ContextMenu({
  menu,
  onClose,
}: {
  menu: MenuState | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu?.x ?? 0, y: menu?.y ?? 0 });
  const [active, setActive] = useState(0);
  const [touchMode, setTouchMode] = useState(false);

  const enabledItems = menu?.items.filter((i) => !i.separatorBefore) ?? [];

  useLayoutEffect(() => {
    if (!menu) return;
    const el = ref.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 300;
    const pad = 8;
    const x = Math.min(menu.x, window.innerWidth - w - pad);
    const y = Math.min(menu.y, window.innerHeight - h - pad);
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) });
    setActive(0);
    setTouchMode("ontouchstart" in window);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      const items = menu.items;
      const focusable = items.filter((i) => i.label && !i.disabled);
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (focusable.length === 0) return;
        let idx = focusable.indexOf(focusable[active >= focusable.length ? 0 : active]);
        idx = (idx + 1) % focusable.length;
        setActive(items.indexOf(focusable[idx]));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (focusable.length === 0) return;
        const cur = focusable[active >= focusable.length ? 0 : active];
        let idx = focusable.indexOf(cur);
        idx = (idx - 1 + focusable.length) % focusable.length;
        setActive(items.indexOf(focusable[idx]));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[active];
        if (item?.label && !item.disabled) {
          onClose();
          item.onClick?.();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [menu, active, onClose]);

  if (!menu) return null;

  // map absolute index -> visible index for active highlight
  const visibleIndex = (i: number) =>
    menu.items.slice(0, i).filter((it) => it.label && !it.disabled).length;

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[100] min-w-[200px] select-none rounded-lg border border-[var(--dh-window-border)]/80 bg-[var(--dh-surface-raised)]/95 p-1 shadow-2xl shadow-black/50 backdrop-blur-md"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        // close when clicking outside handled globally; inside we stop propagation
        e.stopPropagation();
      }}
    >
      {menu.items.map((item, i) => {
        if (!item.label) {
          return item.separatorBefore && i > 0 ? (
            <div key={item.id} className="my-1 h-px bg-[var(--dh-surface-selected)]/70" />
          ) : null;
        }
        const isActive = i === active;
        return (
          <div key={item.id}>
            {item.separatorBefore && i > 0 && (
              <div className="my-1 h-px bg-[var(--dh-surface-selected)]/70" />
            )}
            <button
              role="menuitem"
              disabled={item.disabled}
              onMouseEnter={() => !touchMode && setActive(i)}
              onClick={(e) => {
                e.stopPropagation();
                if (item.disabled) return;
                onClose();
                item.onClick?.();
              }}
              className={[
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                item.disabled
                  ? "cursor-default text-[var(--dh-text-disabled)]"
                  : isActive
                    ? item.danger
                      ? "bg-red-500/90 text-white"
                      : "bg-blue-600 text-white"
                    : item.danger
                      ? "text-red-600 dark:text-red-400 hover:bg-red-500/15"
                      : "text-[var(--dh-text)] hover:bg-[var(--dh-surface-selected)]/60",
              ].join(" ")}
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {item.icon}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.shortcut && (
                <span className="text-[11px] text-[var(--dh-text-secondary)]">{item.shortcut}</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

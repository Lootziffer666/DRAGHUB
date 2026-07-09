"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ContextMenu,
  type MenuState,
  type MenuItem,
} from "./ContextMenu";

type UIContextValue = {
  openMenu: (x: number, y: number, items: MenuItem[]) => void;
  buildMenuFromEvent: (
    e: React.MouseEvent | React.TouchEvent,
    items: MenuItem[]
  ) => void;
};

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  menuRef.current = menu;

  const close = useCallback(() => setMenu(null), []);

  const openMenu = useCallback(
    (x: number, y: number, items: MenuItem[]) => {
      setMenu({ x, y, items });
    },
    []
  );

  const buildMenuFromEvent = useCallback(
    (
      e: React.MouseEvent | React.TouchEvent,
      items: MenuItem[]
    ) => {
      const point = "touches" in e ? e.touches[0] : e;
      const x = point ? point.clientX : 0;
      const y = point ? point.clientY : 0;
      setMenu({ x, y, items });
    },
    []
  );

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="menu"]')) return;
      close();
    };
    const onScroll = () => close();
    const onResize = () => close();
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu, close]);

  return (
    <UIContext.Provider value={{ openMenu, buildMenuFromEvent }}>
      {children}
      <ContextMenu menu={menu} onClose={close} />
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Search } from "@/components/icons";
import { SearchPanel } from "./SearchPanel";
import type { DesktopWindowState } from "@/features/desktop/types";

type SearchContextValue = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function repoKeyFromWindow(
  w: DesktopWindowState | undefined,
): string | null {
  if (!w) return null;
  if (w.resource.type === "repository") return w.resource.repoKey;
  if (w.resource.type === "file") return w.resource.repoKey;
  if (w.resource.type === "github-feature") return w.resource.repoKey;
  if (w.owner.type === "repository") return w.owner.repoKey;
  return null;
}

export function SearchProvider({
  children,
  onSelectRepo,
  relatedRepoKey = null,
}: {
  children: ReactNode;
  onSelectRepo?: (fullName: string) => void;
  relatedRepoKey?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <SearchContext.Provider value={{ open, close, toggle, isOpen }}>
      {children}
      {isOpen && (
        <SearchPanel
          onClose={close}
          relatedRepoKey={relatedRepoKey}
          onSelectRepo={onSelectRepo}
        />
      )}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}

export function SearchButton({
  className = "",
  label = "Search",
}: {
  className?: string;
  label?: string;
}) {
  const { open } = useSearch();
  return (
    <button
      onClick={open}
      title="Search (Ctrl/Cmd+K)"
      className={[
        "flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-600",
        className,
      ].join(" ")}
    >
      <Search width={14} height={14} className="text-neutral-500" />
      <span className="hidden sm:inline">{label}</span>
      <kbd className="hidden rounded bg-neutral-800 px-1.5 text-[11px] text-neutral-400 sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

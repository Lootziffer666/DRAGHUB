"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SearchRegular as Search } from "@/features/icons";
import { SearchPanel } from "./SearchPanel";
import type { DesktopWindowState } from "@/features/desktop/types";

type SearchContextValue = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
};

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * The repository "Related" search should operate against, derived from the
 * currently FOCUSED desktop window rather than whichever repository last
 * became globally active. Repository, file and github-feature windows carry
 * their own repoKey; a repository-owned child window (e.g. Settings opened
 * from a repository) inherits its owner's repoKey. System and tool windows
 * (Recycle Bin, Scratchpad, desktop-level Settings) yield null.
 */
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
  /** Overrides what selecting a repository result does — the desktop shell
   * opens/focuses a repository window instead of the global store. */
  onSelectRepo?: (fullName: string) => void;
  /** Repository context for the Related tab, derived from the focused
   * desktop window. Null disables Related with an explanation. */
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
          onSelectRepo={onSelectRepo}
          relatedRepoKey={relatedRepoKey}
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
        "flex items-center gap-2 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2.5 py-1.5 text-sm text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]",
        className,
      ].join(" ")}
    >
      <Search width={14} height={14} className="text-[var(--dh-text-secondary)]" />
      <span className="hidden sm:inline">{label}</span>
      <kbd className="hidden rounded bg-[var(--dh-surface-hover)] px-1.5 text-[11px] text-[var(--dh-text-secondary)] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

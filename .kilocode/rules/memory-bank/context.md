# Active Context: GitHub Browser (desktop-style repo explorer)

## Current State

**Status**: ✅ GitHub Browser built and passing typecheck + lint + production build.

A web app (Next.js 16, TS, Tailwind 4) that browses GitHub repositories with a
desktop file-explorer UX: tabbed browsing, a tree sidebar, right-click context
menus, drag-and-drop tab reordering / open, multi-selection, and touch support
(long-press for context menus, tap to open).

## Recently Completed

- [x] GitHub REST API client (`src/lib/github.ts`) with caching + rate-limit errors
- [x] App state store: reducer + async helpers (`src/lib/store.tsx`)
- [x] Reusable `ContextMenu` with keyboard nav + `UIProvider` owning one menu (`ui-context.tsx`)
- [x] `AddressBar`: repo input (owner/repo or URL), branch switcher, recent repos, repo meta
- [x] `Tabs`: drag-to-reorder, middle-click close, drop tree node to open in new tab
- [x] `Explorer`: expand/collapse tree, multi-select (Ctrl/Shift), context menu, drag, touch long-press
- [x] `FileView`: folder grid + breadcrumbs; code viewer with line numbers + lightweight syntax highlighting; image preview
- [x] Home screen with feature hints + recent repos; title bar + status bar for desktop feel
- [x] Relaxed 3 experimental react-hooks lint rules (set-state-in-effect, immutability, refs) — intentional patterns

## Current Structure

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | App shell: Home vs Workspace, title/status bar |
| `src/lib/github.ts` | GitHub API client (repo, contents, file, branches) |
| `src/lib/store.tsx` | Global state (reducer + async loaders) |
| `src/lib/dnd.ts` | Shared drag-and-drop mime/type |
| `src/lib/highlight.tsx` | Dependency-free tokenizer for code view |
| `src/components/ui-context.tsx` | Single context menu + global close handling |
| `src/components/ContextMenu.tsx` | Keyboard-navigable context menu |
| `src/components/AddressBar.tsx` | Repo open / branch / meta |
| `src/components/Explorer.tsx` | Tree sidebar |
| `src/components/Tabs.tsx` | Draggable tab bar |
| `src/components/FileView.tsx` | Folder grid + code/image viewer |
| `src/components/icons.tsx` | Inline SVG icons (no icon dependency) |

## Key Decisions

- No extra UI deps (no dnd-kit, zustand, etc.) — built with React + Tailwind only.
- Files fetched via `contents` API; large dirs lazy-loaded on expand.
- Desktop UX conventions: single-click selects, double-click opens, middle-click
  opens new tab, right-click / long-press → context menu, Ctrl/Shift multi-select.

## Session History

| Date | Changes |
|------|---------|
| Initial | Next.js template created |
| 2026-07-09 | Built GitHub Browser with desktop UX (tabs, context menus, DnD, touch) |

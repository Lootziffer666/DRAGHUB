# Active Context: GitHub Browser (desktop-style repo explorer)

> **Roadmap:** See `/PLAN.md` at the repo root for the full execution plan —
> extended GitHub Browser (Phase 1, milestones M1–M12), gamification seams
> to keep open (Phase 2, spec only), and the separate GitHub-decoupling
> tool "ANVIL Core" planned as `tools/anvil-core` in this same repo
> (Phase 3, spec only). Update this file's "Recently Completed" section as
> each milestone lands.

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
- [x] GitHub **Search** as isolated feature module (`src/features/search/`): repos, related-by-topic, releases & APK discovery; Cmd/Ctrl+K, modal panel, provider/hook pattern
- [x] **Upload/Commit feature**: PAT auth, unpacked upload of zip/7z/rar, staging cache (IndexedDB) kept until commit succeeds, auto-split large commits, Git LFS support
  - `src/lib/github.ts`: added PAT token helpers + `ghRequest` raw fetcher
  - `src/lib/extract.ts`: zip (JSZip) + 7z/rar (libarchive.js WASM) extraction
  - `src/lib/github-write.ts`: commit splitting + LFS batch upload + `.gitattributes`
  - `src/lib/staging.tsx` + `src/lib/staging-db.ts`: IndexedDB-backed cache + provider
  - `src/components/UploadPanel.tsx` + `AddressBar` Upload button: UI

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
| `src/lib/extract.ts` | Archive extraction: zip (JSZip) + 7z/rar (libarchive.js) |
| `src/lib/github-write.ts` | Commit engine: blob/tree/commit, auto-split, Git LFS |
| `src/lib/staging.tsx` + `staging-db.ts` | IndexedDB staging cache persisted until commit succeeds |
| `src/components/UploadPanel.tsx` | Upload modal UI (token, dropzone, staged list, options) |
| `src/features/search/` | **Isolated feature module**: `github-search.ts` (API), `SearchPanel.tsx` (UI), `index.tsx` (`SearchProvider`/`useSearch`/`SearchButton`) |

## Key Decisions

- No extra UI deps (no dnd-kit, zustand, etc.) — built with React + Tailwind only.
- Files fetched via `contents` API; large dirs lazy-loaded on expand.
- Desktop UX conventions: single-click selects, double-click opens, middle-click
  opens new tab, right-click / long-press → context menu, Ctrl/Shift multi-select.

## Module Pattern (convention)

New features live under `src/features/<name>/` as self-contained modules:
own API file, UI, and an `index.tsx` exporting a `Provider` + `useX` hook +
`XButton` trigger. They communicate with core only via existing store callbacks
(`openRepo`, etc.), so existing code is never modified by a new feature.

## Session History

| Date | Changes |
|------|---------|
| Initial | Next.js template created |
| 2026-07-09 | Built GitHub Browser with desktop UX (tabs, context menus, DnD, touch) |
| 2026-07-09 | Added GitHub Search feature module (repos / related / releases+APK) |
| 2026-07-09 | Added Upload/Commit feature (archive unpack, staging cache, commit splitting, LFS) |

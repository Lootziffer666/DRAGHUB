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
- [x] **PLAN.md M1 — Explorer CRUD** + **M2 — Working-Changes/Checkpoint panel** (built together per plan, since M1's ops are meant to land in M2's changeset rather than commit immediately):
  - `src/lib/github-ops.ts`: `WorkingChange` model (add/delete/rename, file/dir), `commitWorkingChanges()` resolves a changeset into git tree ops — renames/moves reuse the existing blob sha (no re-upload), folder rename/delete recursively re-paths every blob under the prefix via a full tree listing
  - `src/lib/github-write.ts`: added `commitChangeset()` + `TreeOpEntry` (upsert/delete/reuse-by-sha) as the generalized single-commit primitive; `createTree` now accepts `sha: null` for deletions
  - `src/lib/github.ts`: added `fetchTreeRecursive()` (recursive git tree read, throws on GitHub's `truncated` flag rather than operating on a partial listing)
  - `src/lib/events.ts`: minimal typed pub/sub (`checkpoint.created`, `change.staged`, …) — the Phase-2/3 seam from PLAN.md §5
  - `src/features/changes/` (module): `changes.tsx` (`ChangesProvider`/`useChanges`, persists pending changes to localStorage + IndexedDB like the existing staging cache; dedups rename-of-a-pending-add and rename-of-a-pending-rename into a single change), `overlay.ts` (merges a directory's base entries with pending deltas for display — added/renamed-in/pending-delete statuses), `actions.ts` (name-prompt/collision helpers), `ChangesPanel.tsx` + `index.tsx` (`ChangesButton`, badge count, "Create checkpoint")
  - `src/components/Explorer.tsx`: rewritten on top of the overlay — New File/New Folder (context menu + root toolbar), Rename, Delete (with confirm), Restore/Discard, drag a node onto a folder row to move it. A brand-new folder is seeded into the store's tree cache directly (no network 404) via `seedDir`. A renamed-in-pending folder is still fully browsable pre-checkpoint by transparently reading through its untouched original path (`readPathFor`); further Rename/Delete of *existing* entries reached that way is disabled (would double-process against the pending move) while creating new files/folders inside it stays safe and enabled
  - `src/lib/store.tsx`: added `seedDir`/`invalidateDir` + `DIR_INVALIDATE` action
  - **Bug fixed along the way**: `ContextMenu.tsx` silently dropped any menu item marked `separatorBefore` — it rendered *only* the divider and never the item's own button, which had already been swallowing "Refresh"/"Copy path" before this session and would have swallowed "Rename"/"New File" too. Fixed to render the divider and the item.
  - **Known gaps for a later pass**: `FileView`'s folder table (main pane) still shows the raw remote listing, not the overlay (Explorer sidebar is the source of truth); `UploadPanel`/`staging.tsx` still commits through its own path rather than the new changeset (M2's stated acceptance criterion — deferred, not done); no in-browser editor yet (M3) so new files are always created empty.


- [x] **PLAN.md M8 — Multi-Repo-„Workspaces"-Refactor**:
  - `src/lib/store.tsx`: refactored the single-repo state into `repos: Record<string, RepoState>` plus `activeRepoKey`, `pinnedRepoKeys`, shared recent/error/loading fields, `switchRepo()`, and `useActiveRepo()` for consumers. Opening another repository now keeps existing repo tabs/tree/selection cached instead of replacing them.
  - Core consumers (`Explorer`, `Tabs`, `FileView`, `AddressBar`, status/title bars, upload/staging, search and changes features) now read repo-local state through the active repo selector.
  - `src/app/page.tsx`: title bar includes a lightweight workspace switcher for already opened repositories, so a second repo can be opened and the first remains switchable without closing it.

- [x] **PLAN.md M3–M7 + M9–M12 — Rest von Phase 1**:
  - M3: `FileView` has an edit mode for text/code files; saving stages a Working Changes delta through the M2 changeset path instead of committing immediately. Conflict-marker files are detected and can be resolved through the same edit-and-stage flow.
  - M4: added `src/lib/lfs.ts` and `src/lib/vitality.ts`; file reads now refuse large previews by default, LFS pointers show an on-demand object download action with progress, and vitality metadata can be fetched lazily from commit history.
  - M5: added `viewMode` (`list`/`grid`/reserved `city`) to repo-local state plus `src/lib/layout.ts` for IndexedDB-backed snap-to-grid layout persistence; folder views now switch between list and grid.
  - M6: added `src/lib/merge.ts` conflict-hunk parsing/resolution primitives and surfaced conflict detection in `FileView`, with resolved output staged as a normal changeset delta.
  - M7/M12: added PR, Issue, and Triage modules (`src/features/pulls`, `issues`, `triage`) with PR classification, list/badge-style panels, token-scope-visible errors, and confirmed bulk close flow.
  - M9: added `src/features/dock` for workspace switching/pinning and visible GitHub rate-limit budget polling that pauses while the document is hidden.
  - M10: added `src/features/control-panel` with Security/Branch-protection scope probes and a CODEOWNERS generator that stages a regular file delta.
  - M11: added `src/features/start-menu` with Codespaces deep-link, releases list, and a written wiki feasibility spike note documenting the separate `.wiki.git` limitation.

## Current Structure

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | App shell: Home vs Workspace, title/status bar |
| `src/lib/github.ts` | GitHub API client (repo, contents, file, branches) |
| `src/lib/store.tsx` | Multi-repo workspace state (repo map + active repo selector, reducer + async loaders) |
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
| `src/lib/github-ops.ts` | `WorkingChange` model + `commitWorkingChanges()` (changeset → single commit) |
| `src/lib/events.ts` | Minimal domain event bus (Phase-2/3 seam) |
| `src/features/changes/` | **Feature module** (M1/M2): `changes.tsx`, `overlay.ts`, `actions.ts`, `ChangesPanel.tsx`, `index.tsx` (`ChangesProvider`/`useChanges`/`ChangesButton`) |
| `src/lib/lfs.ts` | Git LFS pointer parsing and on-demand object download |
| `src/lib/vitality.ts` | Lazy commit-history vitality metadata |
| `src/lib/layout.ts` | Grid snap math and IndexedDB layout persistence |
| `src/lib/merge.ts` | Merge-conflict hunk parsing/resolution primitives |
| `src/features/pulls/` | Pull request list/actions/classification module |
| `src/features/issues/` | Issue list/actions module |
| `src/features/dock/` | Workspace dock, pinning, rate-limit budget polling |
| `src/features/control-panel/` | Security/access/branch-rule probes and CODEOWNERS generator |
| `src/features/start-menu/` | Codespaces/release launcher and wiki feasibility note |
| `src/features/triage/` | Bulk PR triage module built on PR classification |

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
| 2026-07-15 | PLAN.md M1+M2: Explorer CRUD (new/rename/delete/move) staged as a changeset, Working-Changes/Checkpoint panel, single-commit changeset primitive with blob-sha reuse for renames; fixed a `ContextMenu` bug that silently dropped items marked `separatorBefore` |
| 2026-07-15 | PLAN.md M8: Multi-repo workspace state with active repo selector and title-bar workspace switcher; opening another repo preserves the existing repo workspace |
| 2026-07-15 | PLAN.md M3–M7 and M9–M12: editor/delta, LFS and large-file read guards, grid layout, conflict primitives, PR/Issue/Triage modules, Dock, Control Panel, Start Menu, and wiki spike note |

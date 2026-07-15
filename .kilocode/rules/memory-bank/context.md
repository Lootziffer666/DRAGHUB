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
  - **Known gaps for a later pass**: `FileView`'s folder table (main pane) still shows the raw remote listing, not the overlay (Explorer sidebar is the source of truth); `UploadPanel`/`staging.tsx` still commits through its own path rather than the new changeset (M2's stated acceptance criterion — deferred, not done).
- [x] **PLAN.md M3 — In-Browser Code Editing**: CodeMirror 6 (`codemirror` + `@codemirror/lang-*` + `@codemirror/theme-one-dark`), decided over Monaco per §10.3 (no Next.js/webworker friction). `src/components/CodeEditor.tsx` picks a language extension by file extension. `FileContentView` (in `FileView.tsx`) gained Edit/Save/Cancel; Save calls `useChanges().stageEdit()` (new `modify` `ChangeKind`, dedups with an existing pending `add`/`modify` for the same path rather than stacking). Opening a pending new/modified file now reads its content straight from IndexedDB (`loadPendingContent`) instead of hitting the network — this also lifted M1's "new files aren't openable" limitation. "Branch off a new variant" for editing a historical ref was not built — the app has no concept of browsing a ref other than the current branch HEAD, so that scenario doesn't arise yet.
- [x] **PLAN.md M4 — LFS & large-file read awareness**: `src/lib/lfs.ts` detects LFS pointer files by content prefix and downloads the real object on demand via the LFS batch API (with progress). The Explorer's cloud badge is a cheap heuristic — parses `.gitattributes` `filter=lfs` patterns once per (repo, branch) rather than fetching every file's content. `src/lib/vitality.ts` adds a "last changed N days ago"/"stale" badge, fetched (and cached) **only for the currently open file**, not per row in an expanded folder — deliberate to avoid the rate-limit stampede called out in PLAN.md §11.
- [x] **PLAN.md M5 — Spatial layout / Grid view**: `viewMode: "list" | "grid" | "city"` added to the store (`"city"` reserved for Phase 2, not selectable). `src/lib/layout.ts` persists snap-to-grid positions in IndexedDB keyed by (repo, branch, folder path); new entries auto-place into the first free cell. `GridView` in `FileView.tsx` renders draggable tiles reusing the same selection/menu callbacks as `FolderView`. Team-shared layout (a dedicated ref) was not built — deferred alongside M6/M8/M11's other "generalize refs beyond `refs/heads`" ideas.
- [x] **PLAN.md M6 — Merge conflict resolution**: `src/lib/merge.ts` (with a `bun test` suite — 16 cases) implements a dependency-free line-based 3-way merge: disjoint edits on both sides auto-apply, overlapping-and-different edits become conflict hunks. Getting zero-width insertions right (an insert next to an untouched region must not make that whole region look "changed") took a rewrite — first attempt folded pure inserts into a neighboring op and caused false-positive conflicts for the very common "both sides appended independently" case; fixed by keeping insertions as their own zero-width ops and handling them explicitly in the merge walk (see `merge.test.ts`'s dedicated insertion cases). `src/features/merge/`: `compare.ts` (GitHub compare API — two calls: `ours...theirs` for the true merge-base + theirs' changes, then `mergeBase...ours` for ours' changes), `plan.ts` (per-file classification: clean add/modify/delete/no-op vs. text conflict vs. add-add conflict vs. delete-modify conflict), `merge-session.tsx` (`MergeSessionProvider`/`useMergeSession`), `MergePanel.tsx` (branch picker → file list → side-by-side Ours/Theirs/Both per conflict hunk). The resolved result is staged as an ordinary `modify`/`add`/`delete` working change (M2) — no special commit path. Binary-file conflicts and delete-vs-rename are out of scope; delete-vs-modify gets a simplified Keep/Delete choice instead of a hunk view.
- [x] **PLAN.md M7 — Pull Requests & Issues module**: `src/features/pulls/` and `src/features/issues/`, both following the module convention. `classify.ts` (with a `bun test` suite — 8 cases) gives each PR a `clean | conflict | failing | needs-review | spam-suspect` badge; "spam-suspect" is deliberately simple (diff size vs. description length once the lazy detail fetch resolves, a weaker title-based fallback before that) — explicitly no ML. `mergeable` state and check-run summaries are fetched lazily per-PR only when its row is expanded, not for the whole list — same rate-limit caution as M4's vitality badge. Actions (merge/close/request-review/label for PRs; close/label for issues) surface the real 403/422 from GitHub inline rather than pre-checking token scope (that's M10's requirement, not M7's).

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
| `src/lib/github-ops.ts` | `WorkingChange` model + `commitWorkingChanges()` (changeset → single commit) |
| `src/lib/events.ts` | Minimal domain event bus (Phase-2/3 seam) |
| `src/features/changes/` | **Feature module** (M1/M2): `changes.tsx`, `overlay.ts`, `actions.ts`, `ChangesPanel.tsx`, `index.tsx` (`ChangesProvider`/`useChanges`/`ChangesButton`) |
| `src/components/CodeEditor.tsx` | CodeMirror 6 wrapper, picks a language extension by file extension (M3) |
| `src/lib/lfs.ts` | LFS pointer detection + on-demand batch-API download (M4) |
| `src/lib/vitality.ts` | Cached "last changed"/"stale" lookup for the open file only (M4) |
| `src/lib/layout.ts` | Snap-to-grid layout persistence in IndexedDB, keyed by (repo, branch, folder) (M5) |
| `src/lib/merge.ts` (+ `merge.test.ts`) | Dependency-free line-based 3-way merge — pure logic, `bun test` covered (M6) |
| `src/features/merge/` | **Feature module** (M6): `compare.ts`, `plan.ts`, `merge-session.tsx` (`MergeSessionProvider`/`useMergeSession`), `MergePanel.tsx`, `index.tsx` (`MergeProvider`/`MergeButton`) |
| `src/features/pulls/` | **Feature module** (M7): `api.ts`, `classify.ts` (+ test), `pulls-store.tsx` (`PullsProvider`/`usePulls`), `PullsPanel.tsx`, `index.tsx` (`PullsButton`) |
| `src/features/issues/` | **Feature module** (M7): `api.ts`, `issues-store.tsx` (`IssuesProvider`/`useIssues`), `IssuesPanel.tsx`, `index.tsx` (`IssuesButton`) |

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
| 2026-07-15 | PLAN.md M3: CodeMirror-based in-browser editing, saves as a `modify` working change |
| 2026-07-15 | PLAN.md M4: Git LFS pointer detection + on-demand download, vitality ("last changed"/"stale") badge for the open file |
| 2026-07-15 | PLAN.md M5: Grid view with persisted, snap-to-grid, per-folder layout |
| 2026-07-15 | PLAN.md M6: dependency-free 3-way merge (`bun test` covered) + branch-merge UI staging results into the existing changeset |
| 2026-07-15 | PLAN.md M7: Pull Requests & Issues modules with PR classification (`bun test` covered), lazy detail/check fetching, merge/close/label/request-review actions |

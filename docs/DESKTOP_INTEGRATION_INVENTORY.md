# Desktop integration — inventory and per-window state design

Companion document for the first post-PR #8 integration pass
(`docs/POST_PR8_REFERENCE_INTEGRATION.md`). Status: 2026-07-20.

## 1. Module inventory → desktop applications

| Existing module | Target surface | Status |
| --- | --- | --- |
| `AddressBar` | repository main-window surface (open-repo routed to new windows, close routed to window close) | integrated |
| `Explorer` | repository main-window surface | integrated |
| `Tabs` | repository main-window surface | integrated |
| `FileView` (incl. tab editor, LFS, conflicts, grid) | repository main-window surface | integrated |
| `CodeEditor` + `editor-sessions` + FLUBBER | main-window tabs **and** `file-editor` child application | integrated |
| Search (`features/search`) | global launcher (taskbar + Ctrl/Cmd-K); results resolve to `repository` resources via `openOrFocusWindow` | integrated |
| Changes (`features/changes`) | `github-feature` child application (`featureId: "changes"`) + toolbar badge; buckets in module store | integrated |
| Pull requests (`features/pulls`) | `github-feature` child (`pull-requests`) via rubber band | integrated |
| Issues (`features/issues`) | `github-feature` child (`issues`) via rubber band | integrated |
| Actions | `github-feature` child (`actions`, run list + link-out) | integrated (minimal) |
| Recycle Bin (`lib/recycle-bin` domain store) | `recycle-bin` system application (kernel entries + staged deletions + retained drafts) | integrated |
| Settings | `settings` system application (PAT, desktop reset) | integrated |
| Upload / staging (`UploadPanel`, `lib/staging`) | repository window via AddressBar | mounted, own commit path (M2 gap unchanged) |
| Triage (`features/triage` API + classify) | `github-feature` child (`triage`) via rubber band; bulk close with explicit double-confirm | integrated |
| Control Panel (`features/control-panel` API) | `github-feature` children: `security` (scope probes + CODEOWNERS staged as a working change) and `settings` (branch-protection probe + link-out) | integrated |
| Start Menu (`features/start-menu` API) | `github-feature` child (`releases`): releases list, Codespaces deep-link, wiki limitation note | integrated |
| Dock (`features/dock`, M9) | superseded by the kernel taskbar; module retained for the rate-limit budget logic to be re-homed later | superseded |

## 2. Per-window repository-state design

Mandatory rule honored: no desktop application derives its repository from a
global active pointer.

- `src/lib/store.tsx` now carries an explicit `repoKey` on every
  repository-scoped action; `RepoScope` (React context) fixes the repository
  for an entire subtree. `RepositoryExplorerApp` wraps its window contents in
  `RepoScope(repoKey)`, so `useStore()`/`useActiveRepo()` inside a window
  resolve to that window's repository — the same components work unchanged.
- Scoped action sets are memoized per repoKey and read live state through a
  ref, so concurrent windows mutate only their own workspace.
- Pending changes live in a module-level per-repo bucket store
  (`features/changes/store.ts`). Each repository window (and each Changes
  child window) mounts its own `ChangesProvider` bound to the scoped repo;
  the Recycle Bin window, taskbar badge and lifecycle adapter read buckets by
  explicit repoKey.
- Editor drafts remain keyed by `(repoKey, path)` (`lib/editor-sessions`),
  shared consistently between tab editors and `file-editor` child windows.
- Child windows resolve their repository from their `file`/`github-feature`
  resource (`repoKey` explicit), never from focus. Ownership stays
  `{ type: "repository", repoKey, repositoryWindowId }` per the kernel.
- Note: window-local UI state (tabs/tree/selection) is keyed per `repoKey`;
  since the kernel prevents duplicate windows for the same resource, this is
  equivalent to `repositoryWindowId + repoKey` today. If explicitly-requested
  duplicate repo windows arrive later, `RepoScope` gains the window id.

## 3. Lifecycle adapters (Stage 4)

`features/desktop-apps/lifecycle-adapter.ts` implements
`WindowLifecycleAdapter` + `RecycleBinLifecycleAdapter`:

- inspect: dirty editor sessions (repo-wide for repository windows, per-file
  for `file-editor` children, attributed to the owning window) and pending
  working-change counts.
- commit-and-close: stages dirty drafts, then one checkpoint per repository
  via the existing commit engine; fails cleanly without a token.
- discard-to-recycle-bin-and-close: unsaved drafts → kernel `draft` entries
  (restored through the adapter into editor sessions); staged changes → the
  domain retention store (blobs kept, 7-day grace).
- The window manager keeps transaction guards; no domain logic moved into it.

## 4. daedalOS concepts — adopted / deferred / rejected

- Adopted now: none beyond what the kernel already established (grouped
  taskbar, desktop shortcuts, window lifecycle) — the first pass is pure
  DRAGHUB integration per the brief.
- Deferred (good candidates next): file-type→application associations and
  explicit "Open With", launcher search over applications + recent resources,
  taskbar hover previews, recent-resource tracking, richer registry metadata.
- Rejected: general virtual filesystem, bundled app zoo, theming
  infrastructure, service-worker FS emulation, process abstractions
  duplicating the kernel.

## 5. Explicitly not touched

Shares/device bridge (see `docs/adr/ADR-EXPLICIT-SHARES-ONLY.md`), Theia,
ANVIL-Core backend, agents/validation/Playwright-in-product, SWIFT/SHADED/
TRIVIUM, new speculative resource types, visual redesign. Kernel contracts
(persistence v5 — extended only by the additive `file-editor` application id —
close transactions, ownership, presentation/minimized split) unchanged.

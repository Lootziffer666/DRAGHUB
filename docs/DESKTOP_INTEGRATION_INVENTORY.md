# Desktop integration — inventory and per-window state design

Companion document for the first post-PR #8 integration pass
(`docs/POST_PR8_REFERENCE_INTEGRATION.md`). Status: 2026-07-21 (includes the
post-integration fix pass that closed five isolation gaps left by the first
pass — see §2, §3 and §6 below).

## 1. Module inventory → desktop applications

| Existing module | Target surface | Status |
| --- | --- | --- |
| `AddressBar` | repository main-window surface (open-repo routed to new windows, close routed to window close) | integrated |
| `Explorer` | repository main-window surface | integrated |
| `Tabs` | repository main-window surface | integrated |
| `FileView` (incl. tab editor, LFS, conflicts, grid) | repository main-window surface | integrated |
| `CodeEditor` + `editor-sessions` + FLUBBER | main-window tabs **and** `file-editor` child application | integrated |
| Search (`features/search`) | global launcher (taskbar + Ctrl/Cmd-K); results resolve to `repository` resources via `openOrFocusWindow`; Related search context is an explicit `relatedRepoKey` derived from the focused window | integrated |
| Changes (`features/changes`) | `github-feature` child application (`featureId: "changes"`) + toolbar badge; buckets in module store | integrated |
| Pull requests (`features/pulls`) | `github-feature` child (`pull-requests`) via rubber band | integrated |
| Issues (`features/issues`) | `github-feature` child (`issues`) via rubber band | integrated |
| Actions | `github-feature` child (`actions`, run list + link-out) | integrated (minimal) |
| Recycle Bin (`lib/recycle-bin` domain store + `features/recycle-bin/recycle-bin-summary.ts` pure helpers) | `recycle-bin` system application (kernel entries + staged deletions + retained drafts); Empty clears kernel and retained entries together | integrated |
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
- Repository hydration status (loading/error) is a `repoRequests` map on the
  store keyed by lowercased repoKey (`useRepoRequest(repoKey)`), not a single
  global flag — two repository windows loading or retrying concurrently never
  see each other's status. `REPO_LOADED` reconciles a hand-typed request key
  against the API's canonical `fullName` casing.

## 3. Lifecycle adapters (Stage 4)

`features/desktop-apps/lifecycle-adapter.ts` implements
`WindowLifecycleAdapter` + `RecycleBinLifecycleAdapter`. Both `inspectClose`
and `resolveClose` derive their close-domain scope from the same pure
`deriveCloseScope(target)`, so inspection and resolution can never disagree
about what a transaction is allowed to touch:

- `repository` scope (repository-explorer windows): unchanged repo-wide
  behavior — inspect every dirty draft in the repo plus the Working Changes
  bucket; commit-and-close stages all dirty drafts and checkpoints the whole
  repository via the existing commit engine (fails cleanly without a token);
  discard moves every draft to a kernel `draft` entry and the Working
  Changes bucket to the domain retention store (blobs kept, 7-day grace).
- `editor` scope (`file-editor` windows): touches exactly its own file.
  Inspection reports a blocker only for its own dirty draft. Commit-and-close
  stages only that file as a Working Change and never checkpoints. Discard
  creates exactly one kernel draft entry for that file. Neither action
  touches any other draft or the repository's Working Changes bucket.
- `viewer` scope (`image-viewer` windows): never blocked by any draft
  (including a same-path editor draft) and never stages, commits, discards,
  or retains repository changes — close is always a no-op for domain state.
- `none` (every other application/system/tool window): no implicit
  repo-wide draft or Working Change behavior.
- The window manager keeps transaction guards; no domain logic moved into it.

## 4. daedalOS concepts — adopted / deferred / rejected

- Adopted (2026-07-21): file-type→application associations and explicit
  "Open With", via the file handler registry (§6).
- Adopted at first pass: none beyond what the kernel already established
  (grouped taskbar, desktop shortcuts, window lifecycle) — that pass was
  pure DRAGHUB integration per the brief.
- Deferred (good candidates next): archive viewer (inline ZIP browsing),
  full Tree View window, Repository Gallery, Local Tool Broker for native
  program handoff, launcher search over applications + recent resources,
  taskbar hover previews, recent-resource tracking.
- Rejected: general virtual filesystem, bundled app zoo, theming
  infrastructure, service-worker FS emulation, process abstractions
  duplicating the kernel.

## 5. Explicitly not touched

Shares/device bridge (see `docs/adr/ADR-EXPLICIT-SHARES-ONLY.md`), Theia,
ANVIL-Core backend, agents/validation/Playwright-in-product, SWIFT/SHADED/
TRIVIUM, new speculative resource types, visual redesign, archive
extraction/execution (no archive viewer yet — `.zip`/`.7z`/`.rar` only
offer Download), native/local program handoff (Local Tool Broker, not
built). Kernel contracts (persistence v5 — extended only by the additive
`file-editor`, `raw-text-viewer` and `audio-player` application ids —
close transactions, ownership, presentation/minimized split) unchanged.

## 6. File handler registry and Open With (2026-07-21)

`src/features/desktop-apps/file-handlers/` answers "what can open this
file" with registered `FileHandlerDefinition` entries instead of
`if (extension === ...)` branches spread across the file window
components:

- `extensions` (empty = wildcard) plus `canHandle(resource)` decide
  applicability; `priority` (registration order as tiebreaker) ranks the
  "Open with" menu and picks the default handler.
- Registered today: Code Editor (`file-editor`), Image Viewer /
  Markdown Preview (`image-viewer`, the existing generic File Viewer app),
  Raw Text (new `raw-text-viewer` app — literal source, no Markdown
  rendering), Audio Player (new `audio-player` app), and a `Download`
  sentinel handled by the menu itself (fetches the authenticated blob,
  triggers a browser download — never opens a window).
- `OpenWithMenu` (`RepositoryExplorerApp`'s toolbar) lists
  `handlersForSurface(resource, "window")` for the active tab; it replaced
  the previous unconditional "Viewer window"/"Editor window" buttons,
  which offered every action for every file regardless of type.
- Backed by a shared binary resource adapter — `getRepositoryBlob` /
  `getRepositoryArrayBuffer` / `getRepositoryText` in `src/lib/github.ts`,
  built on the existing authenticated `fetchRepositoryBlob` — so image,
  audio and future archive support share one GitHub downloader and one
  preview-size guard instead of three independent ones.

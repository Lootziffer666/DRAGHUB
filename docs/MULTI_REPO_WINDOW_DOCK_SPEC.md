# DRAGHUB — Multi-Repo Window Manager and Dock Contract

**Status:** Build-ready correction and extension  
**Supersedes:** the assumption that one active repository fills the whole application  
**Depends on:** the existing search module, repository browser, tabs, working changes and `DRAGHUB_BUILD_SPEC.md`

---

## 1. Correct product behavior

DRAGHUB is a desktop surface. Repositories are applications/workspaces on that surface.

Searching for and selecting a repository must not replace the currently open repository. It must open or focus a dedicated repository window.

```text
Search
→ choose repository
→ create repository window
→ keep existing repository windows alive
→ add repository to Dock
```

The default is one window per `owner/repo`. Selecting an already-open repository restores and focuses its existing window instead of creating a duplicate.

An explicit future action may allow opening another window for a different branch or checkpoint of the same repository, but accidental duplicates are forbidden.

---

## 2. Current-state correction

The Dock is not hidden by CSS. It does not exist yet in the current implementation.

The present store contains one singular repository state (`state.meta`) and `openRepo()` replaces that state. The search panel currently calls `openRepo(fullName)` and closes itself. Therefore:

- only one repository can exist at a time,
- a second search result replaces the first repository,
- there is no window identity,
- there is no minimized state,
- there is nothing for a Dock to represent.

The correct dependency order is:

```text
Multi-repo state
→ internal window manager
→ search opens/focuses windows
→ persistent Dock
→ minimize/restore behavior
```

Do not implement a decorative Dock before the state model can hold multiple repositories.

---

## 3. Internal windows, not browser popups

Repository windows are managed inside the DRAGHUB desktop canvas.

Do not use `window.open()` or separate browser tabs as the primary implementation because browser popups:

- may be blocked,
- cannot be positioned reliably,
- do not share the application state cleanly,
- make minimization into the DRAGHUB Dock impossible,
- behave differently across desktop and mobile browsers.

Use React-rendered internal windows now. A later Tauri shell may map them to native windows without changing the repository/window contracts.

---

## 4. Required state model

```ts
export type RepoKey = `${string}/${string}`;

export type RepoWorkspaceState = {
  repoKey: RepoKey;
  meta: RepoMeta;
  tabs: Tab[];
  activeTabId: string | null;
  treeCache: Record<string, GithubEntry[]>;
  treeState: Record<string, "loading" | "loaded" | "error">;
  expanded: Record<string, boolean>;
  selection: string[];
  branch: string;
  pendingChangesCount: number;
};

export type DesktopWindowState = {
  id: string;
  kind: "repository" | "tool" | "system";
  repoKey?: RepoKey;
  title: string;
  icon?: string;
  state: "normal" | "minimized" | "maximized";
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  restoreBounds?: DesktopWindowState["bounds"];
  zIndex: number;
  createdAt: number;
  lastFocusedAt: number;
};

export type DesktopState = {
  repositories: Record<RepoKey, RepoWorkspaceState>;
  windows: Record<string, DesktopWindowState>;
  windowOrder: string[];
  activeWindowId: string | null;
  dockOrder: string[];
  recentRepoKeys: RepoKey[];
};
```

A repository workspace and its visual window are separate records:

- repository state survives minimization,
- minimizing does not unload files or tabs,
- closing a window may release its workspace after unsaved-change checks,
- the same future repository state may be shown by more than one window only when explicitly requested.

---

## 5. Window manager actions

```ts
export type WindowAction =
  | { type: "OPEN_REPOSITORY_WINDOW"; repoKey: RepoKey }
  | { type: "FOCUS_WINDOW"; windowId: string }
  | { type: "MOVE_WINDOW"; windowId: string; x: number; y: number }
  | { type: "RESIZE_WINDOW"; windowId: string; width: number; height: number }
  | { type: "MINIMIZE_WINDOW"; windowId: string }
  | { type: "RESTORE_WINDOW"; windowId: string }
  | { type: "MAXIMIZE_WINDOW"; windowId: string }
  | { type: "CLOSE_WINDOW"; windowId: string }
  | { type: "SET_DOCK_ORDER"; windowIds: string[] };
```

Required invariants:

1. Focusing a window moves it above all normal windows.
2. A minimized window is absent from the desktop canvas but remains in the Dock.
3. Clicking its Dock item restores and focuses it.
4. Clicking the active normal window's Dock item minimizes it.
5. Maximizing stores previous bounds and fills the usable desktop area above the Dock.
6. Restoring a maximized window returns to its exact previous bounds.
7. Closing is different from minimizing.
8. A repository with pending changes cannot close silently.
9. Window geometry is clamped so the title bar cannot become unreachable.
10. Opening an existing repo focuses/restores its window instead of reloading it.

---

## 6. Search behavior

The current search panel remains the global launcher (`Ctrl/Cmd+K`).

Selecting a repository must call:

```ts
openRepositoryWindow(fullName)
```

not the current singular:

```ts
openRepo(fullName)
```

Required behavior:

```text
Result selected
├─ Repo already open and normal
│  └─ focus existing window
├─ Repo already open and minimized
│  └─ restore + focus existing window
└─ Repo not open
   └─ load repository state + create window + add Dock item
```

Search closes only after the open/focus operation has been accepted. Loading and errors belong to the target repository window or a small launcher status, not to a global replacement screen.

Search result affordances:

- single click / Enter: open or focus repository window,
- optional context action: open GitHub page externally,
- later: open branch/checkpoint in separate window.

---

## 7. Repository window

Each repository window contains the current repository workspace UI:

```text
┌──────────────────────────────────────────────────────┐
│ ● ● ●  owner/repo · branch                 _  □  ×  │
├──────────────────────────────────────────────────────┤
│ Address / branch / search / changes                  │
├──────────────┬───────────────────────────────────────┤
│ Explorer     │ Tabs + FileView                       │
│              │                                       │
├──────────────┴───────────────────────────────────────┤
│ repository-specific status                          │
└──────────────────────────────────────────────────────┘
```

The existing `Workspace`, `TitleBar`, `AddressBar`, `Explorer`, `Tabs`, `FileView` and `StatusBar` become the contents of `RepositoryWindow`.

They must consume a repository/window-scoped context rather than a single global active repository.

Suggested structure:

```text
src/features/desktop/
  desktop.tsx
  DesktopCanvas.tsx
  WindowFrame.tsx
  Dock.tsx
  geometry.ts
  persistence.ts

src/features/repositories/
  repository-store.tsx
  RepositoryWindow.tsx
```

---

## 8. Dock contract

The Dock is always mounted whenever the DRAGHUB desktop is visible.

It is not rendered inside a repository window. It belongs to the desktop root, outside all movable windows.

```text
┌──────────────────────────────────────────────────────────────┐
│ Desktop canvas                                               │
│                                                              │
│   [Repo window A]       [Repo window B]                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Search  │  A  │  B  │  PDF→MD  │  Changes/Jobs  │  Settings│
└──────────────────────────────────────────────────────────────┘
```

Initial Dock items:

1. global Search/Launcher,
2. one item for every open repository window,
3. active/minimized indicator,
4. optional pending-change badge,
5. later embedded tool widgets and jobs.

Repository Dock item states:

```text
active normal    → highlighted
open background  → visible neutral marker
minimized        → recessed/minimized marker
pending changes  → badge
loading/error    → spinner/error marker
```

Dock behavior:

- remains visible when every repository is minimized,
- remains visible when no repository is open,
- supports drag reordering,
- persists order locally,
- does not poll GitHub merely to exist,
- later PR/CI badges are additive and rate-limit-aware.

The Dock must have reserved layout space. Windows maximize to the desktop work area, never behind the Dock.

---

## 9. Desktop home behavior

The current full-screen `Home` page becomes the empty desktop state, not a separate mode that disappears after one repo opens.

When no windows are open:

```text
Desktop wallpaper / ambient surface
+ central search launcher
+ recent repositories
+ always-visible Dock
```

When windows exist, the same desktop remains behind them.

This eliminates the current binary:

```text
Home OR Workspace
```

and replaces it with:

```text
Desktop
├─ zero or more windows
├─ global overlays
└─ persistent Dock
```

---

## 10. Persistence

Persist only lightweight desktop state in browser storage:

```ts
export type PersistedDesktopState = {
  windows: Array<Pick<
    DesktopWindowState,
    "id" | "kind" | "repoKey" | "state" | "bounds" | "restoreBounds" | "zIndex"
  >>;
  dockOrder: string[];
  activeWindowId: string | null;
};
```

On reload:

1. restore Dock and window shells,
2. lazily reload repository metadata/state,
3. show per-window loading state,
4. restore tabs and selected paths where safe,
5. clamp old bounds to the current viewport.

Do not duplicate complete repository trees in localStorage. Existing caches remain in their appropriate stores.

---

## 11. Responsive behavior

Desktop/tablet:

- movable/resizable overlapping windows,
- visible Dock,
- minimize/maximize/close controls.

Narrow mobile viewport:

- only one normal window shown full-screen at a time,
- other open repositories remain represented in the Dock,
- Dock becomes horizontally scrollable,
- minimize returns to desktop/launcher,
- no tiny overlapping windows.

The state model stays identical; only presentation changes.

---

## 12. Implementation sequence

### Step 1 — Multi-repo state without visual windows

- replace singular repository state with `repositories: Record<RepoKey, RepoWorkspaceState>`,
- introduce repository-scoped selectors/actions,
- preserve existing single-repo behavior,
- allow two repository states to remain loaded.

Acceptance:

- opening repo B does not discard repo A,
- tabs/tree/selection stay independent per repo.

### Step 2 — Desktop and repository windows

- introduce `DesktopProvider`,
- render current workspace inside `RepositoryWindow`,
- focus/z-order,
- drag title bar,
- resize,
- close with pending-change guard.

Acceptance:

- two repositories visible simultaneously,
- interactions affect the correct repository only.

### Step 3 — Search integration

- replace `openRepo` usage in `SearchPanel` with `openRepositoryWindow`,
- restore/focus existing windows,
- prevent accidental duplicates.

Acceptance:

- repeated selection of a minimized repo restores it,
- selecting a new repo creates another window.

### Step 4 — Persistent Dock

- mount Dock at desktop root,
- show all open repository windows,
- minimize/restore toggle,
- active state,
- pending-change badge,
- drag reorder and persistence.

Acceptance:

- Dock is visible with zero, one or many windows,
- minimizing every repo leaves a usable desktop and Dock.

### Step 5 — Geometry and session restoration

- persist window bounds/state/order,
- restore after reload,
- viewport clamping,
- responsive single-window mobile mode.

---

## 13. Required first vertical slice

Build this exact story before adding widgets or PR badges:

```text
1. DRAGHUB opens to desktop with visible Dock and Search item.
2. User presses Ctrl+K and selects Repo A.
3. Repo A opens in an internal window and appears in Dock.
4. User searches Repo B.
5. Repo B opens in a second window; Repo A remains intact.
6. User minimizes Repo A.
7. Repo A disappears from canvas but remains in Dock.
8. User clicks Repo A in Dock.
9. Repo A restores with its previous tabs, path, size and position.
10. User searches Repo A again.
11. Existing Repo A window focuses; no duplicate is created.
12. Reload restores both repository windows and the Dock.
```

---

## 14. Explicit exclusions

Do not:

- treat repository tabs as a substitute for repository windows,
- use browser popups as the window manager,
- unload a repository when it is minimized,
- hide the Dock when no repo is active,
- keep `Home` and `Workspace` as mutually exclusive full-screen application modes,
- make Dock visibility depend on GitHub polling,
- create duplicate windows for the same repo on every search selection,
- mix global search state into one repository workspace,
- implement widgets before repository window lifecycle is stable.

---

## 15. Definition of done

This feature is complete when:

- several repositories can remain open concurrently,
- each repository has an independent internal window,
- search opens or focuses the correct repository window,
- windows can move, resize, minimize, maximize, restore and close,
- minimized windows remain available through the Dock,
- the Dock is always visible on the desktop surface,
- one active window controls z-order and keyboard context,
- repository tabs/tree/changes do not leak between windows,
- duplicate repository windows are prevented by default,
- window state and Dock order survive reload,
- mobile presentation uses the same state model without unusable overlapping windows.

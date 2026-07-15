# DRAGHUB — Rubber-Band Workspace, Grouped Windows and Media Viewer

**Status:** Build-ready UI and interaction contract  
**Binding precedence:** This document is the latest and controlling UI specification wherever earlier desktop-shell documents imply that repository-specific GitHub feature applications replace the file workspace or appear as fourteen desktop icons per repository.  
**Supplements:** `DRAGHUB_BUILD_SPEC.md`, `MULTI_REPO_WINDOW_DOCK_SPEC.md`, `GITHUB_DESKTOP_SHELL_SPEC.md`  
**Primary correction:** the repository window is always a file workspace; GitHub feature applications and contextual tools attach to that window as a flexible Rubber Band instead of replacing the workspace

---

## 1. Product decision

The center of every repository window is always the repository itself:

- folders,
- files,
- thumbnails,
- editable source and text,
- pending changes,
- file operations.

GitHub features such as Issues, Pull Requests, Actions, Security and Settings are not the main content of the repository window and are not scattered across the desktop by default.

They live in a **Rubber Band** attached to the repository window.

```text
┌────────────────────────────────────────────────────────────┐
│ Rubber Band: Code · Issues · PRs · Actions · Security · … │
├────────────────────────────────────────────────────────────┤
│ Repository window                                          │
│                                                            │
│ folders / files / thumbnails / editor                      │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ changes / status / branch                                  │
└────────────────────────────────────────────────────────────┘
```

The Rubber Band moves, minimizes, maximizes and restores with its parent repository window.

It may collapse, expand or dock to a different edge, but it is never an unrelated desktop ornament.

---

## 2. Mental model

```text
Repository window = workspace
Rubber Band       = attached applications and controls
Viewer            = child application window
Taskbar           = grouped running windows
Desktop           = repository shortcuts and global system objects
```

The user should always know which repository an application belongs to.

Opening `Actions` from the MYTHIC Rubber Band must open the Actions application in the context of MYTHIC, not as an ambiguous global GitHub window.

---

## 3. Repository window is file-first

The initial and persistent main surface of a repository window is a file workspace.

```text
┌──────────────────────────────────────────────────────────────┐
│ MYTHIC · main                                  _  □  ×       │
├──────────────────────────────────────────────────────────────┤
│ Rubber Band                                                 │
├──────────────┬───────────────────────────────────────────────┤
│ Folder tree  │ File area                                    │
│              │                                               │
│              │ folders / files / image thumbnails            │
│              │ or active editor                              │
├──────────────┴───────────────────────────────────────────────┤
│ Pending changes · branch · sync · local run state            │
└──────────────────────────────────────────────────────────────┘
```

Required behavior:

- opening a repository shows its root folder,
- opening GitHub feature applications must not navigate the repository window to a replacement page,
- closing a feature application returns focus to the unchanged file workspace,
- folder position, selection, tabs and editor state survive feature-app use,
- maximizing the repository window still leaves its Rubber Band reachable,
- minimizing the repository window minimizes its attached Rubber Band and optionally its child windows according to grouping rules.

---

## 4. Rubber Band definition

The Rubber Band is a repository-scoped application launcher and status rail physically attached to a repository window edge.

```ts
export type RubberBandEdge = "top" | "left" | "right" | "bottom";

export type RubberBandState = {
  repoKey: RepoKey;
  edge: RubberBandEdge;
  collapsed: boolean;
  autoHide: boolean;
  thickness: number;
  itemOrder: RubberBandItemId[];
  hiddenItemIds: RubberBandItemId[];
  overflowMode: "scroll" | "menu";
  activeItemId?: RubberBandItemId;
};

export type RubberBandItem = {
  id: RubberBandItemId;
  repoKey: RepoKey;
  kind: "github-feature" | "repository-command" | "status" | "separator";
  featureId?: GithubFeatureId;
  commandId?: RepositoryCommandId;
  title: string;
  iconKey: string;
  availability: FeatureAvailability;
  badge?: RubberBandBadge;
};
```

### 4.1 Attached geometry

The Rubber Band is calculated from the repository window bounds.

```ts
export type AttachedSurfaceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getRubberBandBounds(
  parentBounds: WindowBounds,
  edge: RubberBandEdge,
  thickness: number
): AttachedSurfaceBounds;
```

Invariants:

1. Moving the repository window moves the Rubber Band in the same animation frame.
2. Resizing the repository window resizes or reflows the Rubber Band.
3. Maximizing the repository window keeps the Rubber Band inside the usable desktop area.
4. The Rubber Band never occupies separate Taskbar identity.
5. The Rubber Band never remains visible after its parent window is minimized or closed.
6. Restoring the repository window restores the previous Rubber Band edge, state and scroll position.
7. Child feature windows may remain minimized in the Taskbar even if the parent repository is minimized, but their group must clearly indicate the parent repository.

### 4.2 Default position

Desktop default:

```text
Top edge, below title bar
```

This preserves maximum horizontal workspace and makes the feature rail behave like a flexible replacement for GitHub's repository tabs.

Supported user alternatives:

- left edge for vertical application icons,
- right edge for wide screens,
- bottom edge above the repository status bar.

### 4.3 Collapse behavior

Expanded:

```text
[Code] [Issues 3] [Pull Requests 2] [Actions !] [Projects] …
```

Collapsed:

```text
[GitHub applications ▸]
```

Auto-hide is optional and off by default. Discoverability is more important than reclaiming a few pixels.

### 4.4 Overflow

The Rubber Band must not shrink icons into unusable targets.

When space is insufficient:

```text
visible priority items
+ horizontal/vertical scroll
+ overflow button
```

Default priority:

1. Code,
2. Pull Requests,
3. Issues,
4. Actions,
5. Security,
6. remaining applications,
7. Settings last but always reachable through overflow.

User reordering is persisted per repository or globally according to Settings.

---

## 5. Rubber Band contents

The Rubber Band may include:

### 5.1 GitHub feature applications

- Code,
- Issues,
- Pull Requests,
- Actions,
- Projects,
- Wiki,
- Discussions,
- Security,
- Insights,
- Releases,
- Branches,
- Packages,
- Codespaces,
- repository Settings.

### 5.2 Repository commands

- Search within repository,
- New file/folder,
- Upload/drop,
- Changes,
- Run locally,
- Stop/restart,
- Checkpoint,
- Sync/fetch,
- Repository properties.

These commands may be visually separated from GitHub feature applications.

### 5.3 Status badges

Examples:

```text
Issues           4
Pull Requests    2
Actions          failure indicator
Security         3 high
Changes          7 pending
Runner           active
```

Badges must be informative but must not cause background API polling merely to animate the Rubber Band. Data is fetched through existing feature-state policies.

---

## 6. Opening a Rubber Band application

Selecting an application does not navigate the repository window away from files.

Resolution:

```text
Application already open for this repo?
├─ normal      → focus it
├─ minimized   → restore and focus it
└─ not open    → create child application window
```

Default presentation:

```text
separate managed child window
```

Optional presentation modes supported later:

- side panel attached inside the repository window,
- tabbed child-window group,
- full child window.

The window contract must not assume one presentation forever.

```ts
export type ChildPresentation =
  | "window"
  | "attached-panel"
  | "tabbed-group";
```

### 6.1 No new page

The browser URL may reflect state for restoration, but opening a feature application must not create a user-visible page transition.

Forbidden behavior:

```text
click image
→ route to /viewer

click Actions
→ replace whole repository workspace with Actions page
```

Required behavior:

```text
click image
→ open viewer child window

click Actions
→ open/focus Actions child window
```

---

## 7. Child-window ownership

Every feature or viewer window has an owning repository window.

```ts
export type WindowOwner =
  | { type: "desktop" }
  | { type: "repository"; repoKey: RepoKey; repositoryWindowId: WindowId };

export type DesktopWindowState = {
  id: WindowId;
  kind:
    | "repository"
    | "github-feature"
    | "viewer"
    | "editor"
    | "tool"
    | "system";
  owner: WindowOwner;
  applicationId: ApplicationId;
  documentId?: string;
  title: string;
  state: "normal" | "minimized" | "maximized";
  bounds: WindowBounds;
  restoreBounds?: WindowBounds;
  zIndex: number;
  groupKey: WindowGroupKey;
  createdAt: number;
  lastFocusedAt: number;
};
```

Ownership provides:

- correct repository context,
- grouped Taskbar behavior,
- coordinated close/minimize prompts,
- independent windows without state ambiguity,
- restoration after reload.

---

## 8. File workspace views

The file area supports at least two views:

```ts
export type FileWorkspaceViewMode = "details" | "icons";
```

### 8.1 Details view

Rows contain:

- type icon or image thumbnail,
- name,
- pending-change state,
- size,
- last checkpoint/change date where available,
- file type,
- optional Git LFS/cloud state.

### 8.2 Icons view

Grid contains:

- folders as folder tiles,
- source/text files as type icons,
- images as actual thumbnails,
- other supported media as preview icons,
- status badges for pending changes or unavailable content.

Icons view is not merely decorative. It is the primary asset-browsing mode.

### 8.3 Shared interaction rules

- single click selects,
- Ctrl/Cmd-click toggles selection,
- Shift-click selects a range,
- double click opens folder or file,
- Enter opens selected item,
- F2 or context action renames,
- Delete stages deletion,
- drag moves files/folders or triggers contextual tool resolution,
- right click opens file/folder actions,
- selection and scroll position persist per folder and repo window.

---

## 9. Image thumbnail contract

Supported image files display thumbnails rather than generic file icons.

Initial formats:

```text
PNG · JPEG/JPG · GIF · WebP · SVG · AVIF where browser-supported
```

Later adapters may add preview generation for PSD, TIFF, DDS, TGA and engine-specific textures.

```ts
export type ThumbnailState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; url: string; width?: number; height?: number }
  | { state: "unavailable"; reason: string }
  | { state: "error"; message: string };

export type ThumbnailRequest = {
  repoKey: RepoKey;
  ref: string;
  path: string;
  blobSha?: string;
  size?: number;
  mediaType?: string;
};
```

### 9.1 Loading strategy

- thumbnails load lazily only when near the visible viewport,
- request cancellation occurs when the folder changes,
- exact blob SHA is the preferred cache key,
- thumbnail cache is shared between details view, icons view and viewer filmstrip,
- large originals are not downloaded merely to produce a tiny thumbnail when a smaller source is available,
- failures fall back to a type icon without breaking the folder view.

### 9.2 Pending local images

Images added through uploads or tools receive thumbnails from their local `Blob`/`Uint8Array` before checkpointing.

The thumbnail must appear immediately in the overlay state.

### 9.3 SVG security

SVG previews must not execute arbitrary embedded scripts.

Use sanitized rendering or a safe image decoding path. Do not inject untrusted SVG markup directly into the application DOM.

---

## 10. Double-click file dispatch

Double-click dispatch is based on content capability.

```ts
export type FileOpenCapability =
  | "folder"
  | "text-editor"
  | "image-viewer"
  | "markdown-viewer-editor"
  | "pdf-viewer"
  | "audio-player"
  | "video-player"
  | "archive-inspector"
  | "binary-properties"
  | "download-only";
```

Initial resolution:

```text
folder             → open folder in same repository window
source/text        → open editor tab in repository window
image              → open/focus Image Viewer child window
Markdown           → open editor/preview tab
PDF                 → open PDF Viewer child window
unknown binary     → properties/download chooser
```

No file type opens a replacement page.

---

## 11. Image Viewer

Double-clicking an image opens an Image Viewer child window.

```text
┌───────────────────────────────────────────────────────────┐
│ Image Viewer · assets/hero.png                 _  □  ×   │
├───────────────────────────────────────────────────────────┤
│                                                           │
│                     rendered image                        │
│                                                           │
├───────────────────────────────────────────────────────────┤
│ ◀ previous   100%   fit   metadata   next ▶              │
└───────────────────────────────────────────────────────────┘
```

Required v1 functions:

- fit to window,
- actual size,
- zoom in/out,
- wheel/pinch zoom,
- pan,
- rotate view without modifying file,
- transparent-background checkerboard,
- image dimensions and file size,
- previous/next image in the current folder,
- open containing folder,
- copy path,
- download/export,
- minimize,
- maximize/restore,
- close.

Optional later functions:

- compare two images,
- before/after slider,
- color picker,
- crop/resize tools,
- animation playback controls,
- sprite-sheet slicing.

### 11.1 Viewer identity

Default: one Image Viewer application window per repository, able to switch documents.

```text
double-click image A → viewer opens image A
double-click image B → existing viewer focuses and opens image B
```

User option:

```text
Open in new viewer window
```

This avoids accidental creation of dozens of viewer windows while preserving explicit multi-image comparison.

### 11.2 Viewer minimization

The viewer minimizes into the Taskbar like any other managed window.

Minimizing it does not:

- navigate away,
- unload the repository window,
- close the image,
- remove viewer history.

Restoring returns to the same image, zoom, pan and window bounds.

### 11.3 Parent relationship

The Viewer title and Taskbar preview identify the repository:

```text
Image Viewer — MYTHIC — assets/hero.png
```

If the repository window is closed while a viewer contains no unsaved edit, the viewer closes with it after confirmation where appropriate.

If an interactive viewer tool contains unsaved changes, closing the parent requires explicit handling.

---

## 12. Editing behavior

### 12.1 Text and source files

Text editing occurs directly inside the repository window through editor tabs.

```text
folder view
→ double-click source file
→ editor tab opens inside same repository window
→ save stages Working Change
```

The editor does not become a new desktop page.

### 12.2 Binary/media modifications

A viewer is initially read-only unless an editing capability is explicitly activated.

Activating an edit tool creates a proposal/change layer:

```text
viewer
→ crop/resize/etc.
→ preview modified result
→ Apply
→ stage changed file
```

No media tool writes directly to GitHub.

---

## 13. Grouped programs in the Taskbar

Taskbar items are grouped by **application identity** and scoped by repository where needed.

```ts
export type WindowGroupKey =
  | `repo:${RepoKey}`
  | `app:${ApplicationId}`
  | `repo-app:${RepoKey}:${ApplicationId}`
  | `system:${string}`;

export type TaskbarGroupingMode =
  | "by-repository"
  | "by-application"
  | "hybrid";
```

Default: `hybrid`.

### 13.1 Hybrid grouping rules

- repository workspaces each receive a repository group,
- several windows of the same application for one repository group together,
- system applications group globally,
- transient jobs group under Jobs,
- explicit comparison viewers may appear as multiple entries inside the Image Viewer group.

Example:

```text
Taskbar
├── MYTHIC
│   ├── Repository window
│   ├── Pull Requests
│   └── Actions
├── SHADED
│   ├── Repository window
│   └── Security
├── Image Viewer (3)
│   ├── MYTHIC / hero.png
│   ├── MYTHIC / villain.png
│   └── SHADED / atlas.webp
└── Jobs (2)
```

Visual implementation may show either:

- repository groups containing application windows,
- application groups containing repo-labelled documents,
- a compact hybrid preview.

The underlying grouping keys must support all three without rewriting window state.

### 13.2 Group click behavior

One window in group:

```text
click → restore/focus or minimize active window
```

Several windows in group:

```text
click → show thumbnail/list switcher
```

The switcher displays:

- window title,
- repository,
- application icon,
- live/static preview when inexpensive,
- pending/attention badge,
- close button.

### 13.3 Group close

Context action:

```text
Close all windows in group
```

must respect pending changes and unsaved edits individually. It cannot silently discard state.

---

## 14. Rubber Band and Taskbar division

### Rubber Band

Represents **available applications and repository commands** for the parent repository.

```text
What can I open or do here?
```

### Taskbar

Represents **currently open, minimized or running windows/jobs**.

```text
What is currently running or open?
```

Therefore:

- Issues icon may always exist on the Rubber Band,
- Issues appears in Taskbar only while its window is open,
- PDF-to-Markdown is not a permanent Rubber Band item unless deliberately exposed as a repo command,
- a PDF conversion appears in Taskbar only while running or awaiting review.

---

## 15. Desktop icon correction

The desktop icon layer should remain restrained.

Default desktop objects:

- repository drive shortcuts,
- Search/Start shortcut where desired,
- Recycle Bin,
- Settings.

GitHub feature applications belong primarily to the repository Rubber Band, because they require repository context.

Optional global shortcuts may open a chooser:

```text
Pull Requests
→ choose repository or show aggregated inbox
```

But the desktop must not be flooded with fourteen icons per repository.

---

## 16. Accessibility and input

Rubber Band:

- keyboard navigable,
- visible focus states,
- tooltips plus accessible labels,
- badges announced meaningfully,
- no hover-only required interaction.

File workspace:

- list/grid semantics,
- keyboard selection and opening,
- thumbnails have filename alt text rather than attempting image-description hallucinations,
- viewer controls are keyboard accessible,
- zoom state is announced,
- motion can be reduced.

Touch/mobile:

- Rubber Band becomes a horizontally scrollable attached strip or bottom sheet trigger,
- double-tap opens where double-click is unavailable,
- long press opens context menu,
- only one main/child window is visibly active at a time while Taskbar/group state remains intact.

---

## 17. Persistence

Persist lightweight UI state:

```ts
export type PersistedRepositoryUiState = {
  repoKey: RepoKey;
  rubberBand: Pick<
    RubberBandState,
    "edge" | "collapsed" | "autoHide" | "thickness" | "itemOrder" | "hiddenItemIds"
  >;
  fileWorkspace: {
    viewMode: FileWorkspaceViewMode;
    iconSize: number;
    folderSelections: Record<string, string[]>;
    folderScrollPositions: Record<string, number>;
  };
};

export type PersistedViewerState = {
  applicationId: "image-viewer";
  repoKey: RepoKey;
  lastPath?: string;
  bounds: WindowBounds;
  state: "normal" | "minimized" | "maximized";
  zoomMode: "fit" | "actual" | "custom";
  zoom?: number;
};
```

Do not persist object URLs across reload. Recreate media sources from repository/local blob identity.

---

## 18. Suggested component structure

```text
src/features/repositories/
  RepositoryWindow.tsx
  RepositoryWorkspace.tsx
  RepositoryRubberBand.tsx
  RubberBandItem.tsx
  RubberBandOverflow.tsx
  repository-ui-state.ts

src/features/files/
  FileWorkspace.tsx
  FileDetailsView.tsx
  FileIconsView.tsx
  FileTile.tsx
  FileRow.tsx
  file-open-resolver.ts

src/features/thumbnails/
  thumbnail-cache.ts
  thumbnail-loader.ts
  ImageThumbnail.tsx
  safe-svg.ts

src/features/viewers/
  viewer-registry.ts
  image/
    ImageViewerWindow.tsx
    image-viewer-state.ts
    image-navigation.ts
    ImageCanvas.tsx
    ImageMetadata.tsx

src/features/desktop/
  Taskbar.tsx
  TaskbarGroup.tsx
  TaskbarGroupPreview.tsx
  window-groups.ts
  child-window-lifecycle.ts
```

---

## 19. Implementation sequence

### Stage 1 — File-first repository window

- keep the existing Explorer/FileView workspace as the permanent repository content,
- remove any design assumption that GitHub applications replace the workspace,
- introduce repository-scoped Rubber Band shell,
- register Code/Changes/Search/Run as initial items.

Acceptance:

- files remain visible while opening/closing Rubber Band applications,
- repository state never resets due to feature navigation.

### Stage 2 — Icons view and image thumbnails

- add details/icons view switch,
- implement lazy thumbnail loading and cache by blob SHA,
- support thumbnails for pending local images,
- safe SVG preview.

Acceptance:

- image files show thumbnails in both views,
- large folders remain responsive,
- failed thumbnails degrade gracefully.

### Stage 3 — Image Viewer child window

- file-open resolver,
- double-click image opens Image Viewer,
- fit/actual/zoom/pan,
- previous/next,
- metadata,
- minimize/maximize/restore,
- parent repository ownership.

Acceptance:

- no route/page transition occurs,
- minimizing and restoring preserves image and view state.

### Stage 4 — Grouped Taskbar

- introduce application/group keys,
- repository and application grouping,
- group preview switcher,
- restore/minimize/close behavior,
- persistence.

Acceptance:

- multiple viewers or feature windows do not flood the Taskbar,
- every grouped item remains identifiable by repo and document.

### Stage 5 — Full GitHub feature Rubber Band

- populate from feature registry,
- availability states and badges,
- open/focus/minimize child feature windows,
- explanation sidecars.

Acceptance:

- all GitHub features are discoverable without covering the file workspace.

---

## 20. Required vertical slice

```text
1. Open MYTHIC as a repository window.
2. MYTHIC opens directly to folders and files.
3. A Rubber Band attached below the title bar shows Code, Issues,
   Pull Requests, Actions, Security, Changes and More.
4. Move MYTHIC; the Rubber Band moves with it.
5. Resize MYTHIC; the Rubber Band reflows without overlapping content.
6. Switch file workspace to Icons view.
7. PNG/JPEG/WebP/SVG files show thumbnails.
8. Double-click hero.png.
9. Image Viewer opens as a child window; MYTHIC remains unchanged behind it.
10. Minimize Image Viewer.
11. Viewer appears in the grouped Taskbar.
12. Restore Viewer; hero.png returns at the same zoom and position.
13. Open another image normally; the existing viewer changes document.
14. Choose "Open in new viewer" for comparison; Taskbar shows Image Viewer (2).
15. Open Actions from MYTHIC Rubber Band.
16. Actions opens as a child application window; MYTHIC file workspace remains intact.
17. Minimize MYTHIC; Rubber Band disappears with it while child windows remain
    correctly grouped and repository-labelled according to policy.
18. Reload; window groups, Rubber Band placement, workspace view and viewer
    state restore safely.
```

---

## 21. Definition of done

This contract is fulfilled when:

- every repository window opens to folders/files rather than a feature dashboard,
- files and text can be viewed and edited without page navigation,
- GitHub feature applications are attached through a repository-scoped Rubber Band,
- moving/resizing/minimizing the parent treats the Rubber Band as attached geometry,
- image files show lazy, cached thumbnails,
- pending local images show immediate thumbnails,
- double-clicking an image opens a managed Image Viewer window,
- the viewer can minimize, maximize, restore and close like other applications,
- viewer state survives minimization and safe reload restoration,
- application windows know their owning repository,
- the Taskbar groups windows instead of producing one icon per document,
- grouped previews identify application, repository and document,
- opening an application or viewer never replaces the repository with a new page,
- the desktop remains uncluttered by repository-specific GitHub feature icons.

---

## 22. Explicit exclusions

Do not:

- replace the file workspace when opening Issues, Actions or another feature,
- create a new browser page or route as the visible file-viewer experience,
- treat the Rubber Band as a free-floating desktop toolbar,
- give the Rubber Band an independent Taskbar item,
- render every image as a generic icon,
- download all full-resolution images in a folder eagerly,
- execute untrusted SVG markup in the DOM,
- create a new Viewer window for every normal image double-click,
- lose zoom/document state on minimize,
- show dozens of ungrouped Taskbar icons,
- omit repository identity from grouped application windows,
- place fourteen GitHub feature shortcuts on the desktop for every repository.

---

## 23. Product identity

The repository is the place where work happens.

The Rubber Band supplies everything attached to that work without taking the workspace away:

```text
repository window → files and editor
attached Rubber Band → available GitHub applications
child window → active viewer or feature
Taskbar group → running/minimized application family
```

This keeps DRAGHUB spatial, understandable and desktop-like without turning the desktop into an icon landfill or the repository window into a sequence of replacement pages.
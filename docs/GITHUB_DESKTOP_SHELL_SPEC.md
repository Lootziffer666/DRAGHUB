# DRAGHUB — GitHub Desktop Shell and Guided Feature Apps

**Status:** Build-ready product correction and extension  
**Supplements:** `DRAGHUB_BUILD_SPEC.md` and `MULTI_REPO_WINDOW_DOCK_SPEC.md`  
**Product surface:** browser-first internal desktop; later compatible with a Tauri desktop shell  
**Primary goal:** make GitHub behave like an understandable desktop environment instead of a website full of rarely understood tabs

---

## 1. Product correction

DRAGHUB is not merely a repository explorer with a Dock.

It is a **fake desktop operating surface for GitHub** with:

- a persistent wallpaper,
- desktop icons,
- repository shortcuts represented as drives,
- movable and minimizable windows,
- a Windows-like taskbar,
- a recycle bin,
- settings,
- one discoverable application for every relevant GitHub repository area,
- optional contextual explanations for every application,
- automatic local tools triggered by dropped content rather than a permanent tool catalog.

The correct product model is:

```text
GitHub account / repositories / services
                ↓
       understandable desktop objects
                ↓
 drives · apps · windows · taskbar · notifications
```

GitHub concepts remain technically accurate underneath, but the user is not forced to understand GitHub's website navigation before using them.

---

## 2. Core metaphor map

| GitHub concept | DRAGHUB desktop object |
|---|---|
| Repository | Drive / mounted workspace |
| Repository page | Drive home window |
| Code | File Explorer |
| Commit | Checkpoint |
| Branch | Variant |
| Pull request | Proposed change / review inbox |
| Issue | Task, bug, idea or request |
| Actions | Automation control room |
| Projects | Planning board / roadmap |
| Wiki | Project handbook |
| Discussions | Project forum |
| Security | Security center |
| Insights | Activity and diagnostics |
| Settings | Repository control panel |
| Release | Published version / package |
| Deleted uncommitted file | Recycle Bin item |
| Revert after checkpoint | Restore operation creating a new change layer |

The desktop metaphor must simplify access without lying about what Git and GitHub do.

---

## 3. Desktop shell hierarchy

```text
DRAGHUB Desktop
├── Wallpaper
├── Desktop icon layer
│   ├── repository drives
│   ├── GitHub feature applications
│   ├── Recycle Bin
│   └── Settings
├── Window manager
│   ├── repository windows
│   ├── feature application windows
│   ├── explanation sidecars
│   └── transient tool/job windows
├── Global overlays
│   ├── Search / launcher
│   ├── notifications
│   └── context menus
└── Taskbar
    ├── Start/Search
    ├── open and minimized windows
    ├── transient running jobs
    └── status area
```

The desktop exists continuously. Opening or closing a repository never replaces the desktop root.

---

## 4. Required desktop state

```ts
export type DesktopIconId = string;
export type WindowId = string;
export type RepoKey = `${string}/${string}`;

export type DesktopIconState = {
  id: DesktopIconId;
  kind:
    | "repository-drive"
    | "github-feature"
    | "recycle-bin"
    | "settings"
    | "shortcut";
  title: string;
  iconKey: string;
  repoKey?: RepoKey;
  featureId?: GithubFeatureId;
  position: { x: number; y: number };
  pinned: boolean;
  hidden: boolean;
  createdAt: number;
};

export type DesktopShellState = {
  wallpaper: WallpaperState;
  icons: Record<DesktopIconId, DesktopIconState>;
  iconOrder: DesktopIconId[];
  selectedIconIds: DesktopIconId[];
  windows: Record<WindowId, DesktopWindowState>;
  windowOrder: WindowId[];
  activeWindowId: WindowId | null;
  taskbarOrder: WindowId[];
  recycleBin: RecycleBinState;
  settings: DesktopSettings;
};
```

Desktop icons and open windows are separate records.

A shortcut can exist while no window is open. Closing a window must not remove its desktop shortcut unless the user explicitly removes the shortcut.

---

## 5. Desktop icon behavior

Desktop icons support:

- single click: select,
- double click / Enter: open,
- drag: reposition,
- multi-select,
- context menu,
- rename shortcut label without renaming the repository,
- pin/unpin,
- remove shortcut without deleting the repository,
- create shortcut from Search, recent repositories or an open window,
- snap-to-grid,
- persisted positions.

Required context actions for a repository drive:

```text
Open
Open in new window
Run locally
Pin to Taskbar
Create desktop shortcut
Open on GitHub
Properties
Remove shortcut
```

`Remove shortcut` must never delete the remote repository.

Destructive repository actions belong only in explicit Settings/Properties flows with strong confirmation.

---

## 6. Repository drives

Repositories appear as mounted drives because they are persistent workspaces with their own contents, variants, history and services.

```text
Desktop
├── MYTHIC
├── SHADED
├── WIZARD
└── DRAGHUB
```

Opening a repository drive creates or focuses its repository window.

The repository window contains:

```text
Repository home
├── File Explorer / Code
├── feature application icons
├── repository summary
├── current branch/variant
├── pending changes
├── activity/status
└── local run controls when available
```

A repository window is not required to imitate GitHub's horizontal tab bar. Its feature applications may be presented as large icons, a Start-style list, or both.

The user must be able to discover every relevant GitHub capability without already knowing where GitHub hides it.

---

## 7. GitHub feature application registry

Every GitHub repository area is represented by an application definition.

```ts
export type GithubFeatureId =
  | "code"
  | "issues"
  | "pull-requests"
  | "actions"
  | "projects"
  | "wiki"
  | "discussions"
  | "security"
  | "insights"
  | "settings"
  | "releases"
  | "branches"
  | "packages"
  | "codespaces";

export type FeatureAvailability =
  | "available"
  | "disabled"
  | "permission-required"
  | "plan-required"
  | "not-configured"
  | "loading"
  | "error";

export type FeatureRenderMode =
  | "native"
  | "remote-webview"
  | "external";

export type GithubFeatureDefinition = {
  id: GithubFeatureId;
  title: string;
  shortDescription: string;
  whyUseIt: string;
  iconKey: string;
  defaultWindowSize: { width: number; height: number };
  preferredRenderMode: FeatureRenderMode;
  externalPath: (repo: RepoKey) => string;
  detectAvailability: (ctx: FeatureContext) => Promise<FeatureAvailability>;
  learn: FeatureLearningContent;
};
```

The registry is data-driven. Do not hard-code one separate launcher implementation per feature.

---

## 8. Required GitHub applications

### 8.1 Code — File Explorer

**What it is:** repository files, folders, branches, tags and revision history.

**Why it matters:** this is the actual project content and its saved states.

**DRAGHUB form:** the existing Explorer, tabs, FileView, Changes and checkpoint system.

**First useful action:** browse files, inspect README, open a branch or create a checkpoint.

### 8.2 Issues — Work Inbox

**What it is:** ideas, bugs, tasks, feedback and requests that can be discussed and assigned.

**Why it matters:** it records work that should happen without pretending the work is already code.

**DRAGHUB form:** filterable inbox with plain-language types:

```text
Bug · Idea · Task · Question · Request
```

**First useful action:** show open issues, unassigned issues and issues referencing the active code area.

### 8.3 Pull Requests — Proposed Changes

**What it is:** a proposed difference between branches that can be reviewed, discussed, tested and merged.

**Why it matters:** it separates a proposed state from the accepted state.

**DRAGHUB form:** proposal windows with:

- summary,
- changed files,
- checks,
- reviews,
- conflicts,
- accept/reject/repair actions.

**First useful action:** show what changes, why, whether checks pass and whether human action is required.

### 8.4 Actions — Automation Control Room

**What it is:** automated workflows that react to repository events or manual triggers.

**Why it matters:** builds, tests, deployments, scheduled work and maintenance can happen automatically.

**DRAGHUB form:** workflow list, recent runs, current state, failed step and plain-language explanation of each workflow file.

**First useful action:** explain existing workflows before offering to run or edit them.

### 8.5 Projects — Planning Board

**What it is:** tables, boards and roadmaps built from issues, pull requests and custom fields.

**Why it matters:** it organizes work across time, priority, status and repositories.

**DRAGHUB form:** board/table/roadmap window with a simple purpose statement and existing linked projects.

**First useful action:** show whether the repository is connected to a project and what work is currently blocked or active.

### 8.6 Wiki — Project Handbook

**What it is:** long-form project documentation separate from the main repository files.

**Why it matters:** it can hold explanations, design decisions and usage guides too large for a README.

**DRAGHUB form:** handbook reader/editor when supported; otherwise a clear external-open fallback and explanation of the separate wiki Git repository boundary.

**First useful action:** explain whether the wiki is enabled, empty or unavailable.

### 8.7 Discussions — Project Forum

**What it is:** questions, answers, announcements and broader conversations that are not concrete tasks.

**Why it matters:** it prevents every conversation from becoming an issue.

**DRAGHUB form:** forum categories with a visible distinction from Issues.

**First useful action:** explain "use Issues for work; Discussions for conversation".

### 8.8 Security — Security Center

**What it is:** dependency risks, exposed secrets, code scanning findings, advisories and protection configuration.

**Why it matters:** these functions identify and prevent vulnerabilities that are easy to miss in ordinary code browsing.

**DRAGHUB form:** one severity-ordered security center that explains:

- what was found,
- whether it is active or historical,
- what could happen,
- the safest next action,
- whether the feature is disabled or permission-gated.

**First useful action:** show security coverage before showing raw alert lists.

### 8.9 Insights — Activity and Diagnostics

**What it is:** repository activity, traffic, contributors, dependencies, forks and historical graphs.

**Why it matters:** it explains whether the project is active, used, changing and maintained.

**DRAGHUB form:** readable dashboard that translates graphs into statements.

**First useful action:** summarize what changed recently and which areas are stale or active.

### 8.10 Settings — Repository Control Panel

**What it is:** repository identity, access, features, rules, integrations, automation settings, secrets and dangerous operations.

**Why it matters:** this controls how the repository behaves and who can change it.

**DRAGHUB form:** a category-based control panel, not one endless settings page.

Required categories:

```text
General
People & Access
Branches & Rules
Actions & Runners
Security
Secrets & Variables
Webhooks & Apps
Pages & Deployments
Features
Danger Zone
```

**First useful action:** explain current settings and highlight only unusual, missing or risky configuration.

### 8.11 Releases — Published Versions

**What it is:** named versions with release notes and downloadable artifacts.

**Why it matters:** a repository state becomes something other people can consume.

**DRAGHUB form:** release shelf with tags, notes and assets.

### 8.12 Branches — Variants

**What it is:** parallel project states.

**Why it matters:** work can develop without immediately changing the accepted main state.

**DRAGHUB form:** visual variant manager and comparison view.

### 8.13 Packages — Package Shelf

**What it is:** published software packages and container images associated with an account or repository.

**DRAGHUB form:** package inventory with source, version and usage explanation.

### 8.14 Codespaces — Remote Workstations

**What it is:** cloud-hosted development environments connected to repository states.

**DRAGHUB form:** launcher and status view. DRAGHUB must not imply that a Codespace is a locally installed application.

---

## 9. Feature icons must remain discoverable when unused

A disabled or unused GitHub feature must not simply disappear.

The desktop should show all relevant feature applications with state:

```text
available           normal icon
disabled            muted icon + "Not enabled"
permission-required lock badge
plan-required       plan badge
not-configured      hollow/status badge
error               warning badge
```

Opening an unavailable feature shows:

1. what it does,
2. why someone would use it,
3. why it is unavailable here,
4. whether it can be enabled,
5. the exact safe action required.

This is necessary for the user's stated goal: discovering GitHub functions that have never been used.

---

## 10. Guided explanation mode

Every feature application window includes a persistent help action:

```text
[What is this?]
```

It opens an explanation sidecar without replacing the feature content.

```ts
export type FeatureLearningContent = {
  oneSentence: string;
  practicalPurpose: string;
  useWhen: string[];
  doNotUseWhen?: string[];
  currentRepoSummary?: string;
  safeFirstActions: LearningAction[];
  importantTerms: Array<{ term: string; explanation: string }>;
};
```

### 10.1 Explanation levels

```text
Off
Concise
Guided
```

- **Off:** no unsolicited explanations.
- **Concise:** one-sentence purpose and current state.
- **Guided:** structured tour, recommended first action and terminology.

The selected level is global but can be overridden per feature.

### 10.2 Explain the current repository, not only generic GitHub

Bad explanation:

```text
Actions automate workflows.
```

Required explanation:

```text
DRAGHUB currently contains 3 workflows.
Two build the app after pushes; one deploys previews for pull requests.
The last failed run stopped during TypeScript checking.
```

Generic learning content and live repository evidence must be kept separate in the data model.

### 10.3 First-use state

DRAGHUB may track locally:

- feature never opened,
- explanation never read,
- feature used successfully,
- feature dismissed.

This data is local UX state, not telemetry and not written into repositories.

Unused feature icons may show a subtle discovery marker until opened or dismissed.

---

## 11. Embedding boundary: browser versus desktop shell

The product requirement is that every GitHub feature opens in a DRAGHUB window.

That does **not** mean every `github.com` page can reliably be placed in a browser `<iframe>`.

Cross-origin pages may block framing through browser security headers. Authentication, navigation and DOM inspection also become unreliable inside a normal web iframe.

Therefore each feature supports three render modes.

### 11.1 Native mode — preferred

DRAGHUB fetches data through GitHub APIs and renders its own understandable interface.

Advantages:

- stable internal window behavior,
- explanation sidecar can refer to real controls,
- consistent visual language,
- structured data rather than scraped HTML,
- better mobile support,
- no dependence on GitHub's page layout.

Native mode is mandatory for the long-term product.

### 11.2 Remote WebView mode — desktop shell only

A future Tauri or equivalent desktop wrapper may open a GitHub URL as the top-level content of a dedicated WebView window.

This is different from embedding the page in an iframe inside another page.

Rules:

- remote content is visually marked as GitHub content,
- no secrets are injected into the page by DRAGHUB,
- navigation is restricted to expected GitHub origins,
- dangerous downloads and external protocols require confirmation,
- explanation content remains a separate DRAGHUB sidecar,
- DRAGHUB must not depend on DOM injection into GitHub pages.

### 11.3 External mode — fallback

When neither native implementation nor safe remote WebView is available, the feature window provides:

- a clear explanation,
- current repository summary where API access permits,
- an `Open on GitHub` action.

The feature still has an icon and an understandable purpose. It is never reduced to an unexplained dead link.

### 11.4 Render-mode resolution

```text
Native feature implemented?
├─ yes → native window
└─ no
   ├─ desktop remote WebView supported? → remote WebView + explanation sidecar
   └─ otherwise → explanatory placeholder + Open on GitHub
```

Do not proxy and rewrite GitHub's HTML merely to bypass frame restrictions. That would be brittle, unsafe and tightly coupled to GitHub's private page structure.

---

## 12. Taskbar contract

The visible bottom bar is user-facing **Taskbar**, even if older internal code calls it `Dock`.

The Taskbar contains runtime state, not a catalog of every possible tool.

```text
┌─────────────────────────────────────────────────────────────┐
│ Start/Search │ Repo A │ Issues │ Actions │ Repo B │ Jobs │ ◷│
└─────────────────────────────────────────────────────────────┘
```

Required groups:

1. Start/Search launcher,
2. open repository windows,
3. open GitHub feature windows,
4. minimized windows,
5. transient running jobs,
6. status area.

Taskbar behavior:

- clicking a minimized window restores it,
- clicking the active normal window minimizes it,
- middle-click or context action closes where safe,
- pending changes and attention states appear as badges,
- grouped windows may expand into a preview list,
- pinned shortcuts are optional and distinct from open windows,
- the Taskbar is always visible on desktop,
- maximized windows never cover it.

### 12.1 Tools are not permanent Taskbar applications by default

Small transformations such as PDF-to-Markdown are capabilities, not permanent launcher icons.

They appear in the Taskbar only while:

- a job is running,
- a result needs attention,
- an interactive tool window is open.

After completion and dismissal, the transient taskbar item disappears.

---

## 13. Automatic drop tools

Dropping content onto a repository, folder or supported file invokes the Drop Resolver.

```text
Files dropped
→ identify MIME/type and target context
→ find compatible tools
→ auto-run only when intent is unambiguous and safe
→ otherwise show contextual action chooser
→ emit generated files as Working Changes
```

Example:

```text
PDF files dropped on repository drive
→ PDF-to-Markdown selected
→ output path Docs/new
→ generated Markdown files appear as pending changes
```

Tool results use the same change-layer/checkpoint model as manual edits.

No transformation may commit directly without review unless the user explicitly enabled a trusted automation rule.

---

## 14. Recycle Bin semantics

The Recycle Bin is not fake decoration. It is a human-facing view of recoverable deletion states.

It contains:

- files staged for deletion but not checkpointed,
- removed desktop shortcuts,
- discarded local proposal layers retained for a configurable grace period,
- optionally closed local checkpoints marked for cleanup.

It does **not** pretend that accepted Git history was erased.

Required behavior:

### Before checkpoint

```text
Delete file
→ move to Recycle Bin / stage delete delta
→ Restore removes delete delta
→ Empty Bin discards the recoverable local item
```

### After checkpoint

```text
Restore historical deletion
→ create a new change layer restoring content
→ create a new checkpoint when accepted
```

The UI must state that Git history is append-only from the user's perspective.

Remote repository deletion is never a normal Recycle Bin action.

---

## 15. Settings application

The global Settings application configures DRAGHUB, not the active repository.

Required sections:

```text
Appearance
Desktop & Wallpaper
Taskbar
Window Behavior
GitHub Connection
Local Runner
Storage & Cleanup
Tools & Drop Rules
Learning & Explanations
Notifications
Privacy & Security
Accessibility
```

### 15.1 Wallpaper

Support:

- built-in wallpapers,
- solid/gradient backgrounds,
- user-selected local image,
- fit/fill/center behavior,
- reduced-motion mode,
- optional per-workspace wallpaper later.

Wallpaper is presentation state only and never committed into a repository unless explicitly exported.

### 15.2 Desktop layout

Support:

- icon size,
- snap-to-grid,
- automatic arrangement,
- show/hide labels,
- reset layout,
- import/export layout settings.

---

## 16. Repository properties

Right-clicking a repository drive and selecting `Properties` opens a readable repository facts window.

Required content:

- repository name and owner,
- visibility,
- default branch,
- description and topics,
- enabled GitHub features,
- last activity,
- open issues and pull requests,
- workflows and last run state,
- security coverage summary,
- size and major file types,
- local session/cache storage,
- remote URL and local runner state.

Properties is a summary, not another route to an unstructured Settings dump.

---

## 17. Suggested component structure

```text
src/features/desktop/
  DesktopProvider.tsx
  DesktopCanvas.tsx
  DesktopIconLayer.tsx
  DesktopIcon.tsx
  WindowManager.tsx
  WindowFrame.tsx
  Taskbar.tsx
  StartLauncher.tsx
  RecycleBinWindow.tsx
  SettingsWindow.tsx
  wallpaper.ts
  icon-layout.ts
  persistence.ts

src/features/repositories/
  repository-store.tsx
  RepositoryDriveIcon.tsx
  RepositoryHomeWindow.tsx
  RepositoryPropertiesWindow.tsx

src/features/github-apps/
  registry.ts
  feature-types.ts
  FeatureAppIcon.tsx
  FeatureAppWindow.tsx
  FeatureUnavailableView.tsx
  ExplanationSidecar.tsx
  render-mode.ts
  apps/
    code/
    issues/
    pull-requests/
    actions/
    projects/
    wiki/
    discussions/
    security/
    insights/
    settings/
    releases/
    branches/
    packages/
    codespaces/

src/features/drop-tools/
  registry.ts
  resolver.ts
  DropActionChooser.tsx
  JobProgressWindow.tsx
```

Every feature app exports a definition consumed by the central registry.

---

## 18. Implementation order

### Stage 1 — Real desktop root

- make DesktopCanvas the permanent root,
- add wallpaper,
- add icon layer,
- add always-visible Taskbar,
- preserve current single repository inside one window.

Acceptance:

- closing/minimizing the repository reveals a usable desktop,
- Taskbar and wallpaper remain visible.

### Stage 2 — Multi-repo drives and windows

- complete multi-repo state,
- repository shortcuts,
- independent repository windows,
- minimize/restore/taskbar behavior,
- persistence.

Acceptance:

- several repo drives can be open simultaneously,
- each retains independent tabs, selection and changes.

### Stage 3 — Feature application registry

- implement registry and feature definitions,
- generate feature icons from registry,
- availability states,
- placeholder/explanation windows,
- external fallback.

Acceptance:

- every required GitHub feature has an icon and explanation,
- unavailable features explain why they are unavailable.

### Stage 4 — Native Code and Pull Request applications

- register existing repository explorer as Code app,
- build native Pull Requests window from API data,
- add explanation sidecars and current-repo summaries.

Acceptance:

- user can understand a pull request without opening GitHub's website.

### Stage 5 — Issues, Actions and Security

- native issue inbox,
- workflow/run control room,
- security coverage and alerts,
- attention badges on icons and Taskbar.

Acceptance:

- failures and required actions are visible without navigating GitHub tabs.

### Stage 6 — Projects, Wiki, Discussions, Insights and Settings

- implement according to API feasibility,
- use remote WebView only in desktop wrapper where appropriate,
- preserve explanatory fallback for incomplete native surfaces.

### Stage 7 — Drop tools and Recycle Bin

- automatic resolver,
- PDF-to-Markdown first transformation,
- output to `Docs/new`,
- transient job taskbar items,
- staged deletion recovery.

---

## 19. Required first vertical slice

Build this story before adding every GitHub API:

```text
1. DRAGHUB opens to a wallpaper desktop with visible Taskbar.
2. Desktop contains Search, Settings and Recycle Bin.
3. Search finds DRAGHUB and creates a repository drive shortcut.
4. Opening the drive creates a repository window.
5. The repository window shows icons for Code, Issues, Pull Requests,
   Actions, Projects, Wiki, Security, Insights and Settings.
6. Code opens the existing repository explorer.
7. Pull Requests opens a native placeholder/data window with explanation.
8. Actions opens an explanation window showing whether workflows exist.
9. A disabled feature remains visible and explains how to enable it.
10. Minimize sends each open window to the Taskbar.
11. Restore returns the exact previous window state.
12. Desktop icon positions, wallpaper and taskbar order survive reload.
13. Dropping a PDF on the repository drive triggers PDF-to-Markdown.
14. Generated Markdown appears under Docs/new as Working Changes.
15. Deleting a pending generated file moves it into Recycle Bin state.
```

---

## 20. Definition of done

The GitHub Desktop Shell foundation is complete when:

- the desktop remains visible independently of repository windows,
- wallpaper and desktop icon layout persist,
- repository shortcuts behave as drives,
- several repository windows may be open and minimized,
- the bottom bar behaves as a real taskbar,
- each relevant GitHub repository feature has a discoverable icon,
- each feature window can explain its purpose and current repository state,
- unavailable or unused features remain visible and understandable,
- native API-driven feature windows are the preferred render mode,
- remote GitHub pages are never assumed to work in a browser iframe,
- external/webview fallbacks remain inside the same application contract,
- small tools are invoked contextually by dropped files,
- tool output enters Working Changes rather than committing directly,
- Recycle Bin behavior accurately represents recoverable Git/GitHub states,
- no desktop metaphor action can silently delete a remote repository.

---

## 21. Explicit exclusions

Do not:

- treat a wallpaper behind one maximized repository as a completed desktop,
- call a repository tab a window,
- hide unused GitHub capabilities completely,
- place every transformation tool permanently in the Taskbar,
- rely on scraping GitHub HTML as the product architecture,
- proxy GitHub pages to bypass framing restrictions,
- inject scripts into GitHub pages as a core dependency,
- equate removing a desktop shortcut with deleting a repository,
- pretend restored Git history was rewritten or erased,
- make explanations generic when current repository evidence is available,
- make the desktop metaphor less functional than the GitHub website it replaces.

---

## 22. Product identity

DRAGHUB is a **GitHub desktop that teaches itself**.

It turns a repository website into a spatial operating surface:

```text
repository → drive
GitHub area → application
page → window
minimize → taskbar
unknown feature → explainable icon
file drop → contextual local capability
change → reviewable layer
accepted state → checkpoint
```

The user should not need to study GitHub before using GitHub. DRAGHUB makes the available machinery visible, understandable and safely actionable.
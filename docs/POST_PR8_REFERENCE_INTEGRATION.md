# Post-PR #8 reference integration brief

## Purpose

This document defines the work that begins **after PR #8**. PR #8 establishes the isolated DRAGHUB desktop kernel. The next branch must integrate existing DRAGHUB capabilities into that kernel and may use selected external repositories as architecture or UX references.

This is not permission to redesign the kernel, merge all reference projects, or turn DRAGHUB into a general remote-computer interface.

## Baseline

The reviewed desktop-kernel baseline is PR #8 at commit:

```text
63012461cb8e59928cde67e89ced3e36d7a1aeba
```

Subsequent documentation-only commits may sit above that commit. The kernel behavior established by PR #8 is the baseline to preserve.

## Kernel contracts that must not be redesigned

The following are settled contracts unless a reproducible regression proves a defect:

- The window manager owns geometry, focus, z-order, minimization, maximization, taskbar order, grouping, ownership, close lifecycle, and desktop-session persistence.
- Application content stays mounted while a window is minimized or hidden by the mobile presentation.
- `presentation` and `minimized` are independent window properties.
- Repository main windows own child windows through an explicit owner containing both `repoKey` and `repositoryWindowId`.
- Child-window identity is scoped to its owner. Two repository windows may open the same resource without sharing accidental local state.
- The Application Registry is the replacement point for mock applications and the registration point for future applications.
- Desktop persistence stores lightweight desktop state only. It must not absorb Theia state, full repository state, agent transcripts, build artifacts, or backend caches.
- Persistence schema v5 and its migration behavior remain intact.
- The close lifecycle remains adapter-driven and transaction-guarded.
- The Recycle Bin stores recoverable discarded content or working-change payloads. It never represents deletion of a repository, device, share, or desktop shortcut.
- Settings and Recycle Bin remain independent single-instance applications.
- Repository, file, GitHub-feature, tool, and system resources are sufficient for the first integration pass. Do not add speculative resource types before a concrete feature requires them.

## First implementation objective

The first Fable implementation pass has one primary goal:

```text
Replace the mock Repository Explorer and mock child applications
with the existing DRAGHUB GitHub capabilities,
without weakening per-window repository isolation.
```

The work is integration, not reinvention.

### Existing DRAGHUB capabilities to integrate

The repository already contains working or partially working features that should be adapted into window applications or repository-window surfaces:

- `AddressBar`
- `Explorer`
- `Tabs`
- `FileView`
- `CodeEditor`
- Search
- Changes / pending changes
- Pull requests
- Issues
- Triage
- Control Panel
- Start Menu actions
- Releases and Codespaces links
- Upload / staging
- Recycle Bin integration

The existing feature logic should be reused wherever it is sound. Window wrappers and per-window state bindings are expected; parallel replacement implementations are not.

## Mandatory repository-state rule

A desktop containing multiple repository windows must never use a global active repository as the identity of all visible repository content.

Every repository main window requires a stable scope keyed by:

```text
repositoryWindowId + repoKey
```

Its child applications must resolve repository state from their owner or resource binding.

Acceptable patterns include:

- one repository-store instance per repository window;
- a store registry keyed by `repositoryWindowId`;
- a scoped provider created by the repository application;
- an adapter that accepts explicit `repoKey` and `repositoryWindowId` on every operation.

Unacceptable patterns include:

- calling a global `useActiveRepo()` from desktop applications and assuming it represents the focused window;
- switching one repository window and silently changing every other repository window;
- using the taskbar-active window as a hidden backend selector;
- deduplicating child applications across different repository-window owners.

## Integration sequence

### Stage 1 — Inventory and mapping

Before editing application behavior:

1. Map each existing GitHub feature to one of:
   - repository main-window surface;
   - repository-owned child application;
   - global desktop application;
   - deferred feature.
2. Identify every dependency on global `activeRepo`.
3. Define the narrow adapter or scoped-provider change needed for each dependency.
4. Preserve existing domain behavior unless a failing test proves it incorrect.

The inventory should be written into the implementation PR description or a short companion document before broad code movement begins.

### Stage 2 — Real Repository Explorer

Replace `MockRepositoryWindow` through the Application Registry.

The real repository application should provide the existing repository browsing experience inside a desktop window, including the appropriate existing components. It must retain state when minimized and when another window becomes active.

Acceptance points:

- two repository windows can display different repositories simultaneously;
- switching branch, path, tab, selection, or editor state in one window does not mutate the other;
- closing one repository window closes only its owned children;
- reopening a repository from its desktop shortcut creates or focuses the correct application according to the established window rules;
- no old page-level navigation replaces the desktop surface.

### Stage 3 — Real child applications

Replace mock child applications through registry entries and explicit resources.

Suggested mapping:

| Application | Resource | Owner |
| --- | --- | --- |
| File/image viewer | `file` | repository window |
| Code editor | `file` | repository window |
| Pull requests | `github-feature` | repository window |
| Issues | `github-feature` | repository window |
| Actions | `github-feature` | repository window |
| Changes | `github-feature` or repository-local tool | repository window |
| Search results | resolved file or GitHub-feature resource | repository window |
| Control Panel | GitHub-feature or tool resource | repository window |
| Settings | `system` | desktop |
| Recycle Bin | `system` | desktop |

Search results should resolve to a typed resource and call `openOrFocusWindow`; search must not bypass the window manager with page navigation.

### Stage 4 — Lifecycle adapters

Connect the established close and Recycle Bin contracts to real domain behavior:

- inspect dirty editor sessions;
- inspect pending changes;
- inspect running operations where relevant;
- commit/checkpoint before close;
- discard recoverable content into the Recycle Bin;
- restore through the owning domain adapter;
- preserve the current transaction guards and error recovery behavior.

Do not move domain logic into the window manager.

### Stage 5 — Selective UX improvements

Only after the existing DRAGHUB functionality works inside the desktop should selected reference ideas be implemented.

Each reference-derived change must name:

- the concrete current UX problem;
- the reference concept used;
- the DRAGHUB-native implementation;
- the affected tests;
- why the change belongs in DRAGHUB rather than another ANVIL module.

## Reference matrix

External repositories are references with sharply limited responsibilities.

| Reference | May inform | Must not become |
| --- | --- | --- |
| `Dusty-JS/daedalOS` | application/process metadata, file associations, Open With, launcher search, recent resources, taskbar previews, mature desktop interaction patterns | a wholesale fork or replacement desktop |
| `supunlakmal/thismypc` | the product idea of a locally mediated, explicitly configured resource gateway | a drive browser, PC explorer, share scanner, or remote `C:\` interface |
| `openkursar/hello-halo` | later ANVIL-CLIENT/Seneschal work: agent-engine adapters, sessions, scheduling, artifact rail, remote approval | part of the first GitHub-desktop integration pass |
| `linuxserver/docker-webtop` | later Linux validation environment for CUE-Agent | a DRAGHUB filesystem or everyday desktop backend |
| `dockur/windows` / PC-Free patterns | later disposable Windows validation environment for CUE-Agent | a normal DRAGHUB workspace or host-access mechanism |
| Microsoft Playwright CLI / MCP | later browser testing and evidence collection for CUE-Agent | desktop-kernel logic |
| `mitchivin/mitchIvin-xp` | project-as-app presentation and discoverability | a Windows XP clone or technical foundation |
| `enoki-inc/aither` | no required implementation; historical shared-desktop reference only | a dependency or security model |
| Mapsforge / Mapsforge Creator | SWIFT world compilation and semantic-data reference | DRAGHUB implementation scope |
| VTM | SHADED preview renderer reference | DRAGHUB implementation scope |
| GeoLibre | SWIFT/SHADED authoring-workbench reference | DRAGHUB implementation scope |
| IFClite | TRIVIUM semantic IR, geometry, validation, diff, and export reference | DRAGHUB implementation scope |

## daedalOS adoption rules

The first reference pass may inspect daedalOS deeply because it addresses the same visible desktop problem. Even here, adoption is selective.

Good candidates after real GitHub integration:

- richer Application Registry metadata;
- file-type-to-application associations;
- explicit Open With rules;
- launcher search over applications and recent resources;
- taskbar hover preview;
- recent-resource tracking;
- process/application distinction where it solves a concrete lifecycle problem;
- desktop context actions and keyboard interaction patterns.

Deferred until demanded by a concrete feature:

- a general virtual filesystem;
- dozens of bundled applications;
- desktop theming infrastructure;
- emulators and media applications;
- service-worker filesystem emulation;
- broad process abstractions that duplicate the existing kernel.

## Share work is a separate pass

Do not implement local or network shares during the first GitHub integration pass.

Before any share implementation, read and obey:

```text
docs/adr/ADR-EXPLICIT-SHARES-ONLY.md
```

The ThisMyPC reference must not be opened as an instruction to expose a computer. It is only a reference for the existence of a local bridge between a UI and explicitly configured resources.

## Work explicitly deferred from the first Fable pass

- local-device bridge;
- network shares;
- share discovery;
- Windows or Linux validation providers;
- CUE-Agent evidence bundles;
- Playwright integration;
- Halo agent sessions and scheduler;
- remote approval;
- Theia editor and terminal integration;
- ANVIL-Core backend integration;
- SWIFT, SHADED, or TRIVIUM domain tooling;
- generic capability framework;
- speculative `device-share`, `validation-run`, `snapshot`, `evidence-bundle`, or `agent-session` resource types;
- visual redesign or final iconography.

## Required Fable deliverables

The Fable implementation should produce:

1. A concise inventory of existing DRAGHUB modules and their target desktop applications.
2. A documented per-window repository-state design.
3. Real repository browsing in at least two simultaneous independent repository windows.
4. Real file/editor and at least one GitHub-feature child application connected through typed resources.
5. Real lifecycle inspection for dirty/pending state without window-manager domain leakage.
6. Tests proving repository-window isolation, child ownership, minimization state retention, and close behavior.
7. A list of concrete daedalOS concepts adopted, deferred, or rejected.
8. No unrelated reference implementation.

## Definition of done for the first post-PR #8 pass

The first integration pass is complete when:

- the desktop is still the permanent shell;
- mock repository and core child content have been replaced by existing DRAGHUB functionality;
- two repository windows operate independently;
- all repository operations are explicitly bound to the correct repository window and resource;
- minimizing and mobile switching preserve application state;
- close and Recycle Bin lifecycles operate through real adapters;
- existing GitHub behavior has not been duplicated in a second architecture;
- only justified daedalOS-derived UX improvements have been added;
- all tests, type checking, linting, build, and diff checks pass;
- share, agent, validation, and game-tool scopes remain deferred.

## Final instruction to implementation agents

Do not broaden the assignment to “combine all references.”

First make the existing DRAGHUB GitHub product run correctly inside the stable PR #8 desktop kernel. Then use references only to close named gaps, one responsibility at a time.

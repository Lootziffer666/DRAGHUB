# Phase 2 Implementation Plan — Repository World (Spatial/Gamified Repository Layer)

**Document type:** forward-looking design only, drafted on explicit maintainer authorization (this session, confirmed via AskUserQuestion) despite Phase 1 not yet being formally accepted.
**Branch:** `claude/phase-2-planning-qotpm8` — planning only, not intended to merge to `main` until Phase 1 is signed off and Phase 2 implementation is separately authorized.
**Binding source of truth for scope:** `docs/PHASE_SCOPE_CONTRACT.md` (maintainer correction, supersedes `PLAN.md` §7/§10 wherever they conflict).

---

## 0. Gate — read this before touching any code

> **Phase 2 may only be implemented or released once Phase 1 is fully complete, verified, and maintainer-accepted end to end.** (`docs/PHASE_SCOPE_CONTRACT.md` §1.1, §5, §7.3: *"Phase 2 darf nicht begonnen oder freigegeben werden, solange Phase 1 noch offene Anforderungen oder nicht erfüllte Akzeptanzkriterien besitzt."*)

As of 2026-07-21, per `PLAN.md` §12's checklist, Phase 1 is **not** accepted:

- M3 (in-browser editor) is functionally mostly done (CodeMirror 6, dirty tracking, working-change integration, FLUBBER text selection) but explicitly still missing "historical ref → branch a variant" and maintainer end-to-end acceptance (`PLAN.md` line 381, `docs/DRAGHUB_PLAN_CORRECTION_RECORD.md` §5).
- The checklist item **"Phase-2-Freigabe durch Maintainer"** is unchecked (`PLAN.md` §12).

Consequences for this document and for whoever picks it up later:

1. This plan is documentation, not a work order. No milestone below should be started, and no branch implementing it should be merged toward `main`, until the maintainer explicitly checks off Phase-1 completion and separately authorizes Phase-2 implementation.
2. Nothing in this plan may be used to justify quietly finishing an unfinished Phase-1 contract "spatially" instead of in the normal UI — `PHASE_SCOPE_CONTRACT.md` §1.1 forbids this outright: *"Phase 2 darf unfertige Phase-1-Abläufe nicht lediglich räumlich oder spielbar nachbauen."* Concretely: the outstanding M3 gap (historical-ref → variant branching) must be fixed in the normal editor, not "solved" by giving the 3D world a branching feature that the flat editor lacks.
3. Nothing here weakens, bypasses, or duplicates a Phase-1 kernel contract (window manager, application registry, `RepoScope`, lifecycle adapter, FLUBBER, `.dh`/DHF). Phase 2 is designed throughout as a *consumer* of those contracts, per §4 below.
4. Multiplayer/backend infrastructure is out of scope for this pass — `PLAN.md` §10 point 4 already flags "Hosting der Multiplayer-Komponente" as an open maintainer decision not yet made; this plan does not assume an answer.

---

## 1. Context

`docs/PHASE_SCOPE_CONTRACT.md` §1 formally splits DRAGHUB into three phases by a simple rule: everything discussed is Phase 1 *unless* it is either (a) a playable/spatial/gamified repository representation, or (b) the Git-native substrate/GitHub-decoupling work. Phase 2 is exactly and only (a):

> "begehbare Repository-Welten, Dateien und Ordner als Gebäude oder Orte, räumliche Code-City, spielartige PR-, Issue- oder Konfliktdarstellungen, spielbare Navigation und weitere ausdrücklich gamifizierte Systeme." (§5)

`PLAN.md` §5 ("Gamification-Readiness") already anticipated this by building six *data-model seams* into Phase 1 that a later presentation layer can consume without touching Phase-1 logic: `vitality.ts`, `layout.ts` (with `viewMode: "list" | "grid" | "city"` — `"city"` is a **reserved-but-unimplemented** value already in the type today, confirmed at `src/components/FileView.tsx:368` and `src/lib/store.tsx:47`), `classify.ts`, `merge.ts`, `events.ts`, and the view-mode registry. This plan is designed to consume those seams, not re-derive them.

**Maintainer's aesthetic brief for this pass** (given directly in this session): a coherent low-poly, PSX-retro (PS1-era GTA III) free-roam world that *grows like a small town* — reading like one unified style, not four bolted-together game references. SimCity/Dorfromantik supply the town-growth and calm build-up feel; Spore supplies the organic/procedural variation in building silhouettes; GTA III on PSX supplies the navigation feel (free-roam camera, tight draw distance) and the general retro-3D direction. **The maintainer is writing the actual PSX-look shaders themselves** — this plan treats the retro *visual* technique (dithering, vertex snapping, texture-warp style, etc.) as the maintainer's own track, and only commits to the data mapping, navigation, and architecture staying shader-agnostic so that track can plug in independently (§4.4).

**Rendering engine decision (already made this session, not re-litigated):** React Three Fiber + Three.js, single engine. Babylon.js/PixiJS/A-Frame-WebXR were considered and rejected as a *combined* stack — two full 3D engines running side by side in one scene means two GL contexts, two scene graphs, duplicated concepts, and the exact "parallel second architecture for the same problem" pattern `docs/POST_PR8_REFERENCE_INTEGRATION.md` warns against. The repo currently has **zero** 3D/game dependencies (confirmed: no `three`, `@react-three/*`, `babylon`, `pixi`, no WebGL usage anywhere in `src` or `package.json`/`bun.lock`) — this is a from-scratch addition.

---

## 2. Scope boundary

**In scope for Phase 2 (this plan):** a new, additive spatial/game *presentation* of data that Phase 1 already produces or will produce once complete — file tree, working changes, vitality, PR/issue classification, checkpoints, view mode. Rendering, camera, shading, growth animation, and PSX styling are all genuinely new.

**Explicitly NOT in scope for Phase 2, stays Phase 1:**
- Any unfinished Phase-1 contract (M3's historical-ref-to-variant gap, any future Phase-1 acceptance gaps) — these must close in the normal 2D UI. Phase 2 must not become a side door for finishing them "as a building."
- `.dh`/DHF format work — `PHASE_SCOPE_CONTRACT.md` §3 is explicit that `.dh` belongs fully to Phase 1, is not a gamification concern, and no properties of it may be invented here.
- FLUBBER — `PHASE_SCOPE_CONTRACT.md` §4: FLUBBER is Phase 1's shared interaction grammar for touch/mouse/keyboard/explorer/editor/diff/trash/windows. The 3D world may (and should) sit on the *same* window/lifecycle contracts, but any new camera/avatar navigation input scheme is a **new, separate interaction concern**, not a second FLUBBER. It must be named as such (see §4.6).
- Git-native substrate / ANVIL Core (Phase 3) — independent, not a dependency of this plan. `PHASE_SCOPE_CONTRACT.md` §5 notes Phase 2 may later talk to either GitHub directly or a Phase-3 ANVIL Core, but that infrastructure choice does not change anything in this document; all milestones below assume the existing direct-GitHub `src/lib/github.ts` read path.
- Multiplayer/backend — no backend exists in DRAGHUB; this plan stays 100% client-side, same as Phase 1.

---

## 3. World concept — concrete entity mapping

One coherent low-poly town, built from real repository data, not placeholder geometry.

| Repo entity (existing data source) | World entity | Notes |
|---|---|---|
| Top-level directory (`TreeEntry` with `type: "tree"` at depth 1, from `fetchTreeRecursive` in `src/lib/github.ts`) | **District** — a ground plot with its own footprint, added to the town the first time it's rendered (town visibly "grows" as more of the repo is loaded — Dorfromantik-style incremental placement) | Deeper nesting doesn't get its own recursive district; subfolders beyond depth 1 densify their parent district's building cluster (keeps district count bounded, avoids unbounded recursive nesting). |
| File (`TreeEntry` with `type: "blob"`) | **Building**, placed inside its directory's district | Position: reuse `layout.ts`'s existing `snapToGrid`/grid-position logic — extend the existing 2D `(x, y)` to 3D by treating it as `(x, z)` ground-plane coordinates, deriving height separately. This is exactly the seam `PLAN.md` §5 pre-built for this purpose. |
| File byte size (`TreeEntry.size`, already returned free by `fetchTreeRecursive` — no extra API request) | Building height (log-scaled) | Deliberately *not* LOC — LOC needs per-file content fetches for potentially thousands of files; tree size is already in hand for every entry in one request. |
| File extension/language (existing language classifier used by the editor/highlighter) | Building **archetype** (silhouette) | Small fixed table: source code → tall narrow tower; config/JSON/YAML → shed; markdown/docs → signpost/kiosk; images/binary/LFS → warehouse; test files → walled yard. Reuses the existing classifier instead of re-deriving extension groups. |
| `Vitality.level` (`"fresh"|"active"|"stale"|"ancient"|"unknown"`, `src/lib/vitality.ts`, already implemented from commit history) | Building material/decay tier | Maps 1:1 onto the 4 real levels already computed (fresh = new-construction look, active = well-kept, stale = weathered, ancient = crumbling); no invented tier ladder not backed by data. |
| `WorkingChange` (`src/lib/github-ops.ts`, per-repo bucket in `src/features/changes/store.ts`) | Construction scaffolding overlay | `add` → new building rising under scaffolding on an empty plot; `modify` → scaffolding wrapping the existing building; `delete` → building flagged for demolition (translucent + red outline + crane marker); `rename` → building shown moving between old/new plot coordinates. Pure skin over the existing `WorkingChange.kind` union. |
| `checkpoint.created` event (`src/lib/events.ts`, fired by `checkpointRepo` in `src/features/changes/ops.ts`) | Town growth event | Subscribing to this existing bus event triggers scaffolding-drop + a short "building completed" pulse for every building whose path was in the committed changeset. Zero new state — a pure event-bus subscriber. |
| Branch (`RepoState.meta.branch`) | Time-of-day/lighting preset on the *same* town, not a separate island | Rejecting "branch = separate island": with many feature branches, per-branch islands multiply asset/layout state combinatorially and contradict the single-coherent-world brief. A lighting/fog preset swap (e.g. `main` = clear daylight, feature branch = dusk/overcast) reskins the same city on branch switch. Milestone M17 (polish), not required for M13–M16. |
| Open PR (`PullRequestSummary`, `src/features/pulls/api.ts`) + `classifyPr()` (`src/features/pulls/classify.ts`, `"clean"|"conflict"|"failing"|"needs-review"|"spam-suspect"`) | One banner/kiosk structure per open PR, clustered at the district edge (or a shared "town gate" plaza) | Banner color/icon comes directly from the existing classifier — no new PR taxonomy invented, no "mobspawn creature" system (see §7 non-goals). |
| Issue (`IssueSummary`, `src/features/issues/api.ts`) | Entries on a single shared **task-board** structure per district (or one town-central board), not one building per issue | Issue counts are unbounded; a board keeps mesh count O(1) regardless of issue volume, unlike a per-issue building. |
| Merge conflict (`src/lib/merge.ts` hunk parser, already implemented) | A warning beacon atop the affected building | This plan does **not** commit to a literal "hunk-shooting minigame" (see §7 non-goals) — only a spatial *indicator* driven off data the merge module already parses. |

### Camera: one rig, not two competing modes

Rather than making the user pick between a SimCity top-down camera and a GTA-III free-roam camera, this plan uses **one continuous camera state machine** on a single `PerspectiveCamera`:

- **Default state ("town view")**: elevated, tilted-down, orbiting/panning over the whole district layout — delivers the SimCity/Dorfromantik build-up feel. Driven by drag-pan + scroll-zoom + WASD pan.
- **Focus state ("street view")**: triggered by selecting/approaching a building — the same camera dollies down to a near-ground, GTA-III-eye-level framing and orbits that structure. Achieved as a *state transition* on the same rig (target distance + pitch interpolate), not a second camera or a mode switch buried in a menu.

This avoids maintaining two camera implementations and avoids a "four games bolted together" look — it reads as one camera that lets you zoom from town to street level.

---

## 4. Technical architecture

### 4.1 Module placement

New self-contained module at **`src/features/repo-world/`**, following the module pattern already established by `src/features/search/` (own API/data file(s), UI, `index.tsx`; communicates only through existing store/callback surfaces, never a second global store):

```
src/features/repo-world/
  RepoWorldApp.tsx             # WindowContentProps entry point, mirrors RepositoryExplorerApp.tsx
  scene/
    world-model.ts             # pure TS: TreeEntry[]+WorkingChange[]+Vitality+PR/Issue -> WorldModel
    world-model.test.ts        # bun test, no React/Three imports - same convention as layout.ts/merge.ts/vitality.ts/classify.ts
    Scene.tsx                  # <Canvas>, camera rig, instanced building meshes
    materials/                 # slot for maintainer-supplied shaders/materials (see 4.4) - not authored in this pass
    buildings.ts                # archetype table (extension -> silhouette), material-tier table (Vitality.level -> skin)
  camera/
    world-camera-controller.ts # town-view/street-view state machine (NOT FLUBBER - see 4.6)
```

`world-model.ts` is deliberately renderer-agnostic: it takes the same data Phase 1 already fetches/holds and produces a plain data structure (district list, building list with position/height/archetype/tier/overlay-state, PR banners, issue-board summary). This keeps the "what maps to what" logic unit-testable with `bun test` and keeps `Scene.tsx` a thin renderer of that model.

### 4.2 Wiring into the Application Registry / window manager

New entry in `applicationRegistry`'s `definitions` array in `src/features/desktop/application-registry.tsx`:

```ts
{
  id: "repo-world",
  kind: "tool",
  title: "Repository World",
  iconKey: "world",           // new AppIconKey
  defaultSize: { width: 960, height: 640 },
  minimumSize: { width: 480, height: 340 },
  allowMultiple: true,
  render: (p) => <RepoWorldApp {...p} />,
}
```

Design decisions and why:

- **`kind: "tool"`, not a new `WindowKind`.** `deriveCloseScope` in `src/features/desktop-apps/lifecycle-adapter.ts` only special-cases `kind === "repository" | "editor" | "viewer"`; anything else resolves to `{ mode: "none" }`, so closing a World window never implicitly commits or discards repo state. Correct for M13–M16 since the world starts read-only. If a later milestone adds world-native mutable state (e.g. dragged building positions persisted through `layout.ts`), `CloseScope` needs revisiting then — flagged as an open item, not solved prematurely.
- **Resource: reuse the existing `{ type: "repository", repoKey }`**, no new `WindowResource` variant. `openOrFocusWindow` matches on `(applicationId, resource, owner)` (`src/features/desktop/window-state.ts`), so `repo-world` as a distinct `applicationId` against the same repository resource naturally opens a separate window instance from `repository-explorer` for the same repo — Explorer + World both open, scoped to one repo, with zero new types.
- **Owner: a repository-window child.** Entry point: a new toolbar button in `RepositoryExplorerApp.tsx` (`src/features/desktop-apps/RepositoryExplorerApp.tsx`, alongside the existing "Changes"/viewer/editor child-window buttons), calling the already-existing `wm.openRepositoryChild(windowId, "repo-world", { type: "repository", repoKey }, ...)` (verified present at `src/features/desktop/WindowManagerProvider.tsx:157/495` and already used in `RepositoryExplorerApp.tsx`). `openRepositoryChild` already assembles the correct `childOwner(repoKey, repositoryWindowId)` owner — no new plumbing needed.
- **`RepoScope` reuse is mandatory, not optional.** `RepoWorldApp.tsx` must follow the exact pattern `RepositoryExplorerApp.tsx` uses: resolve `repoKey` case-insensitively against `state.repos`, gate on `useRepoRequest`, then wrap its body in `<RepoScope repoKey={repoKey}>` + `<DesktopWindowContext.Provider value={{ windowId, repoKey }}>` (`src/features/desktop-apps/window-context.tsx`). `docs/POST_PR8_REFERENCE_INTEGRATION.md`'s "Mandatory repository-state rule" explicitly forbids any desktop application from reading a global active-repo pointer; a World window for repo A must never re-render because repo B's window changed focus.
- **Persistence allow-list.** `src/features/desktop/persistence.ts` hardcodes an `applications` allow-`Set` used by `sanitizeDesktopSession` to decide which persisted `applicationId`s survive a reload; `"repo-world"` **must** be added, or a saved session with an open World window silently drops it on reload. No `DESKTOP_SESSION_VERSION` bump needed (session/window shape itself doesn't change).
- **Icon registration.** `AppIconKey` in `src/features/icons/app-icon-registry.tsx` needs a new key (e.g. `"world"`) mapped to a Fluent icon, following the existing pattern (string keys only are persisted, never a component reference).

### 4.3 Canvas lifecycle across minimize — real risk, concrete fix

The window kernel keeps window content **mounted** while minimized — confirmed in `src/features/desktop/WindowFrame.tsx`: a minimized window gets `aria-hidden`/`inert` and an `is-minimized` class, never unmounted from the React tree or DOM. An R3F `<Canvas>` naively left running under `display:none`/`inert` risks browser-throttled/reclaimed WebGL contexts and wastes GPU/battery for an invisible window.

Fix, matching the kernel's "stay mounted" rule instead of fighting it:
- **Never unmount `<Canvas>` on minimize** — stays consistent with every other window type today.
- **Pause, don't destroy, the render loop.** R3F's `<Canvas frameloop="demand">` (or manual `invalidate`/`advance`) lets the scene stop rendering while hidden without tearing down the GL context. Drive this off the window's own `minimized` flag on `DesktopWindowState`, read via `useWindowManager()` — flip `frameloop` between `"always"` (visible) and `"never"`/`"demand"` (minimized).
- **Page Visibility API as a second pause trigger**, matching the pattern already established for Dock polling in `PLAN.md` M9 (`document.hidden` pause) — same idea, applied to the render loop.
- Restoring the window simply flips `frameloop` back; no re-creation, no reload of the world model, no flash.

### 4.4 Shading/material — out of scope for this pass, pluggable slot only

**The maintainer is authoring the PSX-look shaders themselves; this plan does not design or implement them.** Earlier drafts of this document sketched a specific PSX technique (low-res render target, ordered dithering, vertex snapping, affine-warp approximation); that concrete implementation is intentionally dropped here so it doesn't collide with the maintainer's own shader work.

What this plan does commit to, so the rest of the architecture doesn't block on the shading decision:

- `Scene.tsx` and `buildings.ts` treat material/shader as an **injected, swappable dependency** — building meshes are built with a plain placeholder material by default (e.g. `MeshBasicMaterial`/`MeshStandardMaterial`) so M13/M14 are visually testable end-to-end before any custom shader exists, and the maintainer's material(s) drop in later without touching `world-model.ts`, the instancing setup (§4.5), or the window/registry wiring (§4.2).
- The `materials/` slot under `src/features/repo-world/scene/` is reserved for the maintainer's shader/material code — not authored, named, or structurally pre-designed by this plan beyond "it plugs into the per-`(archetype, vitality-tier)` instanced-mesh buckets from §4.5."
- Whatever technique is chosen later, **do not couple the retro look to the LOD/culling boundary** the way the earlier draft did (tying dithering/fog to draw-distance culling) — §4.5 below defines culling independently of any visual style so the culling strategy survives a shader swap unchanged.
- Theming integration (reading `--dh-*` tokens for ambient/fog tint per `docs/THEMING_CONVENTIONS.md`, never a second theme provider) is a real constraint whatever shader ships, and is noted here so it isn't lost: whoever authors the material must read theme tokens once at mount, not subscribe a second theme system.

### 4.5 Performance: instancing, not one mesh per file

A repository can have thousands of tracked files; one unique `Mesh`/material per building is a non-starter:

- Bucket buildings by `(archetype, vitality-tier)` — a small fixed number of buckets (~5 archetypes × 4 vitality levels ≈ 20) — render each bucket as a single `InstancedMesh` (`@react-three/drei`'s `Instances`/`Instance`), writing each file's transform into that bucket's instance buffer. Draw calls stay roughly constant regardless of file count.
- Cull by a plain camera-distance boundary, defined independently of any visual style (a numeric draw-distance constant in `world-model.ts` or `Scene.tsx`, not tied to fog/dither) — buildings beyond it are excluded from the instance buffer entirely for that frame. Whoever later authors the retro shader (§4.4) may choose to visually mask this boundary with fog, but the culling logic itself must not depend on that choice existing.
- Repos whose file count would still exceed a practical instance cap after culling degrade gracefully to a low-detail "skyline silhouette" billboard per district rather than dropping files silently — deferred to M17, not required for the first working version.
- Tree data is already cheap: one `fetchTreeRecursive` call yields every file's path/size in one request (already used by Phase-1 read paths) — no new API traffic pattern beyond what Phase 1 already fetches, other than the vitality/PR/issue calls needed for overlays (M15), which reuse existing modules and their existing caching.

### 4.6 Explicit non-invention of a second FLUBBER

If camera or building-selection input needs touch gesture handling beyond simple drag/pinch, that is a **new named interaction concern** (`camera/world-camera-controller.ts`), not a second FLUBBER implementation and not an extension of `src/lib/flubber-selection.ts`, which stays scoped to CodeMirror two-long-press text selection per its Phase-1 contract. Documentation for this module should say "world camera controls," never "FLUBBER for 3D."

---

## 5. New dependencies

Kept lean per `PLAN.md` §9 ("Neue Abhängigkeiten sparsam, aber pragmatisch"):

| Dependency | Why |
|---|---|
| `three` | The chosen rendering engine — required baseline for any WebGL scene. |
| `@react-three/fiber` | React renderer for Three.js — lets the world scene live as ordinary React components consuming `RepoScope`-scoped data via hooks, matching every other DRAGHUB module's component style instead of a hand-rolled imperative Three.js layer. |
| `@react-three/drei` | Helper library for R3F, justified narrowly by what M13/M14 need regardless of shading approach: `Instances`/`Instance` (instanced buildings, §4.5) and general scene helpers (camera controls primitives for §3's rig). `useFBO`/`shaderMaterial` remain available for whoever authors the retro material later (§4.4) but are not consumed by this plan's own milestones. De facto standard companion to R3F — utilities layered on the one already-chosen stack, not a second engine. |

**Not proposed for this plan's milestones:** `@react-three/postprocessing`/`postprocessing`. Since the retro shading technique itself is intentionally left to the maintainer (§4.4), this plan does not pre-decide whether it needs a postprocessing pipeline — that call belongs with whoever authors the shader, not this document.

No state-management library addition — `world-model.ts` is a pure function over data the existing reducer-based stores already expose; the scene reads them via existing hooks (`useActiveRepo`, changes-store subscription, etc.), consistent with `PLAN.md` §9's rule to keep the reducer pattern and avoid Zustand/Redux/etc.

---

## 6. Staged milestones (Phase 2, gated per §0)

Numbered as a continuation of `PLAN.md`'s Phase-1 M1–M12 sequence, under a clearly separate **Phase 2** heading, so it's obvious these are not part of the Phase-1 checklist and not started under the same authorization.

> Every milestone below is blocked by §0's gate. None may begin implementation until Phase 1 is maintainer-accepted and Phase 2 is separately, explicitly authorized to move from spec to code.

### M13 — Static world render (one repo, top-level only)
- `world-model.ts` first cut: consumes `fetchTreeRecursive` output at depth 1 only (top-level dirs → districts, direct file children → buildings) plus `vitality.ts` for material tier.
- `Scene.tsx` renders flat instanced building blocks with a placeholder material (§4.4) — no camera navigation yet beyond a fixed elevated town-view angle, no retro shader (that's a separate, maintainer-authored track that plugs in later without touching this milestone's code).
- Registers `repo-world` in the application registry, wired as a `RepositoryExplorerApp.tsx` toolbar button, `RepoScope`-scoped, added to `persistence.ts`'s `applications` set.
- **Acceptance criterion:** opening "World" from a repository window for a real repo renders one building per top-level file (placeholder material is fine — no PSX look required yet); window survives minimize/restore without losing/recreating the GL context (frameloop pauses, doesn't unmount); reopening after reload restores the window (persistence allow-list works).

### M14 — Full tree + free-roam camera navigation
- `world-model.ts` extended to the full recursive tree (district/densification rule from §3), instanced-mesh bucketing per `(archetype, vitality-tier)` in place (§4.5).
- Camera state machine (`world-camera-controller.ts`): default town-view pan/zoom/orbit, focus/street-view transition on building selection, per §3.
- **Acceptance criterion:** a mid-size real repo (hundreds of files) renders and navigates at interactive frame rates on a laptop GPU; the plain distance-based culling boundary (§4.5) measurably caps instanced draw calls (verify via a draw-call counter, not by eye — no fog is required to exist yet to prove this); selecting a building smoothly transitions the camera to street view and back.

### M15 — Working-changes, PR, and issue overlays
- Scaffolding overlays driven by the changes store (add/modify/delete/rename skins per §3).
- PR banners from `pulls/api.ts` + `classifyPr()`; issue task-board from `issues/api.ts`.
- **Acceptance criterion:** creating/discarding a working change in the normal Explorer/Editor windows visibly updates the corresponding building's scaffolding state in an already-open World window for the same repo, without a manual refresh; a repo with open PRs/issues shows correctly classified banners/board entries.

### M16 — Growth animation on checkpoint
- Subscribe `Scene.tsx` (or a dedicated hook) to `events.ts`'s `checkpoint.created` event; play a scaffolding-drop/completion animation for every path in the affected changeset.
- **Acceptance criterion:** committing a checkpoint from the Working Changes panel triggers a visible, correctly-scoped growth animation in an open World window for that repo (and *only* that repo's window — no cross-repo bleed, per the mandatory repository-state rule).

### M17 — Polish: branch time-of-day, LOD overflow handling, retro material integration
- Branch-to-lighting-preset mapping (§3); graceful skyline-silhouette degradation for repos exceeding the practical instance cap (§4.5); integrating the maintainer's own retro shader/material into the `materials/` slot (§4.4) and tuning it against real device testing; theming-token integration for ambient/fog tint per light/dark mode, read once by whatever material ships.
- **Acceptance criterion:** switching the active branch in a repository window re-skins its open World window's lighting without reloading the whole scene; a very large repo (thousands of files) still renders at interactive frame rates via silhouette fallback instead of stalling or dropping the tab; the maintainer's shader is wired in without any change to `world-model.ts`, the instancing setup, or the registry/window wiring.

---

## 7. Explicit non-goals for this planning pass

- **No multiplayer/backend design.** `PLAN.md` §10 leaves multiplayer hosting as an open, unmade maintainer decision; every milestone assumes single-user/client-only, matching Phase 1's 100%-client-side architecture.
- **No literal FPS merge-conflict minigame.** This plan stops at a spatial *indicator* (a warning beacon, §3) and does not design a shooting-mechanic input scheme, hit detection, or win condition.
- **No literal "PR mobspawn creature" system.** PRs are classified banners/kiosks (reusing `classifyPr()`), not spawned enemy creatures with behavior/AI — that would need game-logic design (spawn rate, movement, combat) far beyond a first spatial representation and isn't required by the phase contract's actual wording.
- **No code written, no dependencies installed.** `three`/`@react-three/fiber`/`@react-three/drei` are proposed, not added.
- **No PSX/retro shader design or implementation.** The maintainer is authoring their own shaders for the retro look; this plan only reserves a pluggable slot (§4.4) and keeps culling/instancing independent of whatever material ships.
- **No `.dh`/DHF or FLUBBER redesign.** Both remain fully out of scope, per §2.
- **No resolution of open Phase-1 decisions** (editor library — already CodeMirror 6 — auth model, wiki feasibility) — those are Phase-1 concerns tracked in `PLAN.md` §10, untouched here.

---

## 8. Verification section (manual QA, per DRAGHUB's actual testing convention)

DRAGHUB has no automated UI/visual-regression test framework (`PLAN.md` §9). Same convention applies here:

- **Pure logic** (`world-model.ts`, archetype/tier lookup tables in `buildings.ts`) gets `bun test` coverage, exactly like `layout.ts`/`merge.ts`/`vitality.ts`/`classify.ts` today.
- **Every milestone's Definition-of-Done**, matching `PLAN.md` §9: (1) `bun typecheck && bun lint` green, (2) manual QA in the browser including failure paths, (3) docs updated to reflect what shipped vs. what's still open — never marking a milestone done before end-to-end acceptance, per `PHASE_SCOPE_CONTRACT.md` §7.10.
- **M13:** open a real repo's Explorer window, click the new World toolbar button, confirm buildings render (placeholder material is acceptable — no shading requirement yet); minimize the World window, wait, restore — confirm no black screen/context-loss and confirm (devtools GPU panel or a temporary debug counter) the render loop actually paused while minimized; reload the page, confirm the World window reappears.
- **M14:** open a larger repo, confirm full recursive tree renders (spot-check building count against a manual folder count for a small test repo); drag-pan/zoom around town view; select a building, confirm smooth transition to street view and back; watch frame rate stays interactive; confirm buildings beyond the distance-culling boundary aren't rendered (debug wireframe/draw-call counter to confirm instancing keeps draw calls flat as file count grows — do this independently of any shader/fog, per §4.5).
- **M15:** stage a file add/modify/delete/rename while a World window for the same repo is open; confirm overlays update live and correctly scoped (open a *second* repo's World window simultaneously, confirm it does **not** react to the first repo's changes — the mandatory repository-state rule check). Confirm PR/issue banners/board match the flat panels for the same repo.
- **M16:** create a working change, checkpoint it, confirm the growth animation fires once for the correct building(s) in the same repo's World window, and does *not* fire in a different repo's open World window.
- **M17:** switch branches, confirm the paired World window's lighting preset updates without a full scene reload/flash; open a very large real-world repo (thousands of files), confirm silhouette fallback keeps the tab responsive; toggle light/dark theme, confirm ambient/fog tint follows without a second theme provider (spot-check `THEMING_CONVENTIONS.md` compliance — there should be no second persistence key/provider); confirm the maintainer's own retro shader drops into the `materials/` slot without changes to `world-model.ts`, instancing, or window/registry code.

---

## Critical files for implementation

- `src/features/desktop/application-registry.tsx` — registers the new `repo-world` application.
- `src/features/desktop-apps/RepositoryExplorerApp.tsx` — pattern to mirror for `RepoWorldApp.tsx`'s `RepoScope`/window-context wiring, and where the new toolbar entry point is added.
- `src/features/desktop/persistence.ts` — `applications` allow-set that must include `"repo-world"` for session persistence.
- `src/features/desktop/WindowManagerProvider.tsx` — `openRepositoryChild` (already implemented, reused as-is).
- `src/lib/layout.ts` and `src/lib/vitality.ts` — existing Phase-1 seams (`viewMode: "city"`, grid positions, vitality levels) that `world-model.ts` must consume rather than reinvent.
- `src/lib/events.ts` and `src/features/changes/store.ts` / `src/features/changes/ops.ts` — the domain event bus (`checkpoint.created`) and per-repo working-change buckets that drive the scaffolding/growth-animation milestones (M15/M16).
- `docs/PHASE_SCOPE_CONTRACT.md` and `PLAN.md` §6/§12 — the binding scope/gate rules and the Phase-1 milestone checklist this plan's M13–M17 numbering continues from; must be re-checked before any implementation session begins.

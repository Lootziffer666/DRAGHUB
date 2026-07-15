# DRAGHUB — Build Specification

**Status:** Build-ready product and architecture contract  
**Target repository:** `Lootziffer666/DRAGHUB`  
**Primary implementation language:** TypeScript  
**Current base:** Next.js 16, React 19, Tailwind 4, client-side GitHub browser, tabs, search, staging, IndexedDB and direct GitHub commits.

---

## 1. Product decision

DRAGHUB is no longer only a desktop-style browser for GitHub repositories.

It becomes a **Git-native local development surface** in which a repository can be:

1. opened from GitHub,
2. materialized locally without redundant copies,
3. run inside a short-lived isolated workspace,
4. edited by a human or coding agent,
5. inspected as a live preview, diff and interaction flow,
6. accepted partially or completely,
7. published as a commit, branch or pull request.

The central product equation is:

```text
Repository state
+ temporary change layers
+ runtime definition
= executable project session
```

A version, an agent run and an executable project state are treated as related views of the same state graph.

---

## 2. Non-negotiable principles

### 2.1 One surface, many runtimes

Different programming languages and engines remain valid. Their operational differences must disappear behind adapters.

The user always sees the same controls:

```text
OPEN · RUN · STOP · RESTART · PREVIEW · FLOW · DIFF · ACCEPT · DISCARD · PUBLISH
```

### 2.2 No redundant project copies

A session must not create another permanent full clone of the repository, dependency tree, runtime or asset collection.

Use:

- shared bare Git mirrors,
- Git worktrees,
- content-addressed objects,
- shared package-manager stores,
- OCI image layers,
- copy-on-write session overlays,
- reference-counted garbage collection.

The rule is:

> One physical object, any number of logical uses.

### 2.3 Git is the versioning model

DRAGHUB must reveal and simplify Git's incremental object model rather than inventing a parallel snapshot format.

Human-facing terms may be simpler:

| Git term | DRAGHUB surface |
|---|---|
| Commit | Checkpoint |
| Branch | Variant |
| Worktree | Workspace |
| Diff | Change layer |
| Revert | Restore state |
| Cherry-pick | Apply layer |
| Merge | Combine variants |
| Tag | Stable release |

Internal storage and publication remain Git-native.

### 2.4 Every AI change is a proposal layer

A coding agent never receives unreviewed authority over the accepted repository state.

```text
accepted commit
→ isolated agent workspace
→ proposed change layer
→ run + preview + diff + flow validation
→ accept all / accept selected / discard
→ commit or PR
```

### 2.5 The user-flow graph is a contract, not documentation

A visual flow is stored as machine-readable JSON. The visual layout is secondary. The semantic actions and transitions are authoritative.

### 2.6 Prompt interpretation is visible before execution

While the user types, DRAGHUB displays the likely concepts, actions, relations, assumptions, exclusions and ambiguities the model will infer.

The user can correct the interpretation before the coding request is submitted.

---

## 3. Existing DRAGHUB baseline to preserve

The current application already provides useful foundation layers:

- repository input and loading,
- GitHub REST-backed file tree,
- tabs and branch switching,
- search,
- multi-selection,
- drag-and-drop and touch-oriented interaction,
- file staging,
- archive extraction,
- IndexedDB persistence,
- GitHub commit operations,
- optional Git LFS handling.

Do not rewrite these features merely to introduce the new architecture. Place the new state, runtime and contract systems beside them, then migrate existing providers behind the new contracts.

---

## 4. Target experience

### 4.1 Opening a repository

The home screen accepts:

```text
owner/repo
https://github.com/owner/repo
GitHub repository selection
recent repository
```

Opening a repository creates a `ProjectSession`.

The initial mode is safe read-only inspection. Local execution is an explicit action.

### 4.2 Starting a local session

```text
Open repository
→ resolve commit and branch
→ ensure shared Git mirror exists
→ create or reuse thin worktree
→ detect runtime adapter
→ resolve runtime definition
→ start isolated runner
→ detect exposed preview channel
→ stream logs and status
```

### 4.3 Editing

Changes may originate from:

- direct file editing,
- drag-and-drop uploads,
- visual UI editing,
- flow editing,
- prompt-driven agent changes,
- imported patch or PR,
- generated artifacts.

Every change is assigned to a layer and receives provenance metadata.

### 4.4 Reviewing

The review surface combines:

- changed files,
- semantic diff,
- running preview,
- logs and errors,
- user-flow diff,
- agent explanation,
- provenance,
- validation results.

### 4.5 Publishing

Publishing supports:

- commit to current branch,
- create branch,
- create pull request,
- save local checkpoint only,
- export patch,
- discard layer.

---

## 5. Top-level architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ DRAGHUB WEB SURFACE                                         │
│ Next.js · React · TypeScript                                │
│                                                             │
│ Repo │ Files │ Code │ Preview │ Flow │ Prompt │ Diff │ Git  │
└──────────────────────────┬──────────────────────────────────┘
                           │ typed WebSocket / HTTP contract
┌──────────────────────────▼──────────────────────────────────┐
│ DRAGHUB LOCAL RUNNER                                        │
│ TypeScript service distributed as npm/bun package           │
│                                                             │
│ Git mirrors · worktrees · processes · containers · streams  │
│ object vault · adapter host · secrets gate · cleanup         │
└───────────────┬─────────────────────┬───────────────────────┘
                │                     │
        ┌───────▼────────┐    ┌──────▼──────────────────────┐
        │ Shared storage │    │ Runtime adapters             │
        │ Git/CAS/cache  │    │ Node/Python/Gradle/Godot…    │
        └────────────────┘    └──────────────────────────────┘
```

### 5.1 Why a local runner is required

A deployed browser application cannot directly clone repositories, start local processes, mount filesystems or expose localhost previews on the user's computer.

DRAGHUB therefore needs a local companion service.

The web app and runner must share generated TypeScript contracts. No duplicate hand-maintained API types.

### 5.2 Repository layout

Target monorepo layout:

```text
/apps
  /web                 # existing Next.js interface
  /runner              # local companion daemon
/packages
  /contracts           # shared schemas and event types
  /git-engine          # mirrors, worktrees, refs, diffs
  /session-engine      # session lifecycle and overlays
  /object-vault        # content addressing and GC
  /runtime-adapters    # adapter interfaces and built-ins
  /flow-contract       # graph schema, validation and diff
  /intent-preview      # prompt interpretation pipeline
  /agent-bridge        # coding-agent request/response contract
  /ui                  # reusable UI components
/docs
  DRAGHUB_BUILD_SPEC.md
```

Migration does not need to begin by physically moving every current file. Introduce packages when the first shared boundary is implemented.

---

## 6. Core domain contracts

All contracts must be runtime-validated. Use JSON Schema, Zod or another single TypeScript-first schema system. Generated JSON Schema is required for storage and external adapters.

### 6.1 ProjectSession

```ts
export type ProjectSession = {
  id: string;
  repository: {
    owner: string;
    name: string;
    remoteUrl: string;
  };
  base: {
    branch: string;
    commitSha: string;
  };
  workspace: {
    worktreePath: string;
    mode: "read-only" | "editable";
  };
  adapterId: string | null;
  state:
    | "preparing"
    | "ready"
    | "starting"
    | "running"
    | "stopped"
    | "failed"
    | "closing";
  layers: string[];
  channels: SessionChannels;
  createdAt: string;
};
```

### 6.2 SessionChannels

```ts
export type SessionChannels = {
  logs?: string;
  events?: string;
  preview?: string;
  terminal?: string;
  artifacts?: string;
};
```

### 6.3 ChangeLayer

```ts
export type ChangeLayer = {
  id: string;
  sessionId: string;
  parentLayerId?: string;
  baseCommitSha: string;
  title: string;
  status: "draft" | "validated" | "accepted" | "discarded" | "published";
  source:
    | { type: "human"; actorId?: string }
    | { type: "agent"; provider: string; model: string; runId: string }
    | { type: "flow-editor"; flowId: string }
    | { type: "import"; origin: string };
  files: LayerFileChange[];
  validations: ValidationResult[];
  createdAt: string;
};
```

### 6.4 RuntimeAdapter

```ts
export interface RuntimeAdapter {
  id: string;
  label: string;
  detect(ctx: DetectionContext): Promise<DetectionResult>;
  prepare(ctx: AdapterContext): Promise<void>;
  start(ctx: AdapterContext): Promise<RunningProcess>;
  stop(ctx: AdapterContext): Promise<void>;
  discoverPreview(ctx: AdapterContext): Promise<PreviewDescriptor | null>;
  collectArtifacts(ctx: AdapterContext): Promise<ArtifactDescriptor[]>;
}
```

### 6.5 Run definition

Projects may provide an optional `draghub.run.json`.

```json
{
  "$schema": "./schemas/draghub.run.schema.json",
  "version": 1,
  "environment": {
    "kind": "devcontainer",
    "definition": ".devcontainer/devcontainer.json"
  },
  "start": {
    "command": "bun run dev --hostname 0.0.0.0",
    "cwd": "."
  },
  "preview": {
    "kind": "web",
    "port": 3000,
    "healthPath": "/"
  },
  "artifacts": ["dist/**"]
}
```

Resolution precedence:

```text
1. draghub.run.json
2. .devcontainer/devcontainer.json
3. compose.yaml / docker-compose.yml
4. Dockerfile
5. adapter detection
6. user-selected command
```

---

## 7. Local Codespace engine

### 7.1 Shared Git mirror

For each remote repository, create one bare mirror:

```text
~/.draghub/git/<host>/<owner>/<repo>.git
```

The mirror owns the downloaded Git objects.

Opening another branch, commit or session must not perform another full clone.

Required operations:

- clone mirror if absent,
- fetch incremental updates,
- resolve branch, tag, PR or commit,
- create worktree,
- remove worktree safely,
- prune stale worktree metadata.

### 7.2 Worktrees

Session workspaces live under:

```text
~/.draghub/sessions/<session-id>/workspace
```

Create them through the shared mirror:

```text
git worktree add --detach <path> <commit>
```

A branch-backed editable session may use a local session ref. Never attach two worktrees to the same writable branch.

### 7.3 Session persistence modes

```ts
type PersistenceMode =
  | "ephemeral"      // remove workspace when session closes
  | "checkpointed"   // retain accepted local refs, remove materialized workspace
  | "pinned";        // retain workspace for deliberate long-running work
```

Default: `checkpointed` for owned repositories, `ephemeral` for foreign repositories.

Checkpointing must preserve Git objects and refs, not a second permanent folder copy.

### 7.4 Dependency and runtime sharing

Do not make a universal private dependency copy system in milestone one. Use existing native deduplication first:

- pnpm or Bun global/shared package stores,
- Gradle cache,
- Cargo registry/cache,
- pip/uv cache,
- OCI image layer cache,
- Git LFS object cache.

The object vault is introduced for large repository-managed objects and cross-repository assets that are not handled adequately by these systems.

### 7.5 Content-addressed object vault

```text
~/.draghub/objects/sha256/<prefix>/<full-hash>
~/.draghub/manifests/
~/.draghub/refs/
```

Each object record contains:

```ts
export type VaultObject = {
  hash: string;
  size: number;
  mediaType?: string;
  createdAt: string;
};
```

A manifest maps logical project paths to hashes.

Never replace ordinary Git source files with opaque pointers automatically. Vault references are appropriate for:

- large models,
- repeated asset archives,
- generated artifacts,
- shared immutable tool bundles,
- explicit project-managed external objects.

### 7.6 Copy-on-write behavior

The session workspace is the writable layer. Shared mirrors, package stores, object vault contents and image layers remain immutable.

When supported, use reflinks or hardlinks only for immutable files. Never hardlink files that a running process may modify.

### 7.7 Garbage collection

Garbage collection is reference-based.

An object may be removed only when it is referenced by none of:

- accepted local checkpoints,
- pinned sessions,
- repository manifests,
- retained artifacts,
- active processes,
- pending publication layers.

GC provides dry-run output before deletion.

---

## 8. Runtime isolation and execution

### 8.1 Execution backends

Support in this order:

1. native process in restricted local workspace,
2. Dev Container CLI,
3. Docker or Podman container,
4. engine-specific remote-view adapter.

The selected backend is part of the session record.

### 8.2 Initial adapters

Build adapters in this order:

1. **Node web** — Next.js, Vite, React, static dev server
2. **Docker/Compose** — repository-provided definitions
3. **Python web/CLI**
4. **Gradle/Kotlin**
5. **Godot**
6. later Unity and Unreal remote preview adapters

### 8.3 Event stream

All runner output is normalized into typed events:

```ts
export type RunnerEvent =
  | { type: "session.state"; sessionId: string; state: ProjectSession["state"] }
  | { type: "process.output"; sessionId: string; stream: "stdout" | "stderr"; text: string }
  | { type: "process.exit"; sessionId: string; code: number | null; signal?: string }
  | { type: "preview.ready"; sessionId: string; preview: PreviewDescriptor }
  | { type: "artifact.created"; sessionId: string; artifact: ArtifactDescriptor }
  | { type: "validation.result"; sessionId: string; result: ValidationResult }
  | { type: "security.request"; sessionId: string; request: CapabilityRequest };
```

Use WebSocket for bidirectional session control and streaming. Use HTTP for idempotent resource operations.

### 8.4 Preview types

```ts
type PreviewDescriptor =
  | { kind: "web"; proxiedUrl: string; sourcePort: number }
  | { kind: "terminal"; terminalId: string }
  | { kind: "desktop-stream"; streamUrl: string; inputChannel: string }
  | { kind: "image"; artifactId: string };
```

Web preview is milestone one. Desktop/game streaming is a later adapter capability and must not block the initial architecture.

---

## 9. Git-native incremental versioning

### 9.1 State graph

The browser must display repository history as an understandable state graph, not only a commit list.

Each node may be:

- accepted Git commit,
- local checkpoint ref,
- agent proposal,
- imported PR state,
- temporary working layer.

### 9.2 Local checkpoints

A checkpoint is represented by a Git commit on a local hidden ref:

```text
refs/draghub/checkpoints/<session-id>/<checkpoint-id>
```

This provides:

- true Git deduplication,
- exact restoration,
- parent relationships,
- normal diff and merge tools,
- no pollution of the public branch until publication.

### 9.3 Change-layer operations

Required UI actions:

```text
Accept all
Accept selected files
Accept selected hunks
Move to new variant
Combine with another layer
Restore previous state
Discard
Publish
```

Hunk-level acceptance may initially use standard Git patch application.

### 9.4 Provenance

Every accepted layer writes structured metadata into the local DRAGHUB database. Publication may optionally include provenance in the commit body or Git notes.

Do not force generated metadata files into every user repository.

### 9.5 Conflict model

Conflicts are displayed as state incompatibilities:

```text
Layer A and Layer B modify the same region.
```

The UI offers:

- choose A,
- choose B,
- manually combine,
- ask agent to propose a resolution,
- keep layers separate.

The original layers remain immutable.

---

## 10. Unified editor surface

### 10.1 Main layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Repository · Branch/Variant · Session state · Run controls           │
├───────────────┬───────────────────────────────┬──────────────────────┤
│ Explorer      │ Primary surface               │ Context inspector    │
│               │                               │                      │
│ files         │ Code / Preview / Flow / Diff  │ selection properties │
│ versions      │                               │ intent interpretation│
│ sessions      │                               │ validation           │
├───────────────┴───────────────────────────────┴──────────────────────┤
│ Terminal · Logs · Problems · Artifacts · Agent runs                  │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 Primary modes

- **Files** — current explorer and tabs
- **Code** — editable source view
- **Preview** — running project
- **Flow** — visual interaction contract
- **Diff** — current layer against parent
- **Versions** — state graph
- **Agent** — prompt, intent preview and run history

The modes share one selection model. Selecting a UI node, flow node, diff hunk or file should reveal related entities where mappings exist.

### 10.3 Onlook-inspired behavior without coupling DRAGHUB to Onlook

For DOM-based web applications:

- click preview element,
- locate source component,
- show related file and range,
- permit safe property editing,
- reflect change as a layer,
- validate against flow contract.

Implement this as a `WebDomMappingAdapter`, not as the universal project model.

---

## 11. Visual Interaction Contract

### 11.1 Storage

Store flow contracts in the repository under:

```text
/.draghub/flows/*.flow.json
```

A repository may opt out and keep flows only locally, but repository storage is the default for collaborative use.

### 11.2 Editor choice

Use React Flow/xyflow as the initial graph canvas because DRAGHUB is already React-based and requires unrestricted custom semantic nodes.

Do not store React Flow's internal object as the product contract. Create an adapter between the visual canvas and the stable flow schema.

### 11.3 Flow schema

```ts
export type UiFlow = {
  schemaVersion: "1.0";
  id: string;
  title: string;
  startNodeId: string;
  nodes: UiFlowNode[];
  transitions: UiTransition[];
  editor?: {
    viewport?: { x: number; y: number; zoom: number };
  };
};

export type UiFlowNode = {
  id: string;
  label: string;
  kind:
    | "screen"
    | "overlay"
    | "drawer"
    | "input"
    | "action"
    | "decision"
    | "error"
    | "end";
  action?: UiAction;
  component?: {
    existingComponent?: string;
    allowNewComponent: boolean;
  };
  policy?: {
    preserveParentState?: boolean;
    allowNewRoute?: boolean;
    blocking?: boolean;
  };
  editor?: { x: number; y: number };
};

export type UiAction =
  | { type: "navigate"; target: string; replaceHistory?: boolean }
  | { type: "open_overlay"; target: string }
  | { type: "close_overlay" }
  | { type: "open_drawer"; target: string }
  | { type: "go_back" }
  | { type: "submit"; target?: string }
  | { type: "execute"; operation: string }
  | { type: "set_value"; key: string; value: unknown }
  | { type: "refresh"; target: string }
  | { type: "open_external"; url: string }
  | { type: "finish" };
```

### 11.4 Contract validation

Initial validation rules:

- every referenced node exists,
- exactly one start node,
- unreachable nodes are warnings,
- non-end nodes require an outgoing path unless explicitly terminal,
- overlay nodes default to `allowNewRoute: false`,
- `preserveParentState` is explicit for overlay/drawer behavior,
- reused components must resolve to indexed code symbols when available,
- action-specific required fields are present.

### 11.5 Flow-to-code validation

For the first implementation, validation is evidence-based rather than magical full reconstruction.

Adapters emit observations:

```ts
export type UiObservation = {
  sourceFile: string;
  sourceRange?: { start: number; end: number };
  trigger: string;
  effect:
    | { type: "navigate"; target: string }
    | { type: "open_overlay"; component: string }
    | { type: "state_change"; key: string };
};
```

The validator compares observations to the contract and reports:

```text
Expected: open overlay OAuthDialog while preserving RepoPicker.
Observed: navigate to /oauth.
```

Start with React/Next.js static analysis and runtime instrumentation. Other languages receive adapters later.

### 11.6 Flow diff

A flow change is reviewed semantically:

```diff
- presentation: page
+ presentation: overlay
+ preserveParentState: true
+ allowNewRoute: false
```

The coding agent receives this semantic diff, not merely a screenshot.

---

## 12. Prompt Intent Preview

### 12.1 Purpose

Before a prompt is submitted, show the probable interpretation that will become the agent's working contract.

The preview is not presented as certainty.

Confidence labels:

```text
Certain · Likely · Ambiguous · Contradictory · Missing
```

### 12.2 Output model

```ts
export type IntentPreview = {
  entities: IntentEntity[];
  actions: IntentAction[];
  relations: IntentRelation[];
  assumptions: IntentStatement[];
  exclusions: IntentStatement[];
  ambiguities: IntentAmbiguity[];
  proposedFlowPatch?: FlowPatch;
};
```

Display groups:

- recognized entities,
- requested actions,
- UI semantics,
- inferred relations,
- implied assumptions,
- explicit exclusions,
- ambiguous phrases,
- missing failure or cancellation paths.

### 12.3 Interaction

Every interpretation item is editable.

Example:

```text
OAuth presentation: Page
```

The user changes it to:

```text
OAuth presentation: Overlay
```

DRAGHUB updates both:

- structured agent context,
- provisional flow patch.

The original prompt remains visible. Structured corrections are submitted beside it rather than silently rewriting user text.

### 12.4 Processing pipeline

```text
keystrokes
→ debounce
→ deterministic UI vocabulary parser
→ small model or configured main model
→ schema validation
→ compare with existing flow and code index
→ render intent preview
```

Use deterministic rules for hard vocabulary and constraints:

```text
page, route, overlay, modal, drawer, tab, preserve, replace,
reuse, do not create, remain, return, refresh, close, cancel
```

Use the model for relations, implicit assumptions and ambiguity detection.

### 12.5 Performance rules

- debounce approximately 400–700 ms,
- cancel stale analyses,
- analyze only changed prompt suffix plus compact context where possible,
- do not send repository secrets,
- support a local model adapter,
- keep the typing surface responsive if analysis fails.

---

## 13. Agent bridge and gated implementation loop

### 13.1 Agent request

```ts
export type AgentChangeRequest = {
  sessionId: string;
  baseCommitSha: string;
  prompt: string;
  intent: IntentPreview;
  flowPatch?: FlowPatch;
  selectedFiles?: string[];
  constraints: AgentConstraint[];
};
```

### 13.2 Required constraints

Examples:

```ts
{ type: "forbid_new_route", scope: "oauth" }
{ type: "reuse_component", symbol: "RepoPicker" }
{ type: "preserve_state", target: "RepoPicker" }
{ type: "allowed_paths", paths: ["src/features/auth/**"] }
```

### 13.3 Loop

```text
interpret
→ show intent preview
→ user corrects contract if needed
→ create isolated layer
→ agent edits layer
→ build/run
→ collect errors and preview
→ validate code against flow
→ show result
→ accept / partially accept / ask for repair / discard
```

A repair run is a child layer of the failed proposal, preserving the full causal chain.

### 13.4 Agent independence

The bridge must support multiple providers and clients. DRAGHUB owns the request, layer and validation contracts; Claude Code, Codex or another agent is replaceable.

---

## 14. Security contract

### 14.1 Trust levels

```ts
type TrustLevel = "owned" | "trusted" | "foreign";
```

Default capabilities:

| Capability | Owned | Trusted | Foreign |
|---|---:|---:|---:|
| Read workspace | yes | yes | yes |
| Write workspace | yes | yes | explicit |
| Network | yes | explicit | blocked |
| GitHub token | scoped | scoped | blocked |
| Other secrets | explicit | explicit | blocked |
| Host home | blocked | blocked | blocked |
| Docker socket | blocked | blocked | blocked |
| Arbitrary host mounts | explicit | blocked | blocked |

### 14.2 Capability prompts

A repository may request:

- network domain access,
- secret access,
- additional filesystem mount,
- privileged container capability,
- local device access.

The user sees what requested it, why, scope and duration.

Grant choices:

```text
Deny · Allow once · Allow for this repository
```

### 14.3 Secret handling

Secrets are injected only into the selected process or container. They are never copied into the worktree, logs, flow contract, prompt preview or persisted session metadata.

### 14.4 Start scripts are code execution

Opening a repository and running a repository are separate actions. `postinstall`, Gradle plugins, Dev Container lifecycle hooks and Docker builds are treated as executable code.

Foreign repositories open read-only and do not auto-run.

---

## 15. Local persistence

Use a local database for DRAGHUB metadata. SQLite in the runner is preferred. The browser may continue using IndexedDB for transient UI state, but authoritative session, layer and provenance data belong to the runner.

Suggested tables:

```text
repositories
sessions
session_refs
layers
layer_files
agent_runs
validations
flow_contracts
artifacts
vault_objects
vault_references
capability_grants
```

Do not store complete source trees in the database.

---

## 16. API surface

Initial HTTP endpoints:

```text
POST   /v1/repositories/prepare
POST   /v1/sessions
GET    /v1/sessions/:id
POST   /v1/sessions/:id/start
POST   /v1/sessions/:id/stop
DELETE /v1/sessions/:id
GET    /v1/sessions/:id/diff
POST   /v1/sessions/:id/checkpoints
POST   /v1/layers/:id/accept
POST   /v1/layers/:id/discard
POST   /v1/layers/:id/publish
GET    /v1/flows/:repo/:flowId
PUT    /v1/flows/:repo/:flowId
POST   /v1/intent/analyze
POST   /v1/agents/runs
```

WebSocket:

```text
/v1/events
```

All messages include `protocolVersion`, `requestId` or `eventId`, and the related session where applicable.

---

## 17. Implementation sequence

### Milestone 0 — Contracts and repository boundary

**Goal:** prevent another tightly coupled client-only state expansion.

Tasks:

- create `packages/contracts`,
- define session, event, adapter and layer schemas,
- add protocol versioning,
- wrap current GitHub repository state behind a `RemoteRepositorySource`,
- retain current UI behavior.

Acceptance:

- existing browser still works,
- contracts compile in web and runner stubs,
- no duplicated domain types.

### Milestone 1 — Local runner and one executable web repo

Tasks:

- create `apps/runner`,
- local authentication token generated on first start,
- establish WebSocket connection,
- implement shared bare mirror,
- create ephemeral worktree,
- detect Node web project,
- start dev command,
- proxy preview port,
- stream logs and state.

Acceptance:

- open a public Next.js/Vite repository,
- click `Run locally`,
- see logs and live web preview,
- stop and remove the workspace,
- second session reuses the Git mirror.

### Milestone 2 — Durable checkpoints without full copies

Tasks:

- hidden local Git refs,
- checkpoint creation,
- session restoration,
- state graph UI,
- cleanup and prune,
- disk-usage inspector showing shared versus unique storage.

Acceptance:

- close materialized workspace,
- restore exact state from checkpoint,
- no second full clone remains,
- storage UI proves object reuse.

### Milestone 3 — Change layers and agent-safe review

Tasks:

- layer model,
- diff view,
- accept/discard,
- selective file and hunk application,
- provenance,
- publication to branch/PR.

Acceptance:

- agent or human changes remain isolated,
- accepted layer becomes Git commit,
- discarded layer leaves base state untouched.

### Milestone 4 — Visual Interaction Contract

Tasks:

- add React Flow,
- implement stable flow schema,
- node inspector,
- transition editor,
- JSON import/export,
- schema validation,
- semantic flow diff,
- repository persistence under `.draghub/flows`.

Acceptance:

- user creates a flow with page, overlay, action and decision nodes,
- changing page to overlay produces a semantic diff,
- JSON is independent of canvas internals.

### Milestone 5 — Prompt Intent Preview

Tasks:

- live parser,
- ambiguity and exclusion model,
- editable interpretation chips/rows,
- provisional flow patch,
- model adapter,
- cancellation and debounce.

Acceptance:

- typing an OAuth overlay request reveals whether DRAGHUB inferred page or overlay,
- user correction changes structured context before submission,
- prompt submission includes the corrected intent object.

### Milestone 6 — Agent bridge

Tasks:

- provider-neutral agent interface,
- create proposal layer per run,
- path constraints,
- flow constraints,
- run/build after edits,
- repair child layer,
- final review gate.

Acceptance:

- agent edits cannot mutate accepted state directly,
- invalid route creation is reported against a flow constraint,
- user can accept only selected changes.

### Milestone 7 — Web UI code mapping

Tasks:

- preview instrumentation,
- DOM element to source mapping,
- component index,
- select element in preview,
- show code and related flow node,
- safe visual property changes as layers.

Acceptance:

- click a rendered React element,
- navigate to its source,
- modify supported properties,
- see diff and live update.

### Milestone 8 — Additional runtime adapters

Add Docker/Compose, Python, Gradle/Kotlin and Godot using the same adapter contract. Do not fork the UI per language.

---

## 18. Required first vertical slice

Do not begin by building every panel.

Build this complete story first:

```text
1. User opens owner/repo.
2. DRAGHUB resolves main commit.
3. Local runner creates/reuses one bare Git mirror.
4. Runner creates an ephemeral worktree.
5. Node adapter starts the project.
6. Logs and preview appear in existing workspace.
7. User edits one file.
8. DRAGHUB displays the change as a layer.
9. User creates a local checkpoint.
10. Session closes and materialized workspace is removed.
11. User reopens the checkpoint without a full re-clone.
12. User publishes it as a GitHub branch or commit.
```

Nothing beyond this slice is allowed to force a redesign of the contracts.

---

## 19. Immediate file-level work

Initial additions:

```text
src/features/sessions/
src/features/runtime/
src/features/versions/
src/features/flow/
src/features/intent-preview/
src/lib/runner-client.ts
src/lib/contracts/
runner/src/server.ts
runner/src/git/mirror.ts
runner/src/git/worktree.ts
runner/src/sessions/session-manager.ts
runner/src/adapters/node-web.ts
runner/src/events/event-bus.ts
```

Initial modifications:

```text
src/app/page.tsx
  add session, preview, log and version surfaces without removing explorer/tabs

src/lib/store.tsx
  separate remote repository browsing state from local executable session state

src/lib/staging.tsx
  convert staged changes into the shared ChangeLayer model

src/lib/github-write.ts
  publish accepted layers instead of acting as the primary local state store
```

Do not place runner filesystem/process logic in Next.js client components or API routes intended for remote deployment.

---

## 20. Definition of done for the product foundation

The foundation is complete when all statements below are true:

- A repository can be browsed remotely without running it.
- A repository can be materialized and run locally through the companion runner.
- Multiple sessions reuse one Git object store.
- Closing a normal session does not leave a redundant full clone.
- A checkpoint can restore the exact state without publishing it.
- Every edit belongs to a visible layer.
- Agent changes are isolated until accepted.
- Logs and preview are streamed into one consistent workspace.
- A machine-readable UI flow can declare page, overlay and state-preservation behavior.
- The flow format is independent of the graph library.
- Prompt interpretation can be inspected and corrected before execution.
- Accepted states can be published through normal GitHub commits, branches or pull requests.
- Different runtime languages use adapters rather than separate editor products.

---

## 21. Explicit exclusions

Do not implement the following as foundation shortcuts:

- permanent full clone per session,
- zip-based project snapshots as primary versioning,
- a second proprietary version history unrelated to Git,
- automatic execution when merely opening a foreign repository,
- one UI implementation per programming language,
- React Flow's internal JSON as the stable flow contract,
- unrestricted secret inheritance,
- direct agent writes to the accepted branch,
- forced repository metadata files for local-only provenance,
- a custom dependency manager before native shared stores are used.

---

## 22. Product identity

DRAGHUB is a **Git-native state browser and local execution surface**.

It turns GitHub from a remote file website into a live, incremental construction space:

```text
open state
→ materialize locally
→ run
→ modify as layer
→ inspect behavior
→ validate flow
→ accept or reject
→ publish
```

The interface hides language-specific friction without pretending the underlying runtimes are identical. Git remains the source of version truth; DRAGHUB supplies the missing human and agent control surface.
# Desktop integration handoff

The `src/features/desktop` package is an isolated, adapter-ready UX foundation. Its demo applications deliberately perform no GitHub, filesystem, Theia, or ANVIL-Core calls.

## Runtime adapter

A later integration should implement `DesktopRuntimeAdapter` from `types.ts`. Repository and file resources already carry their explicit `repoKey`; adapters must create a repo-key-specific store/session per window rather than reading a global active repository. The application registry's `render` function is the replacement point for the mock Repository Explorer, editor, viewer, terminal, and GitHub-feature components.

Search should resolve its result to a `WindowResource`, then call `openOrFocusWindow`. This restores a matching minimized window, focuses an existing normal window, or creates one without accidental duplicates.

Theia can later provide editor, terminal, language service, and process adapters. The window manager continues to own only geometry, ownership, grouping, focus, and persistence. Theia state must not be copied into desktop persistence.

ANVIL Core remains an interchangeable Git-native module/backend below DRAGHUB—not the DRAGHUB desktop itself. It can implement repository/file/Git operations behind the same adapter contract while GitHub remains another adapter.

## Ownership

A repository main window owns its child windows through `{ type: "repository", repoKey, repositoryWindowId }`. Real repository state should therefore be keyed by the repository window ID and resource binding. Closing a main window can enumerate its children without knowing anything about the backing service.

## Window lifecycle invariants

Minimizing a window and hiding it during a mobile window switch are presentation-only operations: the application stays mounted and retains local state. Closing is an asynchronous domain transaction; a lifecycle adapter inspects the parent and all children, then resolves blockers before any instance is removed. Discarding retains lightweight recoverable change data in the local Recycle Bin—it never deletes a repository or its desktop shortcut. Confirmed parent closure atomically cleans child, taskbar, rubber-band, mobile-focus, and pending-close references.

The lifecycle adapter—not the window manager—creates recoverable draft or working-change payloads. Recycle Bin restore also calls the adapter before removing an entry; permanent deletion and emptying retention are separate local actions. Settings and Recycle Bin are independent single-instance applications. Icons remain placeholder glyphs until a separate design pass, and all repository/GitHub behavior remains mocked pending real adapter integration.

Persistence schema v5 models minimization independently from normal/maximized presentation. Async close results are transaction-guarded and applied to the latest desktop state. Child-window identity includes its repository-window owner, so two explorer instances never share local child state accidentally. `src/app/page.tsx` only mounts the provider and shell; the Application Registry remains the integration exchange point.

The v4 migration preserves valid recycle payloads, restored-item history, icons, and desktop layout while resetting only transient close state. Both close inspection and resolution register transaction IDs before awaiting adapters; stale, cancelled, failed, or throwing adapter results cannot overwrite a newer dialog or concurrent desktop changes.

Close inspection has explicit `pending`, `ready`, and `failed` states. Pending inspection permits only cancellation; failed inspection permits cancellation or a new transaction-scoped retry. Destructive resolutions are runtime-gated until inspection is ready, and a pending resolution is locked against duplicate submissions.

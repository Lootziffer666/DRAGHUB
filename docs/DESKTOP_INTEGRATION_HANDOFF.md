# Desktop integration handoff

The `src/features/desktop` package is an isolated, adapter-ready UX foundation. Its demo applications deliberately perform no GitHub, filesystem, Theia, or ANVIL-Core calls.

## Runtime adapter

A later integration should implement `DesktopRuntimeAdapter` from `types.ts`. Repository and file resources already carry their explicit `repoKey`; adapters must create a repo-key-specific store/session per window rather than reading a global active repository. The application registry's `render` function is the replacement point for the mock Repository Explorer, editor, viewer, terminal, and GitHub-feature components.

Search should resolve its result to a `WindowResource`, then call `openOrFocusWindow`. This restores a matching minimized window, focuses an existing normal window, or creates one without accidental duplicates.

Theia can later provide editor, terminal, language service, and process adapters. The window manager continues to own only geometry, ownership, grouping, focus, and persistence. Theia state must not be copied into desktop persistence.

ANVIL Core remains an interchangeable Git-native module/backend below DRAGHUB—not the DRAGHUB desktop itself. It can implement repository/file/Git operations behind the same adapter contract while GitHub remains another adapter.

## Ownership

A repository main window owns its child windows through `{ type: "repository", repoKey, repositoryWindowId }`. Real repository state should therefore be keyed by the repository window ID and resource binding. Closing a main window can enumerate its children without knowing anything about the backing service.

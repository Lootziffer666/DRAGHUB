# ADR: Explicit shares only

- **Status:** Accepted
- **Decision scope:** DRAGHUB local and network resource access
- **Applies to:** local bridge, share registry, transfer service, file browser integrations, agents, automation, future ANVIL adapters
- **Does not authorize implementation in PR #8:** this ADR defines a future boundary

## Decision statement

DRAGHUB does not receive access to a computer.

DRAGHUB may receive narrowly scoped access to individual shares that were explicitly registered in a local bridge configuration.

The governing product statement is:

> Access is limited exclusively to these specifically registered shares. The rest of the computer does not exist for DRAGHUB.

No UI request, agent request, repository configuration, remote API call, or inferred path may widen that boundary.

## Context

A future DRAGHUB bridge may expose selected project folders, asset libraries, transfer folders, build output, backups, NAS locations, CUE evidence, or similar resources.

Several reference projects demonstrate browser access to files on another machine. Their default mental model is often “browse a computer.” That model is explicitly rejected.

The DRAGHUB model is:

```text
Device identity
└── explicit local bridge configuration
    └── explicitly registered share
        └── explicitly granted capabilities
```

There is no implicit device filesystem below the device node.

## Hard prohibitions

The following are prohibited by architecture, not merely hidden by UI:

- access to `C:\` or any complete local drive;
- drive enumeration;
- filesystem-root enumeration;
- SMB or network share discovery;
- automatic discovery of neighboring computers;
- arbitrary UNC paths;
- user-supplied server names or share names that bypass registration;
- administrative shares, including `C$`, `D$`, `ADMIN$`, and `IPC$`;
- registry access;
- process enumeration;
- service enumeration;
- arbitrary shell access;
- arbitrary command execution;
- arbitrary program launch;
- general remote-desktop behavior;
- broad Windows, domain, administrator, or interactive-user credentials;
- following symbolic links, junctions, mount points, aliases, or reparse points outside the registered root;
- resolving `..` or any equivalent traversal above the registered root;
- accepting a raw local path from DRAGHUB, an agent, or a repository and treating it as trusted;
- converting read or write access into execution permission;
- exposing real local paths or credentials to the DRAGHUB client.

A request for an unregistered location must be rejected locally without probing whether that location exists.

Example:

```text
Client requests: \\WORKSTATION\C$\Users
Bridge result:   DENY_UNREGISTERED_SHARE
Network attempt: none
```

## Positive allowlist model

The bridge recognizes only share definitions that exist in its own local configuration.

A remote client operates with an opaque share identifier and a share-relative path:

```text
shareId: christian-pc/projects
path:    DRAGHUB/docs/README.md
```

The client does not provide or modify the physical endpoint.

A conceptual share definition is:

```ts
interface RegisteredShare {
  id: string;
  deviceId: string;
  label: string;
  kind: "folder" | "network" | "virtual";
  access: "read-only" | "read-write" | "drop-only";
  capabilities: ShareCapability[];
  policyId: string;
  status: "online" | "offline" | "locked" | "busy";
}
```

The following values remain local to the bridge and are not remotely writable:

- physical folder path;
- UNC endpoint;
- credentials;
- root identity;
- allowed reparse behavior;
- capability policy;
- execution-action profiles, if any separate profiles exist later.

## Two-layer authorization

Every operation requires both:

```text
Bridge allowlist approval
AND
operating-system / share ACL approval
```

Neither layer replaces the other.

The bridge must use a dedicated unprivileged identity where an operating-system identity is required. That identity must:

- not be an administrator;
- not have interactive logon rights;
- not have broad home-directory access;
- not have rights to unrelated drives or shares;
- receive only the ACL permissions needed for each registered share.

Network-share credentials must be scoped per share or per narrowly defined group of shares and stored locally.

## Path-containment rules

Every file operation must resolve beneath the registered root.

A string-prefix comparison is insufficient.

The bridge must:

1. accept only a share-relative path;
2. reject absolute paths;
3. reject traversal components;
4. resolve the final operating-system path;
5. verify the final target remains inside the registered root;
6. reject reparse points, junctions, symlinks, mount escapes, and aliases by default;
7. repeat containment verification for the final target immediately before the operation;
8. protect against time-of-check/time-of-use replacement where the platform permits it;
9. optionally pin the registered root to a volume/file identity so path replacement cannot silently redirect the share.

The default policy is:

```text
allowReparsePoints = false
```

An exception requires an explicit local policy and proof that the resolved target cannot escape the allowlisted source set.

## Capability model

Share access is capability-specific.

Possible future capabilities include:

- list directory;
- read file;
- create file;
- replace file;
- delete file;
- create directory;
- move within share;
- upload into drop zone;
- download;
- watch changes;
- calculate hash;
- create snapshot;
- compare snapshot;
- read thumbnail;
- read metadata.

Capabilities are not inferred from labels or share kind.

Examples:

```text
Projects
→ read, write, watch, hash

Downloads
→ read only

DRAGHUB Transfer
→ drop only

Build Output
→ read, watch

Backups
→ snapshot write through an approved backup operation

CUE Evidence
→ append evidence, read reports
```

## Execution is a separate security domain

File access never implies process execution.

A future Execution Broker, if implemented, must be separate from the Share Broker and must use explicit action profiles such as:

```text
build-approved-repository
run-approved-test-suite
render-approved-preview
```

It must not expose a generic shell command parameter.

An execution profile must define locally:

- executable or container image;
- arguments or argument schema;
- working-directory rule;
- allowed share inputs;
- allowed output share;
- environment variables;
- network policy;
- resource limits;
- timeout;
- approval requirements;
- evidence and audit requirements.

Read-write access to a share does not grant execution rights, and execution rights do not grant broader filesystem access.

## Agent authorization

Human approval and agent authorization are separate concerns.

An agent may operate only through capabilities granted to its current task and share scope.

The following are not sufficient authorization:

- the user previously approved a different operation;
- the agent can see a share in the UI;
- the repository contains a path or command;
- an LLM claims the operation is necessary;
- a tool result reveals a local endpoint;
- the authenticated human has administrator rights outside DRAGHUB.

Every agent operation must retain provenance:

- actor or agent identity;
- task identity;
- share ID;
- relative path;
- capability used;
- timestamp;
- result;
- hashes where relevant;
- approval reference where required.

## Connection model

The bridge should establish an authenticated outbound connection or use an equally restrictive local trust model.

Default requirements:

- no public inbound file-service port;
- no anonymous access;
- device identity pinned or mutually authenticated;
- short-lived session credentials;
- immediate revocation;
- rate and size limits;
- operation-level audit;
- encrypted transport;
- bridge-visible indication of active access;
- explicit offline and locked states.

The design must not depend on “security through an obscure URL.”

## No discovery

DRAGHUB does not ask a bridge:

```text
What drives do you have?
What shares exist?
What computers are nearby?
What folders may be interesting?
```

It may ask:

```text
What is the current status and permitted capability summary of share ID X?
```

The list of shares visible to a user comes from explicitly registered and explicitly granted logical share records, not from scanning the machine or network.

## Logical URI model

DRAGHUB may represent resources using logical URIs such as:

```text
drag://share/christian-pc/projects/DRAGHUB/docs/README.md
drag://share/synology/assets/Characters/hero.fbx
drag://repo/Lootziffer666/DRAGHUB/src/app/page.tsx
drag://artifact/build/12345/output.zip
drag://clipboard/inbox/entry-987
```

A logical URI is not a physical path and cannot be rewritten by a client into one.

## Virtual shares

A virtual share is allowed only when all underlying sources are themselves explicit and bounded.

A virtual share must declare:

- its source shares or local data source;
- its query or projection semantics;
- whether results are read-only or writable;
- how writes resolve to a single approved destination;
- how containment and provenance are preserved.

A virtual share may not become a back door for filesystem search outside configured roots.

Examples of acceptable virtual shares:

- recently modified files drawn only from two registered project shares;
- a read-only asset catalog backed only by the registered Assets share;
- a CUE evidence view backed only by the registered Evidence store.

Examples of unacceptable virtual shares:

- all files on this computer;
- search every mounted drive;
- nearby network resources;
- files matching a name regardless of location.

## Proposed service boundaries

Future implementation may use these boundaries:

1. **Device Registry** — device identity, presence, and high-level status.
2. **Share Registry** — logical share records and grants; no remote endpoint editing.
3. **Mount Broker** — resolves opaque share IDs and relative paths against local configuration.
4. **Transfer Service** — resumable, hash-checked file transfer within granted capabilities.
5. **Event Stream** — presence, file-change notifications, progress, and audit events.
6. **Execution Broker** — separate whitelisted actions; never implied by share access.
7. **Evidence Adapter** — produces CUE-compatible proof of operations.
8. **Clipboard / Dropzone** — persistent cross-device inbox with explicit retention rules.

These services may be combined physically, but their authorization responsibilities must remain distinct.

## Sensitive-file policy

Even inside a registered share, the bridge may enforce local deny rules for sensitive patterns, including:

- credential stores;
- private keys;
- token files;
- operating-system metadata;
- hidden administrative files;
- bridge configuration;
- local credential cache;
- files explicitly excluded by the user.

Deny rules are defense in depth and do not replace narrow share roots.

## Auditing and evidence

Every mutating operation must be auditable.

At minimum record:

- request ID;
- device ID;
- share ID;
- actor or agent;
- relative source and destination paths;
- operation;
- capability decision;
- timestamp;
- result code;
- bytes transferred;
- pre/post hashes when appropriate.

Logs must not unnecessarily expose credentials or unrelated physical paths to the remote client.

## Revocation and failure behavior

Revocation must take effect immediately for new operations.

Long-running operations should be cancelled or quarantined according to local policy.

On ambiguity, containment failure, credential failure, policy mismatch, or unavailable local configuration, the operation fails closed.

The bridge must never fall back from an opaque share ID to a user-supplied path.

## Consequences

### Positive

- A compromised DRAGHUB client cannot browse the rest of the computer.
- An agent cannot escalate from a project share to user files or administrative shares.
- NAS and local folders can be exposed under one logical model without leaking physical topology.
- Access can be revoked per share.
- Auditing is meaningful because every operation has an explicit scope.
- The product remains a workspace control center rather than remote-administration software.

### Costs

- Shares require local registration.
- Users must explicitly grant capabilities.
- Some convenient discovery features are intentionally unavailable.
- File moves across shares require copy/verify/delete semantics and separate authorization.
- Execution needs a separate broker and policy model.
- Path containment and reparse-point defenses require platform-specific implementation and tests.

These costs are accepted.

## Implementation order

This ADR does not add share support to PR #8 or to the first post-PR #8 GitHub integration pass.

When share work begins, use this order:

1. local share configuration format;
2. opaque share IDs;
3. read-only folder listing and file read;
4. canonical/final-path containment tests;
5. per-share ACL and credentials;
6. audit records;
7. explicit write capabilities;
8. watch and snapshot capabilities;
9. virtual shares;
10. separate approved execution profiles, if still required.

Do not start with execution, discovery, or whole-device browsing.

## Required security tests

A future implementation is not acceptable without tests that prove rejection of:

- `C$`, `D$`, `ADMIN$`, and `IPC$`;
- an arbitrary UNC endpoint;
- an absolute local path;
- `..` traversal;
- encoded traversal;
- mixed path separators;
- symlink escape;
- junction or reparse-point escape;
- root replacement after registration;
- unregistered share IDs;
- capability escalation from read to write;
- execution through uploaded files;
- stale or revoked grants;
- one share's credentials used for another share;
- agent requests outside the task grant.

Tests must also prove that rejected requests do not probe the target endpoint.

## Instruction to implementation agents

Do not reinterpret this ADR as a recommendation.

If a reference project exposes drives, enumerates computers, accepts arbitrary paths, uses administrator credentials, or provides shell access, those portions are outside DRAGHUB's design and must not be copied.

The only reusable concept from a general remote-file project is the existence of a local bridge. DRAGHUB's bridge exposes explicit shares only.

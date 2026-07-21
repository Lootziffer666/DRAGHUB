# ANVIL System Graph — DRAGHUB's entry

DRAGHUB is one node in a shared Supabase database — the **ANVIL System
Graph** — that tracks every tool in Christian's toolchain (ANVIL, GAIME,
SHADED, MUSE, GRABBIT, DRAGHUB, …), their repositories, the contracts
between them, accepted architecture decisions, and change history. It is
**not** part of DRAGHUB's runtime; nothing in `src/` talks to it. This
directory exists so DRAGHUB's entry in that graph is maintained the same
way the code is: as versioned, reviewable SQL, not one-off edits made
directly against the database.

- **Project ref:** `ogcnibykutahwgddmbap`
- **Region:** `eu-central-1`
- **DRAGHUB's identity in the graph:** `tools.key = 'draghub'`,
  `repositories.github_full_name = 'Lootziffer666/DRAGHUB'`

## Schema shape (as of 2026-07-21)

| Table | What it holds |
| --- | --- |
| `systems` | The top-level system (`anvil`) everything else hangs off of. |
| `tools` | One row per logical tool — `role_summary` / `owns` / `does_not_own`, architecture-level knowledge. Not repo state. |
| `repositories` | One row per GitHub repo (owned or external reference/dependency). `indexed_commit_sha` / `indexed_at` / `metadata` (`size_kb`, `visibility`, `github_repository_id`, …) are **real facts fetched from the GitHub API**, not conversational knowledge. |
| `tool_repositories` | Which repositories implement which tool. |
| `repository_tool_assignments` | External repos DRAGHUB has evaluated for adoption (`daedalOS`, `mitchIvin-xp`, `thismypc`, …), with `adoption` kind, `status` (`new → analyzed → planned → spike → adopted / rejected`), `take`/`reject`/`next_action`. |
| `contracts` + `contract_participants` | Cross-tool interfaces (producer/consumer/verifier/observer), `status` `intended → implemented → verified`. |
| `decisions` | Accepted architecture decisions (ADR-style), optionally scoped to a repository/tool. |
| `change_sets` + `change_set_items` | One addressable unit of graph change, broken into typed patches (`data_patch`, `contract_patch`, `decision_patch`, `implementation_patch`, `verification_patch`), each declaring `untouched_scope` — what it deliberately did *not* touch. |
| `evidence` | Proof backing a change (`test`, `commit`, `pull_request`, `screenshot`, `schema_validation`, `manual_review`, …), linkable to a change set, contract, tool or repository. |
| `graph_state.graph_version` / `workflow_state.workflow_version` | Auto-incremented by triggers on `tools`, `decisions`, `contracts`, `repository_tool_assignments`, `contract_participants`, `implementation_targets`, `findings`, `tool_repositories` (graph) and on `change_sets`/`change_set_items`/`evidence` (workflow). **Never set these by hand** — every write to a tracked table bumps them automatically. |

`tools.metadata` marks knowledge-only facts with
`"not_repo_state": true` and a `"knowledge_basis"` (e.g.
`"repository_analysis_and_implementation"` when it comes from actually
reading/writing the code this session, `"conversation"` when it doesn't).
`repositories.metadata` is the opposite: only real, indexed facts belong
there.

## How to extend it incrementally

Every DRAGHUB change worth reflecting in the graph — a new architecture
decision, a shipped feature that changes `owns`/`does_not_own`, a newly
adopted or rejected external reference, a merged PR worth citing as
evidence — becomes **one small migration**, not a rewrite of the last one:

1. Add a new file here: `migrations/<UTC timestamp>_<short_description>.sql`
   (see `20260721000000_draghub_architecture_refresh.sql` for the shape).
2. Scope it to exactly what changed. Use `update ... where key = 'draghub'`
   / `where github_full_name = 'Lootziffer666/DRAGHUB'` for the two rows
   that represent DRAGHUB; never touch another tool's row unless the
   change is genuinely cross-tool (and if so, say so explicitly in an
   `untouched_scope` note).
3. Reference existing rows by subquery (`(select id from public.tools
   where key = 'draghub')`), never by a hardcoded UUID — ids are
   regenerated per environment and subqueries keep the migration portable
   and reviewable.
4. Wrap the change in one `change_sets` row (`change_key` = kebab-case +
   UTC date, e.g. `draghub-<topic>-2026-08-01`) with one `change_set_items`
   row per patch, and an `evidence` row citing what actually proves it
   (a merged PR, a passing gate run, a screenshot) — not an unverified
   claim.
5. Apply with `mcp__Supabase__apply_migration` (project id
   `ogcnibykutahwgddmbap`), then copy the exact SQL you ran into the new
   file in this directory and commit it. The committed file is the
   record of what was applied — if the file and the live database ever
   disagree, the database is not source of truth on its own; re-derive
   the discrepancy and add a follow-up migration, don't silently patch
   the database out of band again.
6. Do **not** invent adoption/contract/decision rows for tools other than
   DRAGHUB from inside this repo — those belong to their own tool's
   maintenance process.

`repository_tool_assignments` rows for daedalOS, mitchIvin-xp and
thismypc already exist; update their `status`/`take`/`next_action` as
DRAGHUB's evaluation of them progresses (e.g. when the ZIP viewer,
Repository Gallery or Local Tool Broker ship) instead of creating
duplicate rows.

-- ANVIL System Graph — DRAGHUB architecture refresh (2026-07-21)
-- Project: ogcnibykutahwgddmbap (eu-central-1)
--
-- Brings the `tools` and `repositories` rows for DRAGHUB up to date with
-- what has actually been built (window kernel, RepoScope isolation, the
-- file handler registry / Open With, unified Recycle Bin, authenticated
-- binary adapter, exact close-lifecycle scope), refreshes two
-- repository_tool_assignments to their real adoption status, records two
-- architecture decisions, and logs the whole thing as one change_set with
-- items and evidence. graph_version / workflow_version are bumped
-- automatically by existing triggers — never set them by hand.

-- 1. DRAGHUB tool: replace the thin share-mount-only stub with the real,
--    built architecture. does_not_own keeps its accurate exclusions and
--    gains the two still-unbuilt items (archive handling, native handoff).
update public.tools
set
  role_summary = 'Desktopartige Arbeitsoberfläche für GitHub: Fenster-Kernel mit Anwendungsregistrierung, pro-Fenster isoliertem Repository-Zustand, GitHub-Feature-Fenstern (Pull Requests, Issues, Actions, Triage, Security, Releases, Changes, Settings), CodeMirror-Editor mit Working-Changes-Staging, vereinheitlichtem Papierkorb, registry-basierter Datei-Handler-Zuordnung (Open With) und explizit freigegebenen lokalen Speicherorten.',
  owns = 'Fenster- und Prozess-UX (Kernel, Anwendungsregistrierung, Taskleiste, Dock), pro-Fenster-Repository-Isolation (RepoScope), Repo-Laufwerke und Explorer, Datei-Handler-Registry und Open-With-Zuordnung, Datei-, Bild- und Audio-Viewer, Code-Editor mit Entwurfssitzungen, Working-Changes/Checkpoint-Modell, vereinheitlichter Papierkorb (Kernel- und Domänen-Einträge), authentifizierter Binär-Ressourcenadapter, fensterbezogene Schließ-Lifecycle-Geltungsbereiche, fokussierte Repository-Suche, Toolstarts und explizite Share-Mounts.',
  does_not_own = 'Admin-Shares, Share-Erkennung, freie UNC-Pfade, Laufwerkswurzeln, beliebige lokale Pfade oder sonstigen Zugriff auf den PC; Archiv-Extraktion oder -Ausführung (noch kein Archiv-Viewer); native Programmübergabe (Local Tool Broker noch nicht gebaut).',
  metadata = '{
    "domain": "github-desktop",
    "entity_kind": "product",
    "stack": ["nextjs", "react", "typescript", "tailwindcss", "codemirror6", "bun"],
    "kernel_concepts": ["window-manager", "application-registry", "repo-scope-isolation", "lifecycle-adapter", "file-handler-registry"],
    "application_ids": ["repository-explorer", "image-viewer", "file-editor", "raw-text-viewer", "audio-player", "github-feature", "tool-window", "settings", "recycle-bin"],
    "not_repo_state": true,
    "knowledge_basis": "repository_analysis_and_implementation"
  }'::jsonb
where key = 'draghub';

-- 2. DRAGHUB repository: real indexed facts from the GitHub API (not
--    conversation knowledge), matching the convention used for the other
--    repository rows (size_kb/visibility/github_repository_id).
update public.repositories
set
  default_branch = 'main',
  description = 'Desktopartige GitHub-Oberfläche mit Fenster-Kernel, Datei-Handler-Registry und Working-Changes-Modell.',
  indexed_commit_sha = '3a858f2',
  indexed_at = '2026-07-21T04:18:38Z'::timestamptz,
  metadata = '{
    "size_kb": 629,
    "visibility": "public",
    "language": "TypeScript",
    "github_repository_id": 1295159205
  }'::jsonb
where github_full_name = 'Lootziffer666/DRAGHUB';

-- 3. daedalOS assignment: architecture reference is now actually adopted
--    (window manager, application registry, taskbar, explorer/viewer
--    lifecycle, and now file-type associations are all real).
update public.repository_tool_assignments
set
  status = 'adopted',
  next_action = 'Nächste Kandidaten: ZIP/Archiv-Viewer, volle Tree-View, Repository-Galerie, Local Tool Broker.'
where tool_id = (select id from public.tools where key = 'draghub')
  and repository_id = (select id from public.repositories where github_full_name = 'DustinBrett/daedalOS');

-- 4. mitchIvin-xp portfolio-mode assignment: agreed as the next concrete
--    build (Repository Gallery), so it moves from analyzed to planned.
update public.repository_tool_assignments
set
  status = 'planned',
  next_action = 'Repository-Galerie als eigene Desktop-App spezifizieren (Pinned/Recent/Active/Dirty/Archived, Filter, Karten mit PR-/Changes-Status).'
where tool_id = (select id from public.tools where key = 'draghub')
  and repository_id = (select id from public.repositories where github_full_name = 'mitchivin/mitchIvin-xp');

-- 5. Architecture decisions made during the PR9 fix pass and the file
--    handler registry work.
insert into public.decisions (system_id, decision_key, title, decision, rationale, scope, status, repository_id, tool_id)
values (
  (select id from public.systems where key = 'anvil'),
  'draghub-close-lifecycle-scope',
  'Fenster-Schließ-Geltungsbereich über eine einzige reine Funktion',
  'inspectClose und resolveClose leiten ihren Geltungsbereich (repository/editor/viewer/none) aus derselben reinen deriveCloseScope(target)-Funktion ab, statt eigene Fallunterscheidungen zu pflegen.',
  'Frühere Divergenz zwischen Inspektion und Auflösung führte dazu, dass das Schließen eines einzelnen Editor- oder Viewer-Fensters versehentlich das gesamte Repository betraf (fremde Entwürfe wurden gestaged, ein Editor-Schließen konnte einen vollen Checkpoint auslösen); eine gemeinsame Ableitung macht das strukturell unmöglich.',
  'DRAGHUB Desktop Lifecycle',
  'accepted',
  (select id from public.repositories where github_full_name = 'Lootziffer666/DRAGHUB'),
  (select id from public.tools where key = 'draghub')
)
on conflict (decision_key) do update set
  decision = excluded.decision,
  rationale = excluded.rationale,
  status = excluded.status;

insert into public.decisions (system_id, decision_key, title, decision, rationale, scope, status, repository_id, tool_id)
values (
  (select id from public.systems where key = 'anvil'),
  'draghub-file-handler-registry',
  'Datei-Öffnungsverhalten über eine registrierte Handler-Tabelle statt Extension-Fallunterscheidungen',
  'Was eine Datei öffnen kann, wird über registrierte FileHandlerDefinition-Einträge (Extensions, canHandle, priority) entschieden; Fensterkomponenten fragen die Registry ab, statt eigene if (extension === ...)-Ketten zu pflegen.',
  'Verhindert wachsende, verstreute Sonderfallbehandlung je Dateityp und macht neue Handler (Audio, künftig Archiv, 3D, Shader) zu reinen Registrierungen statt Refactorings der Fensterkomponenten.',
  'DRAGHUB Datei-Öffnen',
  'accepted',
  (select id from public.repositories where github_full_name = 'Lootziffer666/DRAGHUB'),
  (select id from public.tools where key = 'draghub')
)
on conflict (decision_key) do update set
  decision = excluded.decision,
  rationale = excluded.rationale,
  status = excluded.status;

-- 6. Change set recording this migration as one addressable unit.
insert into public.change_sets (system_id, change_key, title, intent, status, expected_graph_version)
values (
  (select id from public.systems where key = 'anvil'),
  'draghub-architecture-refresh-2026-07-21',
  'DRAGHUB-Architekturwissen nach PR #9 und Datei-Handler-Registry aktualisieren',
  'Tool- und Repository-Zeile für DRAGHUB auf den tatsächlich gebauten Stand bringen (Fenster-Kernel, RepoScope, Datei-Handler-Registry/Open With, vereinheitlichter Papierkorb, Close-Scope), daedalOS- und mitchIvin-xp-Zuordnungen aktualisieren, zwei Architekturentscheidungen festhalten und mit PR #18 als Evidence verknüpfen.',
  'closed',
  314
)
on conflict (change_key) do nothing;

insert into public.change_set_items (change_set_id, item_order, item_type, tool_id, repository_id, target_table, target_key, operation, untouched_scope, status)
values
(
  (select id from public.change_sets where change_key = 'draghub-architecture-refresh-2026-07-21'),
  1, 'data_patch',
  (select id from public.tools where key = 'draghub'), null,
  'tools', 'draghub',
  '{"action":"update","fields":["role_summary","owns","does_not_own","metadata"]}'::jsonb,
  'does_not_own bleibt inhaltlich für Admin-Shares/UNC-Pfade/Laufwerkswurzeln unverändert; kein anderes Tool wird angefasst.',
  'closed'
),
(
  (select id from public.change_sets where change_key = 'draghub-architecture-refresh-2026-07-21'),
  2, 'data_patch',
  null, (select id from public.repositories where github_full_name = 'Lootziffer666/DRAGHUB'),
  'repositories', 'Lootziffer666/DRAGHUB',
  '{"action":"update","fields":["default_branch","description","indexed_commit_sha","indexed_at","metadata"],"source":"github_api"}'::jsonb,
  'Keine anderen Repository-Zeilen berührt.',
  'closed'
),
(
  (select id from public.change_sets where change_key = 'draghub-architecture-refresh-2026-07-21'),
  3, 'data_patch',
  (select id from public.tools where key = 'draghub'), (select id from public.repositories where github_full_name = 'DustinBrett/daedalOS'),
  'repository_tool_assignments', 'daedalOS->draghub',
  '{"action":"update","fields":["status","next_action"],"from":"analyzed","to":"adopted"}'::jsonb,
  'thismypc-Zuordnung bleibt analyzed und unverändert.',
  'closed'
),
(
  (select id from public.change_sets where change_key = 'draghub-architecture-refresh-2026-07-21'),
  4, 'data_patch',
  (select id from public.tools where key = 'draghub'), (select id from public.repositories where github_full_name = 'mitchivin/mitchIvin-xp'),
  'repository_tool_assignments', 'mitchIvin-xp->draghub',
  '{"action":"update","fields":["status","next_action"],"from":"analyzed","to":"planned"}'::jsonb,
  'thismypc-Zuordnung bleibt analyzed und unverändert.',
  'closed'
),
(
  (select id from public.change_sets where change_key = 'draghub-architecture-refresh-2026-07-21'),
  5, 'decision_patch',
  (select id from public.tools where key = 'draghub'), (select id from public.repositories where github_full_name = 'Lootziffer666/DRAGHUB'),
  'decisions', 'draghub-close-lifecycle-scope',
  '{"action":"insert"}'::jsonb,
  'Bestehende, nicht verwandte Entscheidungen bleiben unangetastet.',
  'closed'
),
(
  (select id from public.change_sets where change_key = 'draghub-architecture-refresh-2026-07-21'),
  6, 'decision_patch',
  (select id from public.tools where key = 'draghub'), (select id from public.repositories where github_full_name = 'Lootziffer666/DRAGHUB'),
  'decisions', 'draghub-file-handler-registry',
  '{"action":"insert"}'::jsonb,
  'Bestehende, nicht verwandte Entscheidungen bleiben unangetastet.',
  'closed'
),
(
  (select id from public.change_sets where change_key = 'draghub-architecture-refresh-2026-07-21'),
  7, 'verification_patch',
  (select id from public.tools where key = 'draghub'), (select id from public.repositories where github_full_name = 'Lootziffer666/DRAGHUB'),
  'evidence', 'draghub-pr18-merged',
  '{"action":"insert","evidence_type":"pull_request"}'::jsonb,
  'Keine anderen Evidence-Einträge berührt.',
  'closed'
);

-- 7. Evidence: PR #18 actually merged into main, plus the local gate results
--    from this session (bun test, Playwright, typecheck, lint, build).
insert into public.evidence (change_set_id, tool_id, repository_id, evidence_type, title, uri, pull_request_number, commit_sha, result, summary, payload)
values (
  (select id from public.change_sets where change_key = 'draghub-architecture-refresh-2026-07-21'),
  (select id from public.tools where key = 'draghub'),
  (select id from public.repositories where github_full_name = 'Lootziffer666/DRAGHUB'),
  'pull_request',
  'PR #18: Post-PR9-Fixes und Grundlage der Datei-Handler-Registry',
  'https://github.com/Lootziffer666/DRAGHUB/pull/18',
  18,
  '3a858f2',
  'pass',
  '94 bun-Unit-Tests, 6 Playwright-E2E-Tests (neu dauerhaft im Repo eingerichtet), typecheck/lint/build grün. PR #18 (Suche/Bild-Auth/Papierkorb/Store-Isolation/Close-Scope-Fixes) ist in main gemerged. Datei-Handler-Registry, Raw-Text-/Audio-Player-Apps und das Open-With-Menü liegen auf claude/draghub-pr9-clean-fixes-o48rvv, noch ohne eigene PR.',
  '{"checked_at": "2026-07-21", "unit_tests": 94, "e2e_tests": 6, "unmerged_branch": "claude/draghub-pr9-clean-fixes-o48rvv"}'::jsonb
);

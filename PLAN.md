# PLAN.md — GitHub Browser → GitHub OS → ANVIL Core: Ausführungsplan

**Status:** Entwurf, bereit zur Ausführung · **Stand:** 2026-07-14 · **Repo:** `lootziffer666/draghub`

> Auftrag des Maintainers (wörtlich zusammengefasst):
> 1. **Erweiterte Umsetzung des GitHub Browsers** — das ist die unmittelbare Baustelle.
> 2. **Gamification folgt später**, soll aber **von Anfang an mitgedacht** werden — keine Architektur, die eine spätere 3D-/Gamification-Schicht verbaut.
> 3. **Die endgültige Abkapselung von GitHub** (Git-natives Fundament statt GitHub-als-Fundament) **soll ein gesondertes Tool im selben Repo** sein — nicht Teil des GitHub Browsers, nicht in einem neuen Repo.

Dieses Dokument ist für ein ausführendes Modell (Coding-Agent) geschrieben. Es setzt keine Kenntnis des Chatverlaufs voraus, nur den Zustand dieses Repos plus die 11 Markdown-Dateien, die im Root liegen und hier ausgewertet wurden.

---

## 0. Navigation

1. [Quellenlage — was die 11 Dateien beitragen](#1-quellenlage)
2. [Ist-Zustand des Repos](#2-ist-zustand-des-repos)
3. [Drei-Ringe-Architektur](#3-drei-ringe-architektur)
4. [Vokabular- und Mentalmodell-Umstellung (jetzt, billig, zukunftssicher)](#4-vokabular)
5. [Gamification-Readiness — jetzt bauen, später skinnen](#5-gamification-readiness)
6. [Phase 1 — Erweiterte Umsetzung des GitHub Browsers (Milestones M1–M12)](#6-phase-1)
7. [Phase 2 — Gamification-Schicht (Spezifikation only, nicht bauen)](#7-phase-2)
8. [Phase 3 — ANVIL Core: das gesonderte Tool im selben Repo (Spezifikation only, nicht bauen)](#8-phase-3)
9. [Engineering-Konventionen für die Ausführung](#9-konventionen)
10. [Offene Entscheidungen, die der Maintainer treffen muss](#10-offene-entscheidungen)
11. [Risiken](#11-risiken)
12. [Milestone-Checkliste (flach)](#12-checkliste)

---

<a id="1-quellenlage"></a>
## 1. Quellenlage — was die 11 Dateien beitragen

| Datei | Inhalt | Fließt ein in |
|---|---|---|
| `GitHub als Desktop-Betriebssystem (GitHub OS).md` | Vollständigste Fassung: OS-UI-Konzept (Multi-Tab-Explorer, Dock, Systemsteuerung, Startmenü, Triage-App) **plus** Appendix C: 3D-Code-City, gamifizierte PR-„Mobspawns", FPS-Merge-Konflikte, Multiplayer-Sabotage, „Retard-GTA"-Suche | §5 (Seams), §6 (Phase 1), §7 (Phase 2) |
| `… (1).md`, `… (2).md`, `… (3).md` | Drei Vorstufen derselben Idee, ohne die 3D-Gamification-Appendizes; inhaltlich in der Basisdatei enthalten | Nur als Redundanz-Beleg, keine zusätzlichen Anforderungen |
| `markDown1784057455872.md` | „Onlook als Donor" — Diskussion, ob ein Web-Editor (Onlook, Apache-2.0) die Oberfläche für das **große** ANVIL-Multi-Sprachen-Cockpit (Kotlin/Compose, Godot, Unity, Unreal, Python …) werden könnte | **Nicht in diesem Repo-Scope** — betrifft ein Produkt, das über GitHub-Browsing hinausgeht. Nur zur Kenntnis genommen, siehe §8.5 |
| `markDown1784057521042.md` | „Live Contract Preview" — Live-Interpretation von Freitext-Prompts in Entities/Actions/Beziehungen/Unklarheiten, gekoppelt an einen Flow-Editor | Agent-Orchestrierungs-UI für ANVIL, **nicht** für den GitHub Browser. Vermerkt in §8.6 |
| `markDown1784057612909.md` | Objektspeicher-Architektur: kein Voll-Klon pro Session, sondern gemeinsamer Git-Objektspeicher + Copy-on-Write-Worktrees + Content-Addressing über Repos hinweg | Kern von Phase 3 (§8.2) |
| `markDown1784057646044.md` | Zustand = Basis-Commit + Schichten von Deltas; Git-Vokabular → menschliches Vokabular; Agentenläufe als Schichten statt direkter Mutation | §4 (jetzt übernehmen!) und §8.2 |
| `markDown1784057788316.md` | Kernentscheidung: **nicht** GitHub als Plattform ersetzen, sondern GitHub als *Fundament* der eigenen Arbeit ersetzen. Git ist das Fundament, GitHub wird optionaler Adapter. GitHub-Features (PRs, Issues, Actions, Projects, Codespaces, Releases) werden auf generische Primitive zurückgeführt | Leitprinzip von Phase 3 (§8) |
| `markDown1784057824226.md` | Drei Speicherklassen (Git-nativ / Object Vault / Artifact Store) statt Git-LFS-Notlösung; Chunk-Upload mit Resume; GitHub bleibt als Publish-Adapter kompatibel | §8.3 |
| `markDown1784057899746.md` | Mobile/Rechner/NAS-Architektur: Handy = Auftrag & Entscheidung, Rechner = Sandbox & Ausführung, NAS = Replikat; Command Queue + Persistence Queue; CUE als unveränderliches Evidence-Ledger; atomare NAS-Schreibreihenfolge | §8.4 |

**Konsolidierungsempfehlung:** Sobald dieser Plan committed ist, können `GitHub als Desktop-Betriebssystem (GitHub OS) (1/2/3).md` gelöscht werden (Inhalt ist Teilmenge der Basisdatei) — das ist aber eine Aufräumaktion, keine Voraussetzung. Ich habe sie unangetastet gelassen; der Maintainer entscheidet.

---

<a id="2-ist-zustand-des-repos"></a>
## 2. Ist-Zustand des Repos

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 · Bun · keine Test-Infrastruktur · keine Backend-/API-Routes (`src/app/api/*` existiert nicht) · 100 % Client-Side-SPA, die direkt gegen `api.github.com` spricht.

**Package-Manager-Regeln (aus `.kilocode/rules/development.md`, gilt weiter):**
- `bun`, nicht npm/yarn.
- **Niemals** `bun dev`/`next dev` selbst starten — die Sandbox macht das automatisch.
- Vor jedem Commit: `bun typecheck && bun lint` grün halten (Produktionsbuild `bun build` vor größeren Merges).

**Dateikarte (aktuell):**

| Datei | Zweck | Erweiterungspunkt für diesen Plan |
|---|---|---|
| `src/app/page.tsx` | App-Shell: `Home` vs. `Workspace`, Title-/Status-Bar, montiert alle Provider | Dock/Control-Panel/Start-Menu docken hier an |
| `src/lib/store.tsx` | Globaler State: Reducer + async Loader für **ein** offenes Repo (`state.meta: RepoMeta \| null`) | **M8**: Umbau auf Multi-Repo |
| `src/lib/github.ts` | Read-only REST-Client (Contents, Repo-Meta, Branches), PAT-Token-Verwaltung in `localStorage` | Basis für alle neuen Read-Endpunkte (PRs, Issues, Alerts …) |
| `src/lib/github-write.ts` | Commit-Engine: Blob/Tree/Commit/Ref auf niedriger Ebene, Auto-Split großer Changesets, Git-LFS-Upload | **M1** generalisiert dies (Einzel-Datei-Commits, beliebige Refs, LFS-Download) |
| `src/lib/staging.tsx` + `staging-db.ts` | IndexedDB-Cache für gestagte Uploads bis zum erfolgreichen Commit | **M2** hebt dies zum allgemeinen „Changeset"-Modell |
| `src/lib/extract.ts` | zip (JSZip) / 7z / rar (libarchive.js/WASM) Extraktion im Browser | unverändert wiederverwendbar |
| `src/lib/dnd.ts` | Gemeinsamer Drag-MIME-Typ `application/x-gh-node` für interne DnD-Payloads | **M1** erweitert Payload um „move" |
| `src/lib/highlight.tsx` | Abhängigkeitsfreier Tokenizer für Code-Ansicht | bleibt für Read-Modus, **M3** ergänzt Edit-Modus separat |
| `src/components/{Explorer,FileView,Tabs,AddressBar,ContextMenu,ui-context,UploadPanel,icons}.tsx` | Desktop-UX: Tabs, Baum, Kontextmenü, Multi-Select, Touch-Long-Press | Basis für M1–M6 |
| `src/features/search/` | **Referenzimplementierung des Modul-Musters**: `github-search.ts` (API) + `SearchPanel.tsx` (UI) + `index.tsx` (`Provider`/`useX`/`XButton`), kommuniziert nur über bestehende Store-Callbacks | Vorlage für M7, M10, M11, M12 |

**Modul-Konvention (bestätigt, weiter gültig):** Neue Fähigkeiten leben unter `src/features/<name>/` als in sich geschlossene Module mit eigener API-Datei, UI und `index.tsx`, die `Provider` + `useX`-Hook + `XButton`-Trigger exportiert. Sie kommunizieren nur über bestehende Store-Callbacks. **Ausnahme:** M1 (Explorer-CRUD) und M8 (Multi-Repo) verändern zwangsläufig Kernstate (`store.tsx`, `Explorer.tsx`), weil es dafür keinen isolierten Modul-Zuschnitt gibt — das ist hier ausdrücklich vorgesehen, nicht ein Bruch der Konvention.

**Bekannte strukturelle Lücken, die dieser Plan schließt:**
1. **Keine Schreiboperationen im Explorer** außer dem Bulk-Upload-Panel (kein Neu/Umbenennen/Löschen/Verschieben einzelner Einträge).
2. **Kein In-Browser-Editor** — `FileView` zeigt Code nur lesend an.
3. **Nur ein Repo gleichzeitig offen** (`state.meta` ist singulär) — verhindert Dock/Workspaces.
4. **Keine PR-/Issue-Daten überhaupt** — die App kennt aktuell nur Dateibaum + Inhalte.
5. **Kein Backend** — „echtes" Server-Sent-Events-Live-Update (wie in den Quelldokumenten postuliert) ist ohne eigenen Server/Webhook-Empfänger nicht möglich; GitHub bietet dafür keine Public-SSE-Schnittstelle. Polling ist der realistische Ersatz (siehe M9, §10).
6. **Keine LFS-Erkennung beim Lesen** — Schreiben unterstützt LFS bereits (`github-write.ts`), Lesen/Anzeigen noch nicht.

---

<a id="3-drei-ringe-architektur"></a>
## 3. Drei-Ringe-Architektur

```
┌───────────────────────────────────────────────────────────────────┐
│  Ring C — ANVIL Core (Phase 3, gesondertes Tool, SPÄTER)          │
│  Git-natives Fundament · Object Vault · Layered-State-Engine      │
│  · CUE-Ledger · Command/Persistence-Queues · Adapter (GitHub u.a.)│
│  läuft als lokaler Dienst, NICHT im Browser                       │
└───────────────────────────────────────────┬─────────────────────-┘
                                              │ optionaler Adapter
┌─────────────────────────────────────────────────────────────────┐
│  Ring B — Gamification-Skin (Phase 2, SPÄTER, nur Spezifikation) │
│  3D Code-City · Mobspawns · FPS-Konfliktauflösung · Multiplayer  │
│  rendert dieselben Daten wie Ring A, andere Präsentation         │
└─────────────────────────────────────────────┬───────────────────┘
                                                │ konsumiert dieselbe
                                                │ State-/Event-API
┌───────────────────────────────────────────────────────────────────┐
│  Ring A — GitHub Browser, erweitert (Phase 1, JETZT)              │
│  Next.js/React/Tailwind · spricht heute direkt mit api.github.com │
│  · später wahlweise mit Ring C statt direkt mit GitHub             │
└─────────────────────────────────────────────────────────────────┘
```

**Warum diese Reihenfolge zwingend ist:** Ring B (Gamification) braucht Datenmodelle, die in Ring A ohnehin sinnvoll sind (Aktivität/Verfall pro Datei, PR-Klassifikation, Konflikt-Hunks, Layout-Koordinaten) — nur eben zunächst als schlichte UI statt 3D-Szene. Ring C (ANVIL Core) braucht ein sauber gekapseltes Git-Schreib-/Lese-Interface — das entsteht in Ring A ohnehin, wenn `github.ts`/`github-write.ts` diszipliniert bleiben. **Deshalb baut Phase 1 keine Sackgassen, sondern legt in beide Richtungen Fundamente**, ohne dass Phase 2/3-Code jetzt geschrieben wird.

---

<a id="4-vokabular"></a>
## 4. Vokabular- und Mentalmodell-Umstellung (jetzt, billig, zukunftssicher)

Kernidee aus `markDown1784057646044.md`: Git speichert ohnehin keine „Version 1/2/3"-Kopien, sondern unveränderliche Objekte, aus denen Zustände zusammengesetzt werden. Der GitHub Browser sollte dieses Prinzip **jetzt schon sichtbar machen** — das kostet keine neue Infrastruktur (Git kann das bereits), verbessert aber sofort die UX und ist exakt das Vokabular, das Phase 3 formalisiert.

| Git/GitHub-Begriff | UI-Begriff im GitHub Browser | Wo umgesetzt |
|---|---|---|
| Commit | **Checkpoint** | M2 |
| Branch | **Variante** / Arbeitsraum | M8 (Workspaces) |
| Tag | benannte stabile Version | M11 (Releases) |
| Diff | Änderungsschicht | M2, M6 |
| Merge | Varianten zusammenführen | M6 |
| Revert | Zustand zurückholen | M2 |
| Worktree | parallel geöffnete Variante | M8 |
| Blob | unveränderliches Inhaltsobjekt | intern, keine UI-Änderung nötig |

**Konkrete Konsequenz für Phase 1:** Jede lokale Änderung (neue Datei, Edit, Löschung, Umbenennung — egal ob manuell oder per Upload) wird als **Delta-Eintrag in einem Changeset** dargestellt, nicht als sofortige Aktion. Der Nutzer sieht „aktueller Zustand = Basis-Commit + N ungesicherte Deltas" und drückt **„Checkpoint erstellen"** statt implizit zu committen. Das ist die Grundlage von M2 und ersetzt/erweitert das bisherige `StagingProvider`-Modell (aktuell nur für Bulk-Uploads gedacht).

---

<a id="5-gamification-readiness"></a>
## 5. Gamification-Readiness — jetzt bauen, später skinnen

**Harte Regel für Phase 1:** Kein Three.js, kein WebGL/WebGPU, keine Spiel-Loop, keine 3D-Assets. Nur Daten-/State-Entscheidungen, die eine spätere Präsentationsschicht nicht verbauen.

| Seam | Was jetzt gebaut wird (Phase 1, plain UI) | Was später draufsetzt (Phase 2) | Milestone |
|---|---|---|---|
| **Vitalität/Status pro Datei** | `vitality.ts`: Aktivitäts-Score aus Commit-Historie (`GET /commits?path=…`), lazy/gecacht, angezeigt als „zuletzt geändert vor X Tagen"-Badge bzw. „stale"-Marker | Score bestimmt Baumaterial-Stufe (Lehm→Ziegel→Beton→Stahl→Gold→Obsidian) bzw. Verfallsgrad (Moos/Risse/Ruine) eines 3D-Gebäudes | M4 |
| **Räumliches Layout** | `layout.ts` + IndexedDB: Icon-Grid-Ansicht mit Snap-to-Grid, Koordinaten pro (Repo, Branch, Pfad); optional Team-Sync über einen dedizierten Git-Ref (`refs/notes/…`-Äquivalent) | Dieselben (x, y)-Koordinaten werden zu (x, y, z) einer Code-City | M5 |
| **PR-/Issue-Klassifikation** | `classifyPr()` → `"clean" \| "conflict" \| "failing" \| "needs-review" \| "spam-suspect"`, als Badge/Filter in einer Liste | Klassen bestimmen Mobspawn-Typ (Green Knight / Conflict Creep / Spam Goblin) | M7 |
| **Konfliktauflösungs-Engine** | `merge.ts`: Hunk-Parser + Ours/Theirs/Both pro Hunk, Side-by-Side-UI | Dieselbe Hunk-Liste treibt den FPS-Zielscheiben-Modus | M6 |
| **Domain-Event-Bus** | `events.ts`: einfaches Pub/Sub (`repo.opened`, `checkpoint.created`, `conflict.detected`, `pr.merged`, `upload.completed`, …), Phase-1-Abnehmer: Toasts/Status-Bar | Phase-2-Abnehmer: Partikeleffekte/Sound/Animation; Phase-3-Abnehmer: CUE-Ledger | durchgängig, siehe M2 |
| **View-Mode-Registry** | `viewMode: "list" \| "grid"` im Store; UI-Picker so gebaut, dass ein dritter Wert additiv ist | `viewMode: "city"` registriert später einen Three.js-Renderer, ohne Store/Logik anzufassen | M5 |

Jeder dieser sechs Punkte ist **für Phase 1 selbst bereits ein sinnvolles Feature** (bessere UX heute) — die Gamification-Tauglichkeit ist ein Nebenprodukt sauberer Datenmodellierung, kein Extra-Aufwand.

---

<a id="6-phase-1"></a>
## 6. Phase 1 — Erweiterte Umsetzung des GitHub Browsers

Zwölf Milestones, abhängigkeitskorrekt geordnet, jeder für sich shippable (`bun typecheck && bun lint` grün, manuelles QA im Browser gemäß Definition-of-Done). Jeder Milestone folgt — soweit möglich — der Modul-Konvention (`src/features/<name>/`).

### M1 — Explorer-Schreiboperationen (CRUD)
**Warum zuerst:** größte funktionale Lücke; alles Weitere (Editor, Checkpoints, Konfliktauflösung) baut auf demselben Schreib-Primitiv auf.

- Neue Datei, neuer Ordner (mit automatisch verstecktem `.gitkeep`), Umbenennen, Löschen, Verschieben (Drag auf Ordner-Ziel).
- Neue Datei `src/lib/github-ops.ts`: generalisiert `github-write.ts` von „Batch-Upload" zu „einzelne, gezielte Tree-Mutation" (ein Blob/Tree/Commit-Zyklus pro logischer Operation, aber gebündelt mit dem Changeset aus M2 statt sofort zu committen).
- `ContextMenu`/`Explorer` bekommen die neuen Aktionen; `dnd.ts`-Payload (`GhNodeDrag`) bekommt ein `move`-Flag.
- **Akzeptanzkriterium:** Ordner ohne Dateien bleibt nach Anlegen sichtbar (verdecktes `.gitkeep`); Löschen des letzten sichtbaren Eintrags entfernt den Ordner nur, wenn der Nutzer das explizit bestätigt (nicht automatisch, wie im Ursprungskonzept beschrieben).

### M2 — Working-Changes-/Checkpoint-Panel
**Baut auf M1.** Löst das bisherige `StagingProvider` ab bzw. erweitert es zu einem generischen Changeset, das *jede* Änderungsquelle aufnimmt (manueller Edit, Upload, spätere Agenten-Läufe).

- Seitenpanel „Änderungen": Liste aller ungesicherten Deltas mit Pfad, Art (neu/geändert/gelöscht/verschoben), Herkunft (manuell/Upload).
- Aktionen: einzelnes Delta verwerfen, alle verwerfen, **Checkpoint erstellen** (= Commit über `github-ops.ts`), einfache pfadbasierte Vergleichsansicht „vs. `main`".
- UI-Copy konsequent nach §4-Vokabular (Checkpoint statt Commit, Variante statt Branch, wo es die Nutzer nicht verwirrt — Git-Begriffe dürfen als Tooltip/Fachbegriff daneben stehen).
- `events.ts` wird hier eingeführt (Seam aus §5) und feuert u. a. `checkpoint.created`.
- **Akzeptanzkriterium:** `UploadPanel` nutzt intern denselben Changeset-Mechanismus wie manuelle Edits — keine zwei parallelen Commit-Pfade mehr.

### M3 — In-Browser-Code-Editing
- `FileView` bekommt einen Edit-Modus. Editor-Wahl: **CodeMirror 6** empfohlen (modular, kein Webworker-Ärger in Next.js im Gegensatz zu Monaco) — siehe [§10](#10-offene-entscheidungen), Bestätigung durch Maintainer ausstehend.
- Speichern erzeugt ein Delta in M2, **kein** Sofort-Commit.
- **Akzeptanzkriterium:** Editieren einer Datei aus einem historischen Ref (nicht dem aktuellen Branch-HEAD) bietet „neue Variante abzweigen" statt einer blockierenden Fehlermeldung (schließt die im GitHub-OS-Dokument beschriebene Web-UI-Schwäche).

### M4 — LFS- und Großdatei-Bewusstsein beim Lesen
- `src/lib/lfs.ts`: Pointer-Erkennung (`version https://git-lfs.github.com/spec/v1` als Dateiinhalt-Präfix), Cloud-Badge in Explorer/FileView, On-Demand-Download über den bestehenden LFS-Batch-Endpunkt (Download-Gegenstück zu `uploadLfsObject` in `github-write.ts`).
- Vitalitäts-Badges (`vitality.ts`, Seam aus §5) ebenfalls hier, da beide „read-path Metadaten-Anreicherung" sind.
- **Akzeptanzkriterium:** Große Binärdatei wird nicht ungefragt vollständig geladen; Doppelklick löst gezielten Download aus, mit Fortschrittsanzeige.

### M5 — Räumliches Layout / Grid-View
- `viewMode`-Umschalter in `FileView`: „Liste" (bestehend) / „Raster" (neu). Dritter Wert `"city"` bleibt für Phase 2 reserviert, aber im Type schon vorgesehen (nicht aktivierbar).
- `src/lib/layout.ts`: Snap-to-Grid-Mathematik, Persistenz in IndexedDB, Schlüssel `(repoKey, branch, path)`.
- Optional „Layout mit Team teilen": Serialisierung als JSON-Blob, Commit auf einen dedizierten Ref (z. B. `refs/notes/github-browser-layout`) über eine generalisierte Version von `updateRef`/`createRef` aus `github-write.ts` (aktuell hart auf `refs/heads/*` beschränkt — muss auf beliebige Ref-Namespaces erweitert werden, GitHubs Git-Data-API ist dafür bereits generisch genug).
- **Akzeptanzkriterium:** Positionen überleben Reload; Team-Sync ist opt-in und bricht bestehende Nutzer ohne Layout-Historie nicht.

### M6 — Merge-Konfliktauflösung
- Konflikterkennung (Compare-API bzw. 3-Wege-Merge zweier geladener Blobs), Hunk-Parser, Ours/Theirs/Both pro Hunk, Side-by-Side-UI (Bezeichner **nicht** „Green Knight"/„Shooter" — das ist Phase-2-Skin).
- `src/lib/merge.ts`.
- **Akzeptanzkriterium:** Ergebnis wird als reguläres Delta ins Changeset (M2) gelegt, kein Sonderpfad.

### M7 — Pull-Requests- & Issues-Modul (neue Datendomäne)
- `src/features/pulls/` und `src/features/issues/` nach Modul-Konvention: eigenes `api.ts`, `Panel.tsx`, `index.tsx` (`Provider`/`usePulls`/`PullsButton`).
- Daten: Liste, Status-Checks, `mergeable`-Status, Labels, Review-Status.
- `classify.ts`: `classifyPr(pr): "clean" | "conflict" | "failing" | "needs-review" | "spam-suspect"` — Heuristik für „spam-suspect" bewusst einfach (z. B. Diff-Größe vs. Beschreibungslänge, Account-Alter), **explizit v1 ohne ML**.
- Aktionen: merge, close, Reviewer anfragen, labeln — abhängig vom Token-Scope (siehe [§9](#9-konventionen) Scope-Tabelle).
- **Akzeptanzkriterium:** Darstellung ist Liste/Badge, keine Spawn-Animation — reine Datenbasis für M12 und für Phase 2.

### M8 — Multi-Repo-„Workspaces"-Refactor
**Voraussetzung für M9–M11.** Größter Kernstate-Eingriff des gesamten Plans, deshalb bewusst spät und isoliert platziert.

```ts
// src/lib/store.tsx — Zielzustand
type RepoState = {
  meta: RepoMeta;
  tabs: Tab[];
  activeTabId: string | null;
  treeCache: Record<string, GithubEntry[]>;
  treeState: Record<string, "loading" | "loaded" | "error">;
  expanded: Record<string, boolean>;
  selection: string[];
};

type State = {
  repos: Record<string, RepoState>;   // key = "owner/repo"
  activeRepoKey: string | null;
  pinnedRepoKeys: string[];           // Dock
  recent: string[];
  repoError: string | null;
  repoLoading: boolean;
};
```

- Alle Konsumenten (`Explorer`, `Tabs`, `FileView`, `AddressBar`, `StatusBar`, `TitleBar`, `staging.tsx`) werden auf einen `useActiveRepo()`-Selektor umgestellt, der `state.repos[state.activeRepoKey]` liefert — minimiert Änderungen an den Komponenten selbst.
- **Akzeptanzkriterium:** Bestehende Single-Repo-Workflows verhalten sich identisch; zusätzlich lässt sich ein zweites Repo öffnen, ohne das erste zu schließen.

### M9 — Dock
- Persistente Leiste über/neben der Tab-Bar: gepinnte Repos, Schnellwechsel, aggregierte PR-/CI-Badges (Zahl offener/fehlgeschlagener PRs) über alle gepinnten Repos hinweg, gespeist aus M7.
- **Polling statt SSE** (siehe [§10](#10-offene-entscheidungen)): konfigurierbares Intervall, Backoff bei Rate-Limit-Nähe, Pause bei `document.hidden` (Page Visibility API).
- **Akzeptanzkriterium:** Rate-Limit-Budget wird sichtbar gemacht (verbleibende Requests/Reset-Zeit aus den Response-Headern, die `github.ts` bereits ausliest), damit Polling nicht blind ins Limit läuft.

### M10 — Systemsteuerung (Control Panel)
Drei Applets, je eigenes Feature-Modul:
- `src/features/control-panel/security/` — Dependabot-Alerts (`/dependabot/alerts`), CodeQL (`/code-scanning/alerts`), Secret-Scanning (`/secret-scanning/alerts`) als Ein/Aus- bzw. Listen-Ansicht.
- `src/features/control-panel/access/` — Mitarbeiter/Teams, CODEOWNERS-Generator (reiner Datei-Write über M1-Primitive, keine Spezial-API).
- `src/features/control-panel/branch-rules/` — Branch Protection (`/branches/{branch}/protection`) bzw. Rulesets (`/rulesets`).
- **Akzeptanzkriterium:** Fehlt dem Token der nötige Scope, wird das Applet sichtbar (nicht versteckt) mit klarer Fehlermeldung deaktiviert — kein stiller Ausfall. Scope wird per Test-Request erkannt, nicht durch Parsen des Tokens (PATs sind nicht selbst-beschreibend).

### M11 — Startmenü
- Codespaces-Launcher: Deep-Link + Anlegen über die API — **kein** eingebetteter VM-Client (Plattformgrenze, siehe [§11](#11-risiken)).
- Release- & Paket-Zentrale: Standard-REST (`/releases`, Packages-API), unkritisch.
- Wiki-Editor: **erst als Spike**, nicht direkt als Feature einplanen. GitHub-Wikis sind ein separates Git-Repo (`owner/repo.wiki.git`) **ohne** Anbindung an die normale Contents-API — ein reiner Browser-Client kann das nicht ohne Weiteres klonen. Ergebnis des Spikes entscheidet, ob WYSIWYG machbar ist oder nur ein Hinweis-Stub sinnvoll ist.
- **Akzeptanzkriterium:** Wiki-Spike liefert eine schriftliche Machbarkeits-Notiz, bevor UI-Arbeit daran beginnt.

### M12 — Triage-App
- Baut direkt auf M7s `classify.ts`. Bulk-Auswahl + Bulk-Aktion (schließen + Branch löschen, labeln, Review anfragen), tastaturzentriert.
- **Akzeptanzkriterium:** Jede Bulk-Aktion zeigt vor Ausführung eine Zusammenfassung („12 PRs werden geschlossen, 12 Branches gelöscht") — irreversible Aktionen brauchen explizite Bestätigung.

---

<a id="7-phase-2"></a>
## 7. Phase 2 — Gamification-Schicht (Spezifikation only — **nicht bauen, bis explizit angefordert**)

> ⚠️ Dieser Abschnitt ist Dokumentation für später, kein Auftrag. Erst starten, wenn der Maintainer das ausdrücklich freigibt.

| Seam aus Phase 1 | Gamifizierter Skin |
|---|---|
| `vitality.ts` + `layout.ts` (M4, M5) | 3D-Code-City (Three.js, WebGL2/WebGPU-Backend): Gebäudehöhe = LOC, Grundfläche = Komplexität, Material-Stufen (Lehm→…→Obsidian) aus Vitalitäts-Score, Verfall (Moos/Risse/Ruine) aus Inaktivität. `viewMode: "city"` registriert den Renderer additiv |
| `classify.ts` (M7) | PR-„Mobspawns": Green Knight (`clean`) / Conflict Creep (`conflict`) / Spam Goblin (`spam-suspect`) am virtuellen Stadttor |
| `merge.ts` (M6) | FPS-Zielscheiben-Modus: dieselbe Hunk-Liste, „Ours"/„Theirs" als grünes/oranges Hologramm |
| Domain-Event-Bus (M2) | Partikeleffekte, Sound, Screen-Shake bei `pr.merged`, `conflict.detected` etc. |
| — (neu, braucht Backend) | Multiplayer-Sabotage (WebSockets) — abhängig von einer noch nicht existierenden Server-Komponente, siehe [§10](#10-offene-entscheidungen) |
| `src/features/search/` (bestehend) | „GTA-Suchautobahn": Suchergebnisse als prozedural gerenderte Straße statt Liste |

**Technische Notizen aus den Quelldokumenten (aufbewahrt, nicht bewertet):** Three.js mit WebGL2/WebGPU; optional native Shell via Tauri (Rust) oder Electron für Dateisystemzugriff jenseits der Browser-Sandbox; alternativ Browser-Extension mit Page-Hijack von github.com (`document_start`, `drawElement()`-Rasterisierung) plus Native-Messaging-Companion-App. Diese Entscheidung wird erst getroffen, wenn Phase 2 ansteht.

---

<a id="8-phase-3"></a>
## 8. Phase 3 — ANVIL Core: das gesonderte Tool im selben Repo (Spezifikation only — **nicht bauen, bis explizit angefordert**)

> ⚠️ Auch dieser Abschnitt ist Dokumentation, kein Auftrag. Phase 1 ist so geschnitten, dass diese Extraktion später ohne Rewrite von Ring A möglich ist.

### 8.1 Scope-Abgrenzung
Dies ist **die GitHub-/Git-Entkopplungs-Schicht**, die die Quelldokumente „ANVIL" nennen — **nicht** das dort ebenfalls skizzierte große Multi-Sprachen-Cockpit (Kotlin/Compose, Godot, Unity, Python-Desktop-UIs, Onlook-Integration). Jener Teil (§1-Tabelle, Zeile „Onlook als Donor") gehört zu einem anderen Produkt und ist hier bewusst ausgeklammert. Phase 3 baut genau das, was der GitHub Browser braucht, um GitHub optional statt zwingend zu machen.

### 8.2 Kernprinzip
> „GitHub enthält nicht Version 1/2/3 als Kopien. Git speichert unveränderliche Objekte und setzt daraus Zustände zusammen." — Git ist das Fundament, GitHub ist ein optionaler Adapter, kein Unterbau.

```
Bisher:   Desktop-UX → GitHub → Git
Richtig:  Desktop-UX → menschliches Zustandsmodell → Git
                                        └──→ GitHub-Adapter (optional)
```

### 8.3 Komponenten (Zuordnung zu den Quelldokumenten aus §1)

| Komponente | Aufgabe | Quelle |
|---|---|---|
| **Git Object Store** | gemeinsamer Objektspeicher statt Voll-Klone; Sessions als Copy-on-Write-Worktrees | `markDown…612909.md` |
| **Object Vault** | Content-addressed Speicher für große Binärdateien, Chunk-Deduplizierung, repo-übergreifend | `markDown…824226.md` |
| **Artifact Store** | Build-Ergebnisse (APKs, EXEs, Exporte) — an Commit+Run gebunden, nicht Teil der Projekthistorie | `markDown…824226.md` |
| **Layered-State-Engine** | Zustand = Basis-Commit + Manifest von Patch-Schichten; Agentenläufe/Edits als Schichten, die akzeptiert oder verworfen werden | `markDown…646044.md` |
| **CUE Evidence Ledger** | unveränderliches, strukturiertes Ereignisprotokoll (`state.accepted`, `replication.queued`, `replication.verified`, …) | `markDown…899746.md` |
| **Command Queue** | sequentielle Auftragsverarbeitung pro Repo (z. B. vom Handy/Client kommend) | `markDown…899746.md` |
| **Persistence Queue** | Niedrigprioritäts-Replikation bestätigter Zustände zu einem Archiv/NAS, resumable, atomare Schreibreihenfolge (erst Objekte, dann Ref-Update) | `markDown…899746.md` |
| **Adapter-Schicht** | GitHub (Wrapper um heutiges `github.ts`/`github-write.ts`), lokales Homelab, weitere Git-Remotes — austauschbar, GitHub ist einer von mehreren | `markDown…788316.md` |

### 8.4 Vorgeschlagene Repo-Struktur (Bun-Workspaces)

```
/
├── apps/
│   └── github-browser/     # heutiges Next.js-App, unverändert verschoben
├── tools/
│   └── anvil-core/         # NEU, Phase 3: lokaler Dienst (Bun/TS), eigenes package.json
├── packages/
│   └── shared/             # optional: geteilte Typen (GithubEntry, Vokabular-Mapping)
└── package.json             # Workspace-Root: "workspaces": ["apps/*", "tools/*", "packages/*"]
```

`anvil-core` ist zwingend ein **lokaler Dienst/Daemon**, kein Next.js-Page — Objektspeicher, Dateisystemzugriff und Chunk-Verwaltung sind aus der Browser-Sandbox heraus nicht möglich. Der GitHub Browser bekommt danach einen Einstellungs-Schalter: „Direkt mit GitHub sprechen" (heutiger Modus, bleibt für immer funktionsfähig) vs. „Über lokalen ANVIL Core" (neuer Adapter-Modus) — bestehende Nutzer werden nicht gebrochen.

### 8.5 Bewusst ausgeklammert
Onlook-Integration, Multi-Sprachen-Workbench (Kotlin/Compose, Godot, Unity, Unreal, Python/Rust-Desktop-UIs), Provenienz-/Modulvertrags-System für Fremdsprachen — das ist Teil des größeren ANVIL-Produkts, nicht dieses Repos.

### 8.6 Vermerkt, aber nicht eingeplant
„Live Contract Preview" (Live-Interpretation von Freitext-Prompts → Entities/Actions/Flow-Diagramm) ist eine Agent-Orchestrierungs-UI für ANVIL Core, sobald dort Agentenläufe ankommen. Gehört konzeptionell zu `tools/anvil-core`, nicht zum GitHub Browser, der aktuell keinerlei Agenten-/Prompt-Funktion hat.

---

<a id="9-konventionen"></a>
## 9. Engineering-Konventionen für die Ausführung

- Modul-Muster (`src/features/<name>/`) für jede isolierbare Fähigkeit einhalten (siehe §2-Tabelle für die Ausnahmen M1/M8).
- Neue Abhängigkeiten sparsam, aber pragmatisch (wie schon bei `jszip`/`libarchive.js` geschehen): CodeMirror für M3 ist gerechtfertigt, State-Management-Libraries (Zustand o. ä.) weiterhin vermeiden — Reducer-Pattern beibehalten.
- `bun typecheck && bun lint` vor jedem Commit; `bun build` vor größeren Merges. Niemals selbst `bun dev` starten.
- Fehlerbehandlung konsistent mit `ghFetch` in `github.ts` (Rate-Limit-Erkennung über `x-ratelimit-remaining`/`-reset`-Header, 404/403-Sonderfälle) — neue API-Wrapper sollen dasselbe Muster reproduzieren, nicht neu erfinden.
- Tests: Kein Framework vorhanden. Für neue **reine** Logikmodule (`layout.ts`, `merge.ts`, `vitality.ts`, `classify.ts`) `bun test` nutzen (läuft ohne Zusatz-Dependency) — Komponenten bleiben manuell im Browser verifiziert (`/verify`-Skill-Konvention dieses Environments: Feature end-to-end im Browser durchspielen, nicht nur Typecheck).
- Definition-of-Done pro Milestone: (1) Typecheck/Lint grün, (2) manuelles QA im Browser inkl. Fehlerpfade, (3) Memory-Bank (`.kilocode/rules/memory-bank/context.md`) aktualisiert.

**Token-Scope-Übersicht (klassischer PAT bzw. Fine-Grained-Permission):**

| Milestone/Feature | Benötigter Scope |
|---|---|
| Lesen (Explorer, FileView) | keiner (unauthentifiziert möglich, niedrigeres Rate-Limit) oder `public_repo`/`repo` |
| M1/M2/M3 (Schreiben, Checkpoints) | `repo` (classic) bzw. Contents: Read & Write (fine-grained) |
| M6 (Merge-Konflikte lösen) | wie M1 |
| M7/M12 (PRs/Issues, Triage) | `repo` bzw. Pull requests + Issues: Read & Write |
| M10 Security-Applet | `security_events` bzw. Dependabot/Code-scanning/Secret-scanning alerts: Read |
| M10 Access-Applet | `admin:org`/Repo-Admin bzw. Administration: Read & Write |
| M10 Branch-Rules | Administration: Read & Write |
| M11 Codespaces | `codespace` |

---

<a id="10-offene-entscheidungen"></a>
## 10. Offene Entscheidungen, die der Maintainer treffen muss

Diese Punkte sind bewusst **nicht** im Plan vorentschieden:

1. **Backend ja/nein?** Aktuell 100 % client-seitig. Echtes Live-Update (statt Polling in M9), sichere Token-Verwahrung (statt `localStorage`) und ein „Wiki-Spike"-Proxy würden von Next.js Route Handlers (`src/app/api/*`) profitieren. Das ist ein Architekturwechsel, der explizit freigegeben werden sollte, bevor M9 beginnt.
2. **Auth-Modell:** PAT-in-localStorage beibehalten (einfach, aber Token-Diebstahl bei XSS = voller Repo-Zugriff) vs. GitHub OAuth App/GitHub App-Flow (bessere UX, feingranularere Rechte, aber braucht einen Server für den Token-Exchange). Wird mit steigenden Scopes in M10 relevanter.
3. **Editor-Wahl für M3:** CodeMirror 6 (Empfehlung) vs. Monaco (vertrauter, aber schwerer in Next.js zu integrieren).
4. **Hosting der Multiplayer-Komponente** für Phase 2, falls/wenn sie kommt (WebSocket-Server nötig).
5. **Wiki-Machbarkeit:** siehe M11 — Spike-Ergebnis entscheidet Scope.

---

<a id="11-risiken"></a>
## 11. Risiken

- **GitHub-API-Rate-Limit:** unauthentifiziert 60 Requests/h, authentifiziert 5000/h. M9 (Dock-Polling über mehrere Repos) kann das schnell aufbrauchen — Intervalle und Caching müssen von Anfang an konservativ sein, Budget-Anzeige (M9-Akzeptanzkriterium) ist Pflicht, kein Nice-to-have.
- **Token-Sicherheit:** Je mehr Scopes (M10 Admin-Rechte), desto größer der Schaden bei einem gestohlenen Token in `localStorage`. Sollte spätestens bei M10 gegen [§10](#10-offene-entscheidungen) Punkt 2 abgewogen werden.
- **Wiki-API existiert nicht wie angenommen:** Die Quelldokumente unterstellen einen WYSIWYG-Wiki-Editor „wie bei normalen Dateien" — GitHub-Wikis sind aber ein separates Git-Repo ohne Contents-API-Anbindung. Ohne Spike (M11) droht Scope-Kriechen auf ein Feature, das mit reinem REST nicht sauber baubar ist.
- **Browser-Speicherlimit bei Großdateien:** `github-write.ts` hält Dateien aktuell als `Uint8Array` im Speicher; M4/M5 sollten Chunk-Größen und gleichzeitige Downloads bewusst begrenzen, um Tab-Abstürze bei Multi-GB-Dateien zu vermeiden.
- **SSE-Annahme der Quelldokumente ist nicht einlösbar** ohne Backend/Webhook-Empfänger — in M9 durch Polling ersetzt; Erwartungsmanagement gegenüber der ursprünglichen Vision nötig.

---

<a id="12-checkliste"></a>
## 12. Milestone-Checkliste

- [x] M1 — Explorer-CRUD (neu/umbenennen/löschen/verschieben)
- [x] M2 — Working-Changes-/Checkpoint-Panel (Upload-Sonderpfad-Vereinheitlichung noch offen, siehe Hinweis unten)
- [x] M3 — In-Browser-Code-Editing
- [x] M4 — LFS- & Großdatei-Lesebewusstsein
- [x] M5 — Räumliches Layout / Grid-View
- [x] M6 — Merge-Konfliktauflösung
- [x] M7 — Pull-Requests- & Issues-Modul
- [ ] M8 — Multi-Repo-„Workspaces"-Refactor
- [x] M9 — Dock
- [x] M10 — Systemsteuerung (Security/Access/Branch-Rules)
- [x] M11 — Startmenü (Codespaces-Link, Releases/Packages, Wiki-Spike)
- [x] M12 — Triage-App
- [ ] Phase-2-Freigabe durch Maintainer (dann erst: Gamification-Umsetzung)
- [ ] Phase-3-Freigabe durch Maintainer (dann erst: `tools/anvil-core` anlegen)

**Status M1/M2 (umgesetzt 2026-07-15):** Explorer-CRUD (Neu/Umbenennen/Löschen/Verschieben)
legt jede Änderung als Delta in einem neuen Working-Changes-Modell ab
(`src/lib/github-ops.ts`, `src/features/changes/`); ein „Checkpoint erstellen"
committet das gesamte Changeset in einem Zug (Renames nutzen die vorhandene
Blob-SHA weiter, kein Re-Upload). Explorer zeigt den überlagerten Zustand
(Basis + Deltas) inkl. Badges für neu/umbenannt/zur-Löschung-vorgemerkt sowie
Restore/Discard. Offen aus M2s Akzeptanzkriterium: `UploadPanel`/`staging.tsx`
committen noch über ihren eigenen Pfad statt über denselben Changeset-Mechanismus
— bewusst zurückgestellt, um den bestehenden, funktionierenden Upload-Flow nicht
in derselben Änderung mit anzufassen. `FileView`s Ordner-Tabelle (Hauptbereich)
zeigt ebenfalls noch die rohe Remote-Liste statt der Overlay-Ansicht; die
Explorer-Sidebar ist aktuell die verbindliche Quelle für den Änderungsstatus.

**Status M3 (umgesetzt 2026-07-15):** CodeMirror 6 als Editor (Entscheidung aus
§10.3 getroffen, da im Vergleich zu Monaco keine Next.js/Webworker-Reibung).
„Speichern" erzeugt ein `modify`-Delta im Working-Changes-Modell, nie einen
Sofort-Commit. Ein Klick auf eine druckfrische, noch unkommittete Datei öffnet
jetzt direkt den Editor (löst die frühere M1-Beschränkung „neue Dateien nicht
öffenbar", da kein Netz-Fetch mehr nötig ist). „Neue Variante abzweigen" für
historische Refs wurde nicht gebaut — die App hat aktuell kein Konzept für das
Browsen abweichender historischer Commits (nur Branch-HEAD), daher greift dieser
Sonderfall aus dem Ursprungsdokument hier nicht.

**Status M4 (umgesetzt 2026-07-15):** `src/lib/lfs.ts` erkennt LFS-Pointer-Dateien
am Inhalts-Präfix; ein Cloud-Badge im Explorer basiert auf `.gitattributes`
(`filter=lfs`-Pattern, einmal pro Repo/Branch geladen — kein Content-Fetch pro
Datei nötig). FileView zeigt bei Pointer-Treffer ein dediziertes Panel mit
gezieltem Download (LFS-Batch-API, Fortschrittsanzeige) statt automatischem
Laden. `src/lib/vitality.ts` liefert „zuletzt geändert vor X Tagen"/„stale" —
bewusst nur für die aktuell geöffnete Datei abgerufen (nicht pro Zeile im
Explorer-Baum), um das in §11 gewarnte Rate-Limit-Risiko bei einem Ordner mit
vielen Dateien zu vermeiden.

**Status M5 (umgesetzt 2026-07-15):** `viewMode: "list" | "grid" | "city"` im
Store (dritter Wert für Phase 2 reserviert, nicht wählbar). `src/lib/layout.ts`
verwaltet Snap-to-Grid-Positionen in IndexedDB, geschlüsselt nach
(Repo, Branch, Ordnerpfad); neue Einträge werden automatisch in freie Zellen
gesetzt. „Layout mit Team teilen" (Ref-basiert) wurde nicht gebaut — bewusst
zurückgestellt, siehe Notiz bei M8/M11 unten.

**Status M6 (umgesetzt 2026-07-15):** `src/lib/merge.ts` (mit `bun test`-Suite)
implementiert einen zeilenbasierten 3-Wege-Merge ohne Abhängigkeit: nicht
überlappende Änderungen werden automatisch übernommen, überlappende different
geänderte Bereiche werden zu Konflikt-Hunks. `src/features/merge/` orchestriert
den Ablauf: Branch-Auswahl → Compare-API zweimal (Merge-Base finden, dann beide
Seiten seit der Merge-Base) → pro betroffener Datei 3-Wege-Merge → Side-by-Side-
UI mit Ours/Theirs/Both pro Konflikt-Hunk. Das Ergebnis landet als reguläres
`modify`/`add`/`delete`-Delta im bestehenden Changeset (M2) — kein Sonderpfad,
wie gefordert. Datei-vs-Ordner-Umbenennungskonflikte und Binärdatei-Konflikte
werden nicht behandelt (nur Textdateien); Löschen-vs-Ändern-Konflikte bekommen
eine vereinfachte Keep/Delete-Entscheidung statt einer Hunk-Ansicht.

**Status M7 (umgesetzt 2026-07-15):** `src/features/pulls/` und `src/features/issues/`
nach Modul-Konvention. `classifyPr()` (mit `bun test`-Suite) liefert
`clean | conflict | failing | needs-review | spam-suspect`; „spam-suspect" ist
bewusst simpel (Diffgröße vs. Beschreibungslänge, sobald das Detail nachgeladen
ist; vorher ein schwächerer Titel-Heuristik-Fallback) — explizit ohne ML.
Liste zeigt nur Badges (Diffgröße/Mergeability/Check-Status), keine
Spawn-Animation. Aktionen (Merge/Close/Request-Review/Label) hängen vom
Token-Scope ab; statt eines Scope-Test-Requests (das ist M10s Anforderung)
wird der reale 403/422-Fehler der jeweiligen Aktion inline angezeigt. Details
(mergeable-Status, Check-Runs) werden bewusst nur beim Aufklappen einer
einzelnen PR nachgeladen, nicht für die ganze Liste — dieselbe
Rate-Limit-Vorsicht wie bei M4s Vitalitäts-Badge.

**Hinweis zur Reihenfolge (2026-07-15, korrigiert):** M8 (Multi-Repo-Refactor)
wurde bewusst übersprungen, bevor M9/M11/M12 angegangen wurden. Der Plan
selbst markiert M8 als „größten Kernstate-Eingriff des gesamten Plans" — und
da M1–M7 bereits sehr viel Code geschrieben haben, der auf dem heutigen
Singular-`state.meta`-Zustand aufbaut, hätte ein überstürzter Umbau an dieser
Stelle ein hohes Regressionsrisiko ohne die Möglichkeit gehabt, ihn ebenso
gründlich zu verifizieren wie die bisherigen Milestones.

Der Plan behauptet, M8 sei „Voraussetzung für M9–M11" — das habe ich zunächst
unkritisch übernommen und in einer ersten Fassung dieses Abschnitts M9 und M11
fälschlich als „von M8 blockiert" bezeichnet. Der Maintainer hat das zu Recht
hinterfragt: M9 (Dock) braucht **kein** gleichzeitig offenes Multi-Repo-Tab-/
Tree-State. Der Schnellwechsel ruft einfach das bereits existierende
`openRepo(fullName)` auf (ersetzt das aktive Repo, exakt wie der bestehende
„Recent"-Verlauf es heute schon tut); die aggregierten PR-/Issue-Badges sind
unabhängige Hintergrund-Fetches pro gepinntem Repo (Search-API,
`total_count`), die nichts mit dem Tab-/Baum-Zustand des aktuell offenen Repos
zu tun haben. Nur M11 hätte man wörtlich als „vom Startmenü-Kontext abhängig"
lesen können, aber auch dort betreffen Codespaces/Releases/Wiki ausschließlich
das aktuell offene Repo — auch hier war die Plan-Prämisse für die
tatsächlichen M11-Inhalte nicht zutreffend. Beide wurden entsprechend noch in
dieser Sitzung nachgeholt (siehe Status-Abschnitte unten). M12 (Triage) baut
ohnehin direkt auf M7 auf und war davon nie betroffen.

**Status M12 (umgesetzt 2026-07-15):** `src/features/triage/` baut auf M7s
`usePulls()`/`classifyPr()` auf. Tastatur-Navigation (↑/↓ bzw. j/k, Leertaste
zum Selektieren), Schnellauswahl nach Klasse („alle spam-suspect" etc.),
Bulk-Aktionen (Schließen ± Branch-Löschung, Label, Review anfragen). Jede
Bulk-Aktion zeigt vor Ausführung eine Zusammenfassung („N PRs werden
geschlossen, N Branches gelöscht") mit Confirm/Cancel — exakt das
Akzeptanzkriterium aus dem Plan.

**Status M10 (umgesetzt 2026-07-15):** `src/features/control-panel/` mit drei
Applets (Security/Access/Branch-Rules), jedes ein eigenes Feature-Modul.
Scope-Erkennung ausschließlich per echtem Test-Request (403 → „Disabled –
Token fehlt Scope X", 404 → „nicht verfügbar/nicht aktiviert"), nie durch
Parsen des Tokens — jedes Applet bleibt sichtbar und zeigt den konkreten
Grund, kein stiller Ausfall. Access-Applet generiert `.github/CODEOWNERS` aus
ausgewählten Collaboratoren und staged die Datei über den bestehenden M1/M2-
Changeset-Mechanismus (kein Sonder-API-Write). Branch-Rules ist bewusst
read-only (Zusammenfassung der aktuellen Schutzregeln + Link, kein Editor) —
ein Teil-Editor für so viele voneinander abhängige Felder wäre riskanter als
nützlich für ein v1. **Bug beim Bauen gefunden und behoben:** Die
„Collaborators"-Sektion hing zunächst an einer generischen Lazy-Load-
Komponente, die ihre Promise per `useEffect` mit leeren Dependencies nur
einmal auflöste — das fing den Zustand vor Abschluss des echten Fetches ein
und zeigte dauerhaft „None found" trotz korrekt geladener Daten (sichtbar an
der KORREKT befüllten CODEOWNERS-Checkbox-Liste direkt darunter). Behoben,
indem die Collaborators-Anzeige direkt aus dem schon vorhandenen State der
Elternkomponente rendert statt über die wiederverwendbare Lazy-Load-Hülle.

**Status M11 (umgesetzt 2026-07-15):** `src/features/start-menu/` mit drei
Reitern.

*Codespaces-Launcher:* `POST /repos/{owner}/{repo}/codespaces` erzeugt einen
Codespace, das Ergebnis wird als neuer Tab (`web_url`) geöffnet — **kein**
eingebetteter VM-Client, exakt die in §11 gezogene Plattformgrenze. Zusätzlich
ein reiner Deep-Link (`github.com/codespaces/new?repo=…&ref=…`) als
Fallback ohne API-Aufruf. Vorhandene Codespaces werden über
`GET /user/codespaces` gelistet und client-seitig nach `repository.full_name`
gefiltert (es gibt keinen repo-gescopten Codespaces-Endpunkt).

*Releases & Paket-Zentrale:* Standard-REST (`/releases`), unkritisch wie im
Plan erwartet. Packages sind Owner- statt Repo-gescopt (GitHub bietet keinen
„Packages für dieses Repo"-Endpunkt) — die Implementierung fragt die
gängigen `package_type`-Werte einzeln ab und filtert client-seitig auf den
Repo-Namen; das ist ein Kompromiss (mehrere Requests statt einem), aber der
einzige Weg ohne einen Owner-weiten Paket-Browser zu bauen, der über den
Rahmen von M11 hinausginge.

*Wiki-Spike (schriftliche Machbarkeits-Notiz, wie vom Plan gefordert, bevor
UI-Arbeit begann):* Ein GitHub-Wiki ist ein **separates Git-Repository**
(`owner/repo.wiki.git`) ohne jede Anbindung an die Contents-API — Lesen und
Schreiben liefe ausschließlich über echtes Git-über-HTTP (`git-upload-pack`/
`git-receive-pack`, das „Smart-HTTP"-Protokoll). GitHubs Git-Smart-HTTP-
Endpunkte senden keine permissiven CORS-Header für beliebige Origins (anders
als z. B. `raw.githubusercontent.com`) — das ist eine bewusste
Plattformentscheidung, die genau verhindert, dass ein reiner Browser-Client
ohne eigenen Server/Proxy klonen oder pushen kann. Bibliotheken wie
`isomorphic-git`, die Git-Operationen im Browser nachbilden, benötigen dafür
exakt deshalb einen dedizierten CORS-Proxy-Server. **Ergebnis des Spikes:**
Ein WYSIWYG-Wiki-Editor ist mit der heutigen 100-%-Client-seitigen
Architektur **nicht machbar** — er würde entweder (a) einen Backend-Proxy
speziell für Git-Smart-HTTP voraussetzen (ein Vorgriff auf Phase 3s
„ANVIL Core", das ohnehin als lokaler Dienst geplant ist, nicht als
Browser-Code) oder (b) eine komplette Neuimplementierung des Wiki-Editors
auf Basis von öffentlich zugänglichen Nur-Lese-Wegen (z. B. dem Wiki-HTML
selbst scrapen), was keine echte Schreibfunktion ergäbe. Entsprechend dem im
Ursprungsdokument selbst vorgesehenen Ausweg wurde **nur ein Hinweis-Stub**
gebaut: Deep-Link zum Wiki auf github.com plus die Machbarkeits-Notiz direkt
in der UI. Kein Editor-Code wurde geschrieben — das Spike-Ergebnis hat den
Scope bewusst begrenzt, bevor UI-Arbeit daran hätte beginnen können, genau
wie das Akzeptanzkriterium es verlangt.

**Status M9 (umgesetzt 2026-07-15, nachträglich nach Korrektur der
Abhängigkeitsannahme):** `src/features/dock/` — persistente Leiste, sichtbar
unabhängig davon, ob gerade ein Repo offen ist. Gepinnte Repos werden als
einfache String-Liste in `localStorage` verwaltet (`pins.ts`); Klick auf einen
Chip ruft das bestehende `openRepo(fullName)` auf — der Schnellwechsel ersetzt
das aktive Repo genau wie der vorhandene „Recent"-Mechanismus, es wird kein
Multi-Repo-Zustand benötigt. Aggregierte PR-/Issue-Badges pro gepinntem Repo
kommen über je einen `GET /search/issues?q=repo:…+is:pr+is:open`-Aufruf
(liefert `total_count` direkt, günstiger als Paginierung) — bewusst **ohne**
Mergeable-/Check-Detail pro PR, da das für jedes gepinnte Repo im Poll-Takt
genau die in §11 gewarnte Rate-Limit-Lawine wäre. Polling alle 5 Minuten,
pausiert bei `document.hidden`, zusätzlich sofortiger Poll bei jeder
Pin-Änderung (siehe Bug-Fund unten) und bei Rückkehr in den Tab. Rate-Limit-
Budget wird sichtbar gemacht („4980/5000 requests · resets in 1h") über einen
neuen, minimal-invasiven Tracker in `github.ts`, der die
`x-ratelimit-*`-Header jeder Antwort mitschneidet (bislang wurden sie nur für
die 403-Fehlerbehandlung gelesen, nie gespeichert) — Backoff pausiert das
Polling unter 50 verbleibenden Requests.

**Zwei Bugs beim Bauen/Verifizieren gefunden und behoben:** (1) Neu gepinnte
Repos bekamen ihr Badge zunächst erst beim nächsten 5-Minuten-Tick, weil der
Poll-Effekt nur einmal beim Mount lief (leeres Dependency-Array) und nicht auf
Änderungen der Pin-Liste reagierte — behoben, indem ein zweiter Effekt jetzt
gezielt bei jeder Änderung von `pins` pollt. (2) Beim ersten Browser-Test
schien die Rate-Limit-Anzeige komplett zu fehlen; das lag am Playwright-Mock,
nicht am Code — Browser blenden bei Cross-Origin-Antworten alle Header außer
einer kleinen Standardliste vor JavaScript aus, sofern der Server nicht
`Access-Control-Expose-Headers` für die zusätzlichen Header setzt. Die echte
GitHub-API tut das nachweislich (sonst hätte die schon vorher im Repo
vorhandene 403-Ratenlimit-Erkennung in `ghFetch` nie funktionieren können) —
das Mock ohne diesen Header war schlicht unrealistisch. Mit dem korrekten
Header im Mock verifiziert sich die Anzeige einwandfrei.

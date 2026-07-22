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
- [ ] M3 — In-Browser-Code-Editing — Häkchen war laut `docs/DRAGHUB_PLAN_CORRECTION_RECORD.md` §5 zu früh gesetzt (Textarea ≠ M3). Stand 2026-07-19: M3b-Editor auf CodeMirror-6-Basis implementiert (Syntax-Highlighting im Edit-Modus, Zeilennummern, Suchen/Ersetzen, Undo/Redo, `Ctrl/Cmd+S` → Working Change, Dirty-Punkt im Tab, Draft-Erhalt über Tab-/Repo-Wechsel und Reload, Cursor-/Scroll-Erhalt, gerenderte Markdown-Vorschau, Großdatei-Schutz, FLUBBER-Zwei-Long-Press-Textauswahl mit eigenen Griffen). Stand 2026-07-21: das verbliebene Akzeptanzkriterium „historischen Ref editieren → Variante abzweigen" ist implementiert — ein neuer „File History"-Umschalter in `FileContentView` (`src/components/FileView.tsx`) listet Commits, die die Datei berühren (`fetchFileHistory`, `src/lib/github.ts`); Auswahl eines Commits öffnet einen eigenen, an diesen Commit gepinnten Tab (`Tab.ref`/`Tab.refLabel`, `src/lib/store.tsx`) statt den Branch-Tip zu überschreiben. Editieren eines solchen Tabs zeigt einen Hinweis-Banner statt einer blockierenden Fehlermeldung und bietet „Branch off to edit" an, das per `createBranchFromSha` (`src/lib/github-write.ts`) einen neuen Branch exakt am gepinnten Commit erzeugt und den Tab nahtlos in den Editor überführt. Noch offen: die End-to-End-Abnahme durch den Maintainer (dieses Häkchen bleibt bewusst dem Maintainer vorbehalten, nicht dem Agenten).
- [x] M4 — LFS- & Großdatei-Lesebewusstsein
- [x] M5 — Räumliches Layout / Grid-View
- [x] M6 — Merge-Konfliktauflösung
- [x] M7 — Pull-Requests- & Issues-Modul
- [x] M8 — Multi-Repo-„Workspaces"-Refactor
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

**Status Desktop-Integration (umgesetzt 2026-07-20, Vertrag:
`docs/POST_PR8_REFERENCE_INTEGRATION.md`):** Erster Fable-Integrationspass
abgeschlossen — die Mock-Anwendungen des PR-#8-Desktop-Kernels sind über die
Application Registry durch die echten DRAGHUB-Fähigkeiten ersetzt
(`src/features/desktop-apps/`): echter Repository Explorer
(AddressBar/Explorer/Tabs/FileView/Changes unter fensterbezogenem
`RepoScope`), Datei-Viewer- und CodeMirror-Editor-Kindfenster, GitHub-Feature-
Kindfenster (PRs/Issues/Actions/Changes), echter System-Papierkorb und
Settings, Suche öffnet/fokussiert Repository-Fenster, Lifecycle-Adapter
verbindet Fenster-Schließen mit Dirty-Drafts/Pending-Changes (Commit oder
Papierkorb). Inventar und Per-Window-State-Design:
`docs/DESKTOP_INTEGRATION_INVENTORY.md`. Zurückgestellt: Triage,
Control-Panel- und Start-Menü-Fenster, Shares (ADR), Theia/ANVIL-Core.

**Status Papierkorb (umgesetzt 2026-07-20, Vertrag: Korrekturprotokoll §6 /
Desktop-Shell-Spec §14):** Funktionaler Papierkorb als eigene Ansicht
(`src/lib/recycle-bin.ts`; seit dem Desktop-Integrationspass als
System-Fenster `src/features/desktop-apps/RecycleBinApp.tsx`, das frühere
Modal-Modul `src/features/recycle-bin/` ist darin aufgegangen): noch nicht
eingecheckte Löschungen erscheinen als wiederherstellbare Einträge; verworfene
inhaltstragende Working Changes (Add/Modify) wandern mit erhaltenem Blob in
eine Repo-zugeordnete Aufbewahrung (7 Tage Frist) statt zerstört zu werden;
Wiederherstellung an den Ursprungspfad, bei Pfadkonflikt wird ein neues Ziel
verlangt; Leeren nur mit Zusammenfassung (Anzahl + Bytes) und ausdrücklicher
Bestätigung; Git-Historie wird nie umgeschrieben (Hinweis in der UI). Offen:
Varianten-Zuordnung ist derzeit Repo-genau (ein Branch pro Repo-Fenster);
sobald Varianten/Branch-Wechsel existieren, muss der Papierkorb-Eintrag
zusätzlich die Variante tragen.

**Status Post-Integrationskorrekturen (umgesetzt 2026-07-21):** Fünf
Isolationslücken aus dem ersten Integrationspass geschlossen, jede mit
Regressionstests abgedeckt:

- **Verwandte-Suche**: `SearchPanel` liest den Repository-Kontext nicht mehr
  über den global aktiven Repo-Zeiger, sondern erhält ein explizites
  `relatedRepoKey`, abgeleitet vom fokussierten Desktop-Fenster
  (`repoKeyFromWindow` in `src/features/search/`); System-/Tool-Fenster
  deaktivieren die Verwandte-Suche mit Erklärtext.
- **Bild-Vorschau privater Repos**: neue authentifizierte
  `fetchRepositoryBlob` (`src/lib/github.ts`, gleicher Token-Pfad wie jede
  andere Anfrage, byte-treuer Base64-Decode, bestehende 5-MB-Guard) statt
  eines unauthentifizierten `raw.githubusercontent.com`-Requests; der
  `ImageViewer` in `FileView.tsx` rendert den Blob über eine Object-URL,
  verwaltet vom reinen Helfer `src/lib/image-url.ts`
  (`createImageUrlManager`), die bei Ersetzung und beim Unmount freigegeben
  wird.
- **Papierkorb leeren**: `RecycleBinApp` leert jetzt sowohl die
  Kernel-Einträge (`wm.session.recycleBin`) als auch die pro Repository
  zurückgehaltenen Changes in einer Aktion (reine Helfer
  `recycleBinSummary`/`emptyRecycleBinAll` in
  `src/features/recycle-bin/recycle-bin-summary.ts`); zuvor leerte die
  Aktion nur die zurückgehaltenen Changes. Zur Löschung vorgemerkte,
  noch nicht committete Änderungen bleiben unangetastet.
- **Repository-Ladezustand**: die globalen `repoLoading`/`repoError`-Felder
  sind einer `repoRequests`-Map je (kleingeschriebenem) repoKey gewichen
  (`src/lib/store.tsx`, `useRepoRequest`), sodass parallel ladende oder
  wiederholende Repository-Fenster einander nicht mehr beeinflussen.
- **Fenster-Schließ-Geltungsbereich**: `features/desktop-apps/lifecycle-adapter.ts`
  leitet Inspektion und Auflösung jetzt aus derselben reinen
  `deriveCloseScope(target)` ab. Ein einzelnes Editor- oder Viewer-Fenster
  wirkte zuvor auf das gesamte Repository (jeder offene Entwurf wurde
  gestaged/verworfen, ein Editor-Schließen konnte sogar einen vollen
  Repository-Checkpoint auslösen); jetzt betrifft ein Editor-Schließen nur
  seine eigene Datei (kein Checkpoint, keine fremden Entwürfe, die
  Working-Changes-Bucket des Repos bleibt unberührt), und ein
  Viewer-Schließen hat nie einen Domänen-Effekt. Das Verhalten beim
  Schließen eines Repository-Fensters bleibt unverändert.

**Status Dock (umgesetzt 2026-07-22):** M9s Häkchen war zu weit gefasst —
im Kernel des native-Workspace-Umbaus (PR #30) existierte kein Dock, nur
die Taskbar (laufende Fenster, gruppiert). Beide Bausteine erfüllen
unterschiedliche Verträge und bleiben getrennt: die Taskbar zeigt, was
gerade läuft; das neue `src/features/desktop/Dock.tsx` zeigt angepinnte
Repositories — unabhängig davon, ob sie gerade offen sind, genau wie ein
macOS-Dock gegenüber seinem Fenster-Umschalter. Umgesetzt: linksseitige,
immer sichtbare Leiste mit Start-Button (öffnet das Kapitänskajüte-
Startmenü) und angepinnten Repository-Icons (laufend-Indikator-Punkt,
Klick öffnet/fokussiert das Fensterobjekt, Drag-Reorder, Unpin-Button);
Pins werden über `localStorage` (`gh-browser-pinned`) persistiert und
überleben — anders als zuvor — auch `RELEASE_REPO` (Pin ist ein
Dock-Favorit, kein Cache-Zustand); Pin/Unpin ist aus dem Startmenü heraus
bedienbar (Recent-Liste, Suchergebnisse, neue "Pinned to Dock"-Sektion).
`geometry.ts` reserviert die Dock-Breite (`DesktopViewport.dockWidth`) in
`usableBounds`/`clampBounds`, und `.desktop-canvas` bekommt denselben
linken Inset, sodass auch maximierte Fenster nie unter dem Dock rendern
(MULTI_REPO_WINDOW_DOCK_SPEC.md §8, browserverifiziert per Playwright/
mockter GitHub-API inkl. Reload-Persistenz und Maximieren-Screenshot). Auf
schmalen Mobile-Viewports (<720px) bleibt der Dock ausgeblendet — angepinnte
Repos bleiben dort über das Startmenü erreichbar. Die tote Altimplementierung
`src/features/dock/` (nie eingebunden) wurde entfernt.

**Status Startmenü (umgesetzt 2026-07-22):** Das Kapitänskajüte-Startmenü
aus PR #30 war ausschließlich über `Ctrl/Cmd+K` bzw. den Taskbar-Text
"Launcher / Search" erreichbar — kein eigener, sichtbarer Einstiegspunkt.
Der neue Dock-Start-Button ist jetzt dieser Einstiegspunkt. Inhaltlich
ergänzt: eine "Pinned to Dock"-Sektion sowie Pin/Unpin-Schnellzugriffe in
der Recent- und Ergebnisliste (siehe Dock-Status oben). Weiterhin offen aus
PR #30s Aufzählung und nicht Teil dieser Änderung: Notification Center,
Task View (Fensterübersicht) und die erweiterten Appearance-Settings
(System-/zeitbasiertes Theme, Wallpaper-Picker, Sprache) — Letzteres
inklusive der bewusst unangetasteten Wallpaper-Entscheidung.

**Status Konfliktauflösung / Issue #20 (umgesetzt 2026-07-22):** M6s
Häkchen bezog sich nur auf die reine Logik (`src/lib/merge.ts`); eine
Oberfläche existierte nicht — `FileView.tsx` zeigte lediglich einen
Hinweis-Banner ("N merge conflict hunks detected"), der weder das
Speichern blockierte noch eine Ours/Theirs-Ansicht bot, und `resolveConflict()`
war komplett unbenutzt (siehe unten). Jetzt umgesetzt:

- Neues Fenster `conflict-resolver` (`src/features/desktop-apps/ConflictResolverView.tsx`,
  gerendert über `FileWindowApp`s dritten `mode: "resolve"` neben
  `viewer`/`editor` — dieselbe Datei-Lade-/Session-Logik, keine Parallel-
  Architektur) mit Ours/Theirs-Karten pro verbleibender Konfliktregion
  (Kontextzeilen, Accept Current/Incoming/Keep Both), "Accept all
  Ours/Theirs" für mehrere Regionen, und einem frei editierbaren
  Result-Editor (CodeMirror). Erreichbar über `Datei-Handler-Registry` →
  "Open with → Resolve Conflicts" sowie einen neuen "Resolve conflicts…"-
  Link im bestehenden Konflikt-Banner der Tab-Ansicht.
- `src/lib/merge.ts`: `parseConflictHunks` vergibt jetzt positionsbasierte
  statt zufällige Hunk-IDs (Bugfix — `resolveConflict()`s eigener
  Choices-Map-Abgleich konnte nie treffen, da jeder Parse-Aufruf zuvor neue
  `crypto.randomUUID()`-Werte erzeugte); neu: `hasUnresolvedConflicts()`
  und `resolveConflictAt()` (löst genau eine Region auf, lässt alle
  anderen unangetastet) — beide mit vollständiger `bun test`-Abdeckung
  (`src/lib/merge.test.ts`).
- Speichern/Staging wird blockiert, solange Markierungen bestehen — nicht
  nur der Save-Button im Resolver-Fenster selbst, sondern auch der
  Schließen-Dialog-Pfad (`lifecycle-adapter.ts`s editor-scope
  `commit-and-close`) und der repository-weite Checkpoint-Pfad (jeder
  dirty Draft wird vor dem Staging geprüft, atomar — ein blockierter
  Konflikt lässt keine anderen Dateien halb gestaged zurück).
- Nebenbefund beim Verifizieren im echten Browser: `openRepositoryChild`
  akzeptiert ausschließlich die ID des *Wurzel*-Repository-Fensters; das
  "Files"-Fenster reichte bisher versehentlich seine eigene Fenster-ID
  durch, wodurch sowohl der bestehende "Changes"-Button als auch das
  "Open with"-Menü dort schon vor dieser Änderung wirkungslos waren
  (`GithubFeatureApp.tsx` behebt das jetzt für beide, nicht nur für den
  neuen Resolver).
- Absichtlich nicht angefasst: Konflikterkennung bleibt inhaltsbasiert
  (Markierungen im Dateiinhalt) — die Datei-Handler-Registry kennt beim
  Zuordnen von Anwendungen nur Pfad/Größe, keinen Inhalt, kann eine
  konfliktbehaftete Datei also nicht automatisch vom normalen Editor
  unterscheiden; "Resolve Conflicts" ist deshalb ein bewusst gewählter,
  nicht automatisch vorbelegter Menüpunkt.

**Status Starred-Repo-Manager / Issue #33 (umgesetzt 2026-07-22):** Neues
Systemfenster `starred-repos` (`src/features/desktop-apps/StarredReposApp.tsx`,
API-Modul `src/features/starred/api.ts`) — erreichbar über das Startmenü-
Tool-Grid ("Starred") neben Scratchpad/Settings/Recycle Bin. Listet die
echten GitHub-Stars des Nutzers (`GET /user/starred`, paginiert bis zu
2000 Repos), erlaubt Filtern, Öffnen als reguläres Repository-Fenster,
Unstarren (`DELETE /user/starred/{owner}/{repo}`) sowie Starren eines
neuen Repos per `owner/repo`-Eingabe (`PUT /user/starred/{owner}/{repo}`).
Bewusst getrennt vom Dock-„Pin“-Konzept: ein GitHub-Star ist eine echte,
serverseitige Beziehung (über jeden GitHub-Client hinweg sichtbar), ein
Dock-Pin ist ein rein lokaler DRAGHUB-Launcher-Shortcut — Starren pinnt
nicht, Pinnen starred nicht. Browserverifiziert per Playwright (gemockte
`/user/starred`-Liste, Filtern, Unstar, Star-per-Eingabe, Öffnen-Klick).

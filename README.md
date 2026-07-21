<div align="center">

# DRAGHUB

### GitHub, aber als echter Arbeitsraum.

**Ein browserbasierter GitHub-Desktop für Repositories, Dateien, Änderungen, Reviews und Projektverwaltung — ohne den ständigen Verlust von Kontext.**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1?logo=bun&logoColor=black)
![Status](https://img.shields.io/badge/Phase%201-implemented-f0b429)

</div>

---

## Was ist DRAGHUB?

GitHub ist mächtig, fühlt sich aber oft nicht wie ein zusammenhängender Arbeitsplatz an. Dateien öffnen neue Seiten, Repository-Kontext geht verloren, parallele Projekte verteilen sich über Tabs und viele alltägliche Aktionen bleiben unnötig abstrakt.

DRAGHUB übersetzt GitHub in ein vertrauteres Desktop-Modell:

- Repositories öffnen sich als echte Fenster in einem Desktop-Kernel — nicht als Tabs oder Seiten.
- Jedes Repository-Fenster hat seinen eigenen Zustand (Tabs, Baum, Auswahl, Ladezustand); zwei Fenster beeinflussen sich nie gegenseitig.
- Dateien und Ordner bleiben im sichtbaren Projektkontext.
- Mehrere Repositories können parallel geöffnet werden.
- Änderungen werden gesammelt und als **Checkpoint** bestätigt.
- GitHub-Funktionen (PRs, Issues, Actions, Triage, Security, Releases, Settings) docken als eigene, repository-gebundene Fenster an.
- Was eine Datei öffnen kann, entscheidet eine echte **Datei-Handler-Registry** — „Öffnen mit" statt wachsender Sonderfälle.

Das Ziel ist nicht, GitHub nachzubauen. DRAGHUB soll die Reibung zwischen **Repository, Dateien, Änderungen und Entscheidungen** entfernen.

---

## Aktueller Stand

> [!IMPORTANT]
> **Phase 1 ist implementiert, aber noch nicht als fertige Version freigegeben.**
> Finales Browser-QA, Regressionstests und UI-Polish stehen noch aus.

| Bereich | Status |
|---|---|
| Phase 1 · GitHub Browser / Desktop Workspace | Implementiert, Verifikation läuft |
| Phase 2 · Gamification-Schicht | Noch nicht freigegeben |
| Phase 3 · lokaler ANVIL Core | Noch nicht begonnen |

DRAGHUB ist derzeit ein **aktiver Entwicklungsstand**, kein stabiles Produktionsrelease.

---

## Funktionen der Phase 1

### Desktop-Kernel und Repository-Fenster

- Fenster-Kernel mit Anwendungsregistrierung, Taskleiste, Dock und Desktop-Icons für Repositories
- Jedes Repository-Fenster ist über `RepoScope` isoliert — eigene Tabs, Auswahl, Verzeichniszustände und Lade-/Fehlerzustand pro Fenster, nicht global
- Mehrere Repositories gleichzeitig öffnen, parallel laden, unabhängig scheitern und erneut versuchen
- Branch-Wechsel ohne Vermischung laufender Datei- oder Ordneranfragen
- Repository-Suche über die fokussierte Fensterumgebung; „Related" bezieht sich immer auf das gerade fokussierte Fenster, nie auf ein global „aktives" Repository

### Dateien, Viewer und Öffnen mit

- Datei- und Ordnernavigation im Explorer
- Neue Dateien und Ordner anlegen
- Umbenennen, löschen und per Drag-and-drop verschieben
- Mehrfachauswahl und Kontextmenüs
- Datei-Tabs mit Drag-Reordering
- In-Browser-Codebearbeitung (CodeMirror 6) mit Entwurfssitzungen, die Tab- und Repo-Wechsel überleben
- Registry-basiertes „Öffnen mit": Code-Editor, Bild-Viewer, Markdown-Vorschau, Raw-Text-Ansicht, Audio-Player und Download werden pro Dateityp aus einer echten Handler-Tabelle bestimmt, nicht aus verstreuten `if (extension === ...)`-Prüfungen
- Bilder und Audio laufen über einen gemeinsamen, authentifizierten Binär-Adapter — private Repositories funktionieren identisch zu öffentlichen
- Räumliche Grid-Ansicht mit persistenter Anordnung
- Bewusstsein für Git LFS und große Dateien

### Änderungen und Checkpoints

DRAGHUB behandelt lokale Änderungen als sichtbaren Arbeitszustand:

```text
Basis-Commit
    + ungespeicherte Änderungen
    + Umbenennungen
    + Löschungen
    + neue Dateien
    = aktueller Workspace
```

- Änderungen zunächst sammeln statt sofort einzeln zu committen
- Overlay aus Remote-Zustand und lokalen Deltas
- Änderungen wiederherstellen oder verwerfen
- Gesamtes Changeset als einen Checkpoint schreiben
- Blob-SHAs bei Umbenennungen wiederverwenden
- Merge-Konflikte strukturiert auflösen
- Ein einzelnes Editor- oder Viewer-Fenster schließen betrifft **ausschließlich seine eigene Datei** — nie fremde Entwürfe, nie das Working-Changes-Bucket des Repositories, nie einen ungewollten Checkpoint; Repository-Fenster behalten ihr repo-weites Schließverhalten
- Papierkorb vereinigt Kernel-Einträge (verworfene Entwürfe geschlossener Fenster) und zurückgehaltene Working Changes in einer Ansicht und einer „Leeren"-Aktion; zur Löschung vorgemerkte, noch nicht committete Änderungen bleiben davon unberührt

### GitHub-Werkzeuge

- Pull-Request- und Issues-Modul
- Triage-Oberfläche
- Security-, Access- und Branch-Rule-Bereiche
- Releases, Packages und Codespaces-Zugänge
- Startmenü für weiterführende GitHub-Funktionen
- Rate-Limit-bewusstes Polling statt vorgetäuschter Echtzeit

---

## Produkt-Richtung

DRAGHUB entwickelt sich zu einem **browser-first GitHub Desktop**:

```text
┌──────────────────────────────────────────────────────────────┐
│ Desktop / Taskbar / Repository-Laufwerke                    │
├─────────────────────────────┬────────────────────────────────┤
│ Explorer                    │ Datei, Editor oder Viewer      │
│                             │                                │
│ src/                        │ Tabs bleiben im Repo-Kontext   │
│ docs/                       │                                │
│ assets/                     │ GitHub-Werkzeuge docken an     │
├─────────────────────────────┴────────────────────────────────┤
│ Dock · Änderungen · Reviews · Status                        │
└──────────────────────────────────────────────────────────────┘
```

Die verbindlichen UI-Spezifikationen beschreiben unter anderem:

- unabhängige Repository-Fenster
- eine dauerhaft sichtbare, gruppierte Taskbar
- Repository-eigene Werkzeug- und Dokumentfenster
- ein flexibles **Rubber Band** für angebundene GitHub-Funktionen
- Bild-Thumbnails und einen minimierbaren Viewer
- Repositories als Laufwerke statt als Wegwerf-Browserseiten

---

## Schnellstart

### Voraussetzungen

- [Bun](https://bun.sh/)
- ein aktueller Browser
- optional: GitHub-Zugangsdaten für Schreib- und Verwaltungsfunktionen

### Installation

```bash
git clone https://github.com/Lootziffer666/DRAGHUB.git
cd DRAGHUB
bun install
bun dev
```

Anschließend:

```text
http://localhost:3000
```

### Qualitätsprüfungen

```bash
bun test          # Unit-Tests (bun:test, unter src/)
bun typecheck
bun lint
bun build
bun run test:e2e  # Playwright — nutzt das im Image vorinstallierte Chromium,
                   # kein separater Browser-Download nötig
```

Playwright ist eine feste devDependency; `playwright.config.ts` startet den
Next.js-Dev-Server automatisch und mockt GitHub für die E2E-Specs unter
`e2e/` (siehe `e2e/fixtures/github-mock.ts`) — echte GitHub-API-Aufrufe sind
für diese Tests nicht nötig.

---

## Berechtigungen

Öffentliche Repositories können grundsätzlich ohne Anmeldung gelesen werden, allerdings mit einem deutlich niedrigeren GitHub-API-Limit.

Für erweiterte Aktionen werden passende GitHub-Berechtigungen benötigt:

| Funktion | Typische Berechtigung |
|---|---|
| Öffentliche Repositories lesen | keine oder Contents: Read |
| Dateien und Checkpoints schreiben | Contents: Read & Write |
| Pull Requests und Issues bearbeiten | Pull Requests / Issues: Read & Write |
| Security-Informationen lesen | entsprechende Security-Scopes |
| Branch Rules und Administration | Administration: Read & Write |
| Codespaces | Codespaces-Berechtigung |

> [!WARNING]
> Der aktuelle Entwicklungsstand ist überwiegend clientseitig. Verwende keine unnötig weitreichenden Zugangsdaten und behandle den jetzigen Authentifizierungsweg nicht als endgültiges Produktionsmodell.

---

## Projektstruktur

```text
DRAGHUB/
├── src/
│   ├── app/                 # Next.js-App, Desktop-Kernel-Bootstrap
│   ├── components/          # Explorer, Tabs, Viewer und UI-Bausteine
│   ├── features/
│   │   ├── desktop/         # Fenster-Kernel: Manager, Registry, Taskbar, Lifecycle
│   │   ├── desktop-apps/    # Reale Anwendungen (Repository Explorer, Viewer,
│   │   │                    #   Editor, GitHub-Feature-Fenster, Recycle Bin, …)
│   │   │   └── file-handlers/  # Datei-Handler-Registry + Open-With-Menü
│   │   └── …                # isolierte GitHub-Feature-Module (pulls, issues, …)
│   └── lib/                 # GitHub-Zugriff, Store, DnD und Kernlogik
├── e2e/                     # Playwright-Specs + GitHub-API-Mock-Fixture
├── supabase/anvil-graph/    # Migrationen für DRAGHUBs Eintrag im ANVIL System Graph
├── docs/                    # verbindliche Produkt- und Architekturspezifikationen
├── PLAN.md                  # Ausführungsplan und Milestone-Status
├── AGENTS.md                # Regeln für ausführende Coding-Agenten
└── package.json
```

Neue isolierbare Fähigkeiten gehören grundsätzlich nach:

```text
src/features/<feature-name>/
```

Der zentrale Store und seine öffentlichen Verträge sollten nicht beiläufig erweitert oder neu interpretiert werden.

---

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [`PLAN.md`](./PLAN.md) | Phasen, Milestones, Konventionen und Risiken |
| [`AGENTS.md`](./AGENTS.md) | Arbeitsregeln für Coding-Agenten |
| [`docs/DRAGHUB_BUILD_SPEC.md`](./docs/DRAGHUB_BUILD_SPEC.md) | lokale Codespace- und Flow-Contract-Architektur |
| [`docs/MULTI_REPO_WINDOW_DOCK_SPEC.md`](./docs/MULTI_REPO_WINDOW_DOCK_SPEC.md) | Multi-Repo-State, Fenster und Dock |
| [`docs/GITHUB_DESKTOP_SHELL_SPEC.md`](./docs/GITHUB_DESKTOP_SHELL_SPEC.md) | Desktop-Shell und GitHub-Werkzeuge |
| [`docs/RUBBER_BAND_WORKSPACE_VIEWER_SPEC.md`](./docs/RUBBER_BAND_WORKSPACE_VIEWER_SPEC.md) | file-first Workspace, Rubber Band und Viewer |
| [`docs/DESKTOP_INTEGRATION_INVENTORY.md`](./docs/DESKTOP_INTEGRATION_INVENTORY.md) | Modul-Inventar, Per-Window-State-Design, Lifecycle-Adapter, Datei-Handler-Registry, daedalOS-Übernahmestatus |
| [`.kilocode/rules/memory-bank/context.md`](./.kilocode/rules/memory-bank/context.md) | laufend gepflegter Änderungsverlauf und aktueller Stand |
| [`supabase/anvil-graph/README.md`](./supabase/anvil-graph/README.md) | DRAGHUBs Eintrag im geteilten ANVIL System Graph (Supabase) und wie er inkrementell erweitert wird |

Bei Widersprüchen gelten die neuesten verbindlichen Spezifikationen und `PLAN.md` — nicht ältere PR-Beschreibungen oder Agentenberichte.

---

## Bekannte offene Punkte

- ZIP/Archiv-Viewer (Mini-Explorer im Fenster, mit Path-Traversal-, Größen- und Zip-Bomb-Limits)
- volle Tree-View als eigenes Fenster; Repository-Galerie als globaler Launcher
- Local Tool Broker für die Übergabe an native Windows-Programme
- UI-Polish und konsistente responsive Bedienung
- Vereinheitlichung des älteren Upload-Pfads mit dem Working-Changes-Modell
- vollständige Overlay-Darstellung auch in der Ordner-Hauptansicht
- belastbare Produktions-Authentifizierung
- weitere Zerlegung großer zentraler Module
- breitere End-to-End-Abdeckung über den bestehenden Playwright-Kern (Open With, Desktop-Shell) hinaus

---

## Entwicklungsprinzipien

1. **Dateien zuerst.** Repository-Werkzeuge dürfen den Datei-Arbeitsraum nicht verdrängen.
2. **Kontext bleibt erhalten.** Keine unnötigen Seitenwechsel für normale Arbeitsabläufe.
3. **Zustand hat einen Besitzer.** Async-Ergebnisse müssen dem gestarteten Repo und Branch gehören.
4. **Änderungen bleiben sichtbar.** Kein stilles Schreiben und kein versteckter Verlust lokaler Arbeit.
5. **GitHub ist ein Adapter, nicht das endgültige Fundament.**
6. **Keine Feature-Versprechen ohne Verifikation.** Implementiert ist nicht automatisch getestet.

---

<div align="center">

### DRAGHUB

**Repositories sollen sich wie Orte anfühlen — nicht wie Seiten, die man ständig verliert.**

</div>

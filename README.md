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

- Repositories verhalten sich wie eigene Arbeitsbereiche.
- Dateien und Ordner bleiben im sichtbaren Projektkontext.
- Mehrere Repositories können parallel geöffnet werden.
- Änderungen werden gesammelt und als **Checkpoint** bestätigt.
- GitHub-Funktionen erscheinen als zusammengehörige Werkzeuge statt als lose Webseiten.

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

### Repository-Arbeitsbereiche

- Mehrere Repositories gleichzeitig öffnen und wechseln
- Repository-eigene Tabs, Auswahl, Verzeichniszustände und Caches
- Branch-Wechsel ohne Vermischung laufender Datei- oder Ordneranfragen
- Dock für geöffnete und angeheftete Repositories
- Repository-Suche und schneller Wechsel zwischen Arbeitsbereichen

### Dateien und Ordner

- Datei- und Ordnernavigation im Explorer
- Neue Dateien und Ordner anlegen
- Umbenennen, löschen und per Drag-and-drop verschieben
- Mehrfachauswahl und Kontextmenüs
- Datei-Tabs mit Drag-Reordering
- In-Browser-Codebearbeitung
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
bun typecheck
bun lint
bun build
```

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
│   ├── app/                 # Next.js-App und Shell
│   ├── components/          # Explorer, Tabs, Viewer und UI-Bausteine
│   ├── features/            # isolierte GitHub- und Workspace-Funktionen
│   └── lib/                 # GitHub-Zugriff, Store, DnD und Kernlogik
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

Bei Widersprüchen gelten die neuesten verbindlichen Spezifikationen und `PLAN.md` — nicht ältere PR-Beschreibungen oder Agentenberichte.

---

## Bekannte offene Punkte

- finales End-to-End-QA der vollständigen Phase 1
- UI-Polish und konsistente responsive Bedienung
- Vereinheitlichung des älteren Upload-Pfads mit dem Working-Changes-Modell
- vollständige Overlay-Darstellung auch in der Ordner-Hauptansicht
- belastbare Produktions-Authentifizierung
- weitere Zerlegung großer zentraler Module
- Tests für kritische Repo-, Branch- und Async-Zustände

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

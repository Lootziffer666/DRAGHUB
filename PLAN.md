# PLAN.md — DRAGHUB-Ausführungsplan

**Status:** revidierter verbindlicher Plan · **Stand:** 2026-07-16 · **Repo:** `Lootziffer666/DRAGHUB`

> [!IMPORTANT]
> Dieser Plan ersetzt die frühere Konsolidierung, soweit sie konkrete Produktanforderungen ausgelassen oder zu früh als erledigt markiert hat. Maintainer-Korrekturen und die neuesten Spezifikationen in `docs/` sind verbindlicher als ältere PR-Beschreibungen, Agentenberichte oder Häkchen in einer früheren Checkliste.

---

## 0. Verbindliche Produktkorrektur

DRAGHUB ist nicht nur ein GitHub-Dateibrowser mit Desktop-Optik.

Es ist ein browser-first GitHub-Arbeitsraum mit:

- Repositories als dauerhaften Arbeitsbereichen beziehungsweise Laufwerken,
- echten Datei-, Editor-, Viewer- und Werkzeugfenstern,
- Working Changes statt stiller Sofort-Mutationen,
- einem funktionalen Papierkorb,
- einer dauerhaft sichtbaren, gruppierten Taskleiste,
- repository-eigenen GitHub-Werkzeugen,
- **FLUBBER als gemeinsamer Interaktionsgrammatik für Phase 1**,
- einer späteren räumlich-gamifizierten Darstellung in Phase 2,
- einem späteren Git-nativen ANVIL Core in Phase 3.

Die frühere Annahme

```text
Desktop-Metapher = Desktop-Skin
```

ist falsch. Die Desktop-Metapher beschreibt Besitz, Zustand, Fenster, Wiederherstellung und räumlichen Kontext. FLUBBER beschreibt, wie Menschen diese Zustände auf Touch, Maus und Tastatur bedienen.

---

## 1. Autorität und Quellen

Dieser Plan muss ohne Chatverlauf ausführbar sein. Daraus folgt:

1. Anforderungen dürfen nicht nur in Gesprächen existieren.
2. Eine technische Teilimplementierung darf einen Milestone nicht automatisch abschließen.
3. Ein Milestone ist erst erledigt, wenn seine vollständigen Akzeptanzkriterien erfüllt und im Browser geprüft wurden.
4. Eine nackte `<textarea>` ist kein abgeschlossener Codeeditor.
5. Ein Repo-Umschalter ist keine vollständige Fensterverwaltung.
6. Ein Delete-Delta ist noch kein vollständiger Papierkorb.
7. Browser-Long-Press als simulierter Rechtsklick ist noch kein FLUBBER.

Verbindliche ergänzende Spezifikationen:

- `docs/DRAGHUB_BUILD_SPEC.md`
- `docs/MULTI_REPO_WINDOW_DOCK_SPEC.md`
- `docs/GITHUB_DESKTOP_SHELL_SPEC.md`
- `docs/RUBBER_BAND_WORKSPACE_VIEWER_SPEC.md`

Bei Widersprüchen gilt die neueste explizite Maintainer-Korrektur.

---

## 2. Phasengrenzen

### Phase 1 — funktionaler GitHub-Arbeitsraum

Jetzt zu bauen beziehungsweise zu vervollständigen:

- Dateioperationen und Working Changes,
- echter Editor,
- FLUBBER als 2D-/Mobile-Interaktionslogik,
- funktionaler Papierkorb,
- Multi-Repo-State,
- Fenster, minimierbare Viewer und gruppierte Taskleiste,
- GitHub-Werkzeuge,
- Grid-/Icon-Ansicht,
- LFS-, Diff- und Konfliktfunktionen.

### Phase 2 — räumlich-gamifizierte Darstellung

Erst nach ausdrücklicher Freigabe:

- begehbare Repositories,
- Dateien und Ordner als Gebäude, Orte oder Infrastruktur,
- Code-City,
- Mobspawns, räumliche Konfliktauflösung und andere Spielmetaphern,
- `viewMode: "city"` und 3D-Renderer.

**Klarstellung:** Mit einer Hand durch ein Repository zu laufen und Inhalte im Bewegungsfluss räumlich zu öffnen gehört zu Phase 2. Die zugrunde liegenden Auswahl-, Bestätigungs-, Abbruch- und Zustandsregeln von FLUBBER gehören bereits zu Phase 1.

### Phase 3 — ANVIL Core

Erst nach ausdrücklicher Freigabe:

- Git als Fundament, GitHub als optionaler Adapter,
- lokaler Dienst für Worktrees, Object Vault und Artifacts,
- Command Queue und Persistence Queue,
- CUE Evidence Ledger,
- mobile Steuerfläche als Auftrag-/Entscheidungsschicht für lokale Ausführung.

---

## 3. FLUBBER — verbindliche Phase-1-Interaktionsschicht

FLUBBER ist **kein Skin, keine Animation und keine Phase-2-Gamification**. Es ist die gemeinsame State-, Gesture- und Feedback-Grammatik von DRAGHUB.

### 3.1 Grundregeln

- Dieselbe logische Aktion hat auf Touch, Maus und Tastatur denselben Zustand und dasselbe Ergebnis.
- Mobile Bedienung darf keine verkleinerte Desktop-Oberfläche sein, die Hover, Rechtsklick oder Präzisionszeiger voraussetzt.
- Long Press ist ein definierter Zustandswechsel der jeweiligen Oberfläche, nicht pauschal ein künstliches `contextmenu`-Event.
- Jede erkannte Geste erhält sofort sichtbares Feedback; Haptik kann verwendet werden, wo sie verfügbar ist.
- Begonnene Interaktionen dürfen durch Scrollen, Tabwechsel oder kleine Fingerbewegungen nicht still verloren gehen.
- Destruktive Aktionen bleiben bis zur ausdrücklichen Bestätigung reversibel.
- Primäre Aktionen müssen einhändig erreichbar sein; sekundäre Aktionen dürfen keine dauerhaft sichtbare Button-Flut erzeugen.
- Jede Touch-Aktion besitzt eine zugängliche Tastatur-/Maus-Entsprechung.

### 3.2 Gemeinsame Interaktionszustände

Komponenten sollen nicht jeweils eigene, inkompatible Gesten erfinden. Sie verwenden mindestens diese semantischen Zustände:

```text
idle
→ armed
→ selecting | dragging | action-pending
→ confirmed | cancelled
```

Die Darstellung darf je Oberfläche variieren, die Bedeutung nicht.

### 3.3 Verbindliche mobile Textauswahl

Für lange Dateien muss zusätzlich zur nativen Browserauswahl der FLUBBER-Auswahlmodus existieren:

```text
Long Press 1
→ Startpunkt der Auswahl setzen
→ sichtbarer Auswahlmodus

frei durch die Datei scrollen
→ Startpunkt bleibt erhalten

Long Press 2
→ Endpunkt setzen
→ Bereich markieren
→ verschiebbare Anfangs- und Endgriffe anzeigen
```

Pflichtverhalten:

- Das Ende darf vor dem Anfang liegen; die Auswahl wird korrekt normalisiert.
- Scrollen zwischen beiden Long Presses darf die Auswahl nicht abbrechen.
- Zurück/Escape beziehungsweise eine sichtbare Abbrechen-Aktion beendet den Modus ohne Textänderung.
- Nach Abschluss stehen mindestens Kopieren, Ausschneiden, Ersetzen und „als Kontext verwenden“ zur Verfügung, sofern die jeweilige Oberfläche diese Aktion unterstützt.
- Native Auswahl bleibt als Fallback erhalten.

### 3.4 Abgrenzung zu Phase 2

Phase 1 implementiert die Zustände und Gesten in der normalen 2D-Oberfläche. Phase 2 darf dieselben Verträge räumlich darstellen, aber keine zweite, inkompatible Bedienlogik einführen.

---

## 4. Zustandsmodell

Der sichtbare Arbeitszustand ist:

```text
Basis-Commit
+ neue Dateien
+ Edits
+ Umbenennungen und Verschiebungen
+ vorgemerkte Löschungen
= aktueller Workspace
```

UI-Vokabular:

| Git-Begriff | DRAGHUB-Begriff |
|---|---|
| Commit | Checkpoint |
| Branch | Variante / Arbeitsraum |
| Diff | Änderungsschicht |
| Revert | Zustand zurückholen |
| Worktree | parallel geöffnete Variante |

Keine normale Dateioperation erzeugt ungefragt einen Sofort-Commit.

---

## 5. Phase-1-Milestones

Ein Milestone ist nur abgeschlossen, wenn Typecheck/Lint, browserbasiertes End-to-End-QA und sämtliche Akzeptanzkriterien erfüllt sind.

### M1 — Explorer-CRUD

- Neue Datei und neuer Ordner.
- Automatische, versteckte `.gitkeep`-Behandlung für leere Ordner.
- Umbenennen und Verschieben.
- Löschen erzeugt zunächst einen reversiblen Working Change.
- Drag-and-drop innerhalb des Repositories.
- Hauptansicht und Explorer verwenden dieselbe Overlay-Quelle aus Basis plus Deltas.

**Akzeptanz:** Kein Datei- oder Ordnerzustand unterscheidet sich zwischen Sidebar und Hauptansicht.

### M2 — Working Changes, Checkpoints und Papierkorb

- Alle Änderungsquellen verwenden denselben Changeset-Pfad: Editor, Upload, Rename, Move, Delete und spätere Agentenänderungen.
- Änderungen können einzeln oder gemeinsam verworfen und bestätigt werden.
- „Checkpoint erstellen“ schreibt das bestätigte Changeset als zusammenhängenden Git-Zustand.

#### Papierkorb

Der Papierkorb ist eine eigene funktionale Ansicht, nicht nur ein Delete-Badge.

- Gelöschte, noch nicht eingecheckte Dateien und Ordner erscheinen im Papierkorb.
- Einträge zeigen Ursprungspfad, Repo, Variante, Löschzeit und Änderungsquelle.
- Wiederherstellen setzt den Eintrag an den Ursprungspfad zurück oder fordert bei einem Konflikt ein neues Ziel an.
- „Papierkorb leeren“ zeigt eine vollständige Zusammenfassung und verlangt Bestätigung.
- Nach einem bereits erstellten Checkpoint bedeutet Wiederherstellen eine neue Änderungsschicht; die Historie wird nicht umgeschrieben.
- Repository-Dateien und bloße Desktop-Verknüpfungen dürfen nicht verwechselt werden. „Verknüpfung entfernen“ löscht niemals das Repository.

**Akzeptanz:** Upload und manuelle Änderungen besitzen keinen parallelen Commit-Pfad; Löschungen sind bis zur bestätigten endgültigen Aktion sichtbar und wiederherstellbar.

### M3 — In-Browser-Code- und Texteditor

**Statuskorrektur:** Der derzeitige Edit-Modus ist nur ein erster primitiver Schritt. Eine `<textarea>`, die einen Delta-Eintrag speichert, erfüllt M3 nicht.

#### M3a — vorhandene Basis

- Dateiinhalt kann verändert werden.
- „Save delta“ legt den Inhalt als Working Change ab.
- Reset auf den geladenen Inhalt ist möglich.
- Konfliktmarker können erkannt werden.

M3a bleibt erhalten, ist aber nicht die Abnahme von M3.

#### M3b — noch verbindlich umzusetzen

Ein echter Editor, vorzugsweise CodeMirror 6 oder eine gleichwertige Engine, mit:

- Syntax-Highlighting im Edit-Modus,
- Zeilennummern,
- Suchen und Ersetzen,
- korrektem Tab-/Einrückungsverhalten,
- Klammerpaarung und grundlegender Sprachunterstützung,
- Undo/Redo mit verlässlichem Verlauf,
- `Ctrl/Cmd+S` zum Ablegen als Working Change,
- Dirty-State am Dateitab,
- Warnung beziehungsweise sichere Wiederherstellung beim Schließen, Repo-Wechsel oder Reload,
- Erhalt von Cursor, Auswahl und Scrollposition bei normalen Ansichtswechseln,
- Markdown-Rendering und optionaler Split-Preview für Markdown-Dateien,
- FLUBBER-Textauswahl gemäß §3.3,
- zugänglicher Tastatur-, Maus- und Touch-Bedienung,
- Schutz vor ungefragtem Laden oder Editieren ungeeignet großer Dateien.

Das Editieren eines historischen Refs muss „neue Variante abzweigen“ anbieten, statt den Nutzer in eine Sackgasse zu schicken.

**Akzeptanz M3:**

1. Eine Datei lässt sich auf Desktop und Mobile bearbeiten, suchen, ersetzen und als Delta sichern.
2. Ungesicherter Inhalt geht bei Tab-, Fenster- oder Repo-Wechsel nicht still verloren.
3. Der exakt in §3.3 beschriebene mobile Auswahlablauf funktioniert über mehrere Bildschirmseiten.
4. Markdown kann als gerendertes Dokument betrachtet werden; „Preview“ bedeutet nicht bloß Rückkehr zur Rohtextansicht.
5. Speichern erzeugt keinen Sofort-Commit.
6. Eine nackte Textarea gilt ausdrücklich nicht als abgeschlossener Milestone.

### M4 — LFS und Großdateien

- LFS-Pointer erkennen und verständlich anzeigen.
- Große Dateien nicht ungefragt vollständig laden.
- On-Demand-Download mit Fortschritt und Abbruch.
- Dateitypabhängige Viewer statt reiner Download-Links.

### M5 — Liste, Icons und räumliches Layout

- Listen- und Icon-/Grid-Ansicht.
- Persistente Snap-to-Grid-Positionen pro Repo, Variante und Ordner.
- Bild-Thumbnails, auch für noch nicht eingecheckte lokale Bilder.
- `viewMode: "city"` bleibt deaktivierte Erweiterungsstelle für Phase 2.

### M6 — Konfliktauflösung

- Konflikt-Hunks strukturiert parsen.
- Side-by-side beziehungsweise gleichwertige visuelle Auflösung.
- Ours/Theirs/Both pro Hunk.
- Ergebnis als normales Delta in M2.

Ein bloßer Konfliktbanner plus manuelles Editieren erfüllt M6 nicht vollständig.

### M7 — Pull Requests und Issues

- Repository-eigene Fenster oder Child-Windows.
- Listen, Filter, Status, Checks, Reviews und nachvollziehbare Aktionen.
- Keine Verdrängung des Datei-Workspaces.
- PR-Klassifikation bleibt datengetrieben und Phase-2-kompatibel.

### M8 — Multi-Repo-Workspaces

- Zustand pro Repository und Variante.
- Mehrere Repositories gleichzeitig offen.
- Auswahl, Tabs, Caches und laufende Requests vermischen sich nicht.
- Öffnen eines zweiten Repositories zerstört den ersten Workspace nicht.

Der vorhandene Multi-Repo-State ist Grundlage; unabhängige Fenster gehören zusätzlich zur Desktop-Shell-Abnahme in §6.

### M9 — Dock und gruppierte Taskleiste

- Gepinnte Repositories und schneller Workspace-Wechsel.
- Dauerhaft sichtbare Taskleiste für offene und minimierte Fenster.
- Gruppierung nach Repository, Anwendung und Dokument statt Icon-Flut.
- Minimieren, Wiederherstellen, Fokus und Fensterstatus.
- Rate-Limit-Budget sichtbar und Polling pausiert bei inaktivem Dokument.

Ein einfacher Repo-Umschalter oder eine Buttonleiste erfüllt M9 nicht vollständig.

### M10 — Systemsteuerung

- Security, Access, Branch Rules und CODEOWNERS.
- Fehlende Berechtigungen sichtbar erklären statt Funktionen zu verstecken.
- Repository-Einstellungen und globale DRAGHUB-Einstellungen klar trennen.

### M11 — Startmenü und GitHub-Werkzeuge

- Codespaces, Releases, Packages und Wiki-Grenze.
- GitHub-Funktionen über ein datengetriebenes Registry-Modell.
- Jede Funktion erklärt auf Wunsch Zweck, Status, Berechtigungen und erste sinnvolle Aktion.
- Öffnen erzeugt/fokussiert ein repository-eigenes Werkzeugfenster; kein unnötiger Seitenwechsel.

### M12 — Triage

- Einzel- und Mehrfachauswahl.
- Bulk-Aktionen mit vollständiger Vorschau.
- Irreversible Aktionen verlangen explizite Bestätigung.
- Tastatur- und touch-taugliche Bedienung nach FLUBBER-Regeln.

---

## 6. Verbindliche Desktop-Shell-Abnahme für Phase 1

Die Spezifikationen aus `docs/MULTI_REPO_WINDOW_DOCK_SPEC.md`, `docs/GITHUB_DESKTOP_SHELL_SPEC.md` und `docs/RUBBER_BAND_WORKSPACE_VIEWER_SPEC.md` sind kein Phase-2-Skin.

Phase 1 benötigt mindestens:

- dauerhaften Desktop-Root mit Wallpaper,
- Repository-Laufwerke beziehungsweise Verknüpfungen,
- Papierkorb und globale Settings,
- bewegliche, fokussierbare und minimierbare Fenster,
- gruppierte Taskleiste,
- repository-eigene Child-Windows,
- Rubber Band für angedockte GitHub-Werkzeuge,
- Datei- und Ordneransichten im Repository-Fenster,
- Bild-Thumbnails,
- minimierbaren Viewer mit Zoom, Pan und Navigation,
- keine normale Dateiaktion als erzwungenen Seitenwechsel.

Diese Schicht verwendet FLUBBER in 2D. Die begehbare Welt bleibt Phase 2.

---

## 7. Phase 2 — nur nach Freigabe

Phase 2 rendert vorhandene Zustände anders, statt die Kernlogik neu zu bauen:

| Phase-1-Vertrag | Phase-2-Darstellung |
|---|---|
| Dateiaktivität und Layout | 3D-Code-City, Gebäudezustand und Verfall |
| PR-Klassifikation | verständliche Figuren oder Ereignisse |
| Konflikt-Hunks | räumliche Konfliktauflösung |
| Domain Events | Animation, Sound und Partikel |
| FLUBBER-Zustände | Navigation und Aktionen im Bewegungsfluss |
| `viewMode` | additiver `city`-Renderer |

Nicht vor Freigabe bauen: Three.js/WebGPU-Szene, Spiel-Loop, begehbare Repositories, Multiplayer oder räumliche Suchwelten.

---

## 8. Phase 3 — ANVIL Core, nur nach Freigabe

```text
DRAGHUB Surface
      ↓
menschliches Zustandsmodell
      ↓
ANVIL Core
├── Git Object Store
├── Layered State Engine
├── Object Vault
├── Artifact Store
├── Command Queue
├── Persistence Queue
├── CUE Evidence Ledger
└── Adapter
    ├── GitHub
    ├── lokales Homelab
    └── weitere Git-Remotes
```

GitHub bleibt dauerhaft als direkter Modus beziehungsweise Adapter nutzbar. Phase 3 darf Phase 1 nicht brechen.

---

## 9. Engineering-Regeln

- Neue isolierbare Fähigkeiten nach `src/features/<feature>/`.
- Zentralen Store nicht beiläufig weiter aufblasen; Verhalten vor Extraktion durch Tests absichern.
- Async-Ergebnisse gehören immer zu Repo, Variante und Request, von denen sie gestartet wurden.
- Keine stillen Datenverluste und keine vorgetäuschten Erfolgszustände.
- Destruktive Aktionen benötigen Vorschau, Bestätigung und soweit möglich Wiederherstellung.
- `bun typecheck`, `bun lint` und `bun build` vor größeren Merges.
- Reine Logik mit `bun test` prüfen.
- Touch-Abläufe auf einem echten mobilen Browser testen; Desktop-Responsive-Ansicht reicht nicht.
- Ein Milestone-Haken darf erst nach Prüfung sämtlicher Akzeptanzkriterien gesetzt werden.

---

## 10. Aktueller Status

Legende:

- `[x]` vollständig nach aktuellem Vertrag abgenommen
- `[ ]` offen oder nur teilweise umgesetzt

- [x] M1 — Explorer-CRUD-Grundlage
- [ ] M2 — Working Changes vollständig vereinheitlichen und funktionalen Papierkorb fertigstellen
- [ ] M3 — echter Code-/Texteditor; derzeit nur M3a-Textarea/Delta vorhanden
- [ ] M4 — LFS-/Großdatei- und Viewer-Akzeptanz vollständig prüfen
- [ ] M5 — persistente Icon-Ansicht, Thumbnails und Layout vollständig abnehmen
- [ ] M6 — vollständige visuelle Konfliktauflösung
- [ ] M7 — PR-/Issues-Fenster gegen vollständige Akzeptanz prüfen
- [x] M8 — Multi-Repo-State-Grundlage
- [ ] M9 — echte Fensterverwaltung, Minimieren und gruppierte Taskleiste
- [ ] M10 — vollständige Systemsteuerung
- [ ] M11 — Startmenü, Feature Registry und repository-eigene Werkzeugfenster
- [ ] M12 — vollständige Triage-Abnahme
- [ ] Phase-1-Querschnitt — FLUBBER in Explorer, Editor, Changes, Diff, Papierkorb und Fenstern
- [ ] Phase-1-Querschnitt — Desktop-Shell-Abnahme gemäß §6
- [ ] Phase-2-Freigabe durch Maintainer
- [ ] Phase-3-Freigabe durch Maintainer

**Phase 1 ist damit ausdrücklich nicht abgeschlossen.**

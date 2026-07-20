# DRAGHUB — Plan Correction Record

**Status:** verbindlicher Korrektur- und Verlaufsnachweis  
**Stand:** 2026-07-16  
**Geltungsbereich:** DRAGHUB Phase 1 bis Phase 3  

> Dieses Dokument ersetzt `PLAN.md` nicht. Es hält fest, welche Anforderungen bei der bisherigen Planübertragung verloren gingen, welche Aussagen durch die Git-Historie belegt sind, welche Korrekturen verbindlich sind und welche Planänderung irrtümlich zu weit ging. Eine spätere Änderung von `PLAN.md` muss diese Punkte als kleinen, nachvollziehbaren Zusatzdiff übernehmen und darf den bestehenden GitHub-Produktvertrag nicht erneut komplett umschreiben.

---

## 1. Anlass

Der bisherige Ausführungsplan wurde aus dem damaligen Repository-Zustand und elf Markdown-Dateien im Root konsolidiert. Sieben der später gelöschten `markDown…`-Dateien waren nach Aussage des Maintainers zuvor formulierte Anweisungen beziehungsweise Ausarbeitungen für Claude.

Bei der Prüfung stellte sich heraus:

- Die Dateien enthielten umfangreiche Architekturgedanken zu ANVIL, Git-Zuständen, Object Vault, Agentenläufen, Mobile/Rechner/NAS und Live Contract Preview.
- Die zuvor besprochene mobile Interaktionssprache **FLUBBER** war darin bereits nicht mehr vollständig enthalten.
- Claude konnte deshalb nur das konsolidieren, was in diesem bereits beschnittenen Eingabepaket stand.
- Der Verlust geschah damit wahrscheinlich vor oder während der Übergabe an Claude, nicht erst bei der späteren Implementierung.

Die Git-Historie kann den früheren Chatinhalt und eine mündliche Freigabe nicht beweisen. Sie belegt jedoch eindeutig, dass FLUBBER im zusammengeführten Plan und in der ersten Implementierung nicht als eigener Vertrag vorhanden war.

---

## 2. Belegbare Entwicklung

### 2.1 Erster tatsächlicher DRAGHUB-Build

Der erste produktbezogene Commit war:

- `f35a8b4995ffd7710ae4e2fe4dc79fa4d3019e08`
- **Build GitHub Browser with desktop UX: tabs, context menus, drag & drop, touch**

Die damalige Touch-Unterstützung bestand im Wesentlichen aus:

- Tippen zum Öffnen,
- Long Press als simuliertes Kontextmenü,
- Abbruch des Long Press bei stärkerer Fingerbewegung.

Das war normale Touch-Anpassung einer Desktop-/Browser-UI. Es war keine ausgearbeitete FLUBBER-Steuerung und keine zweistufige mobile Textauswahl.

### 2.2 Konsolidierung in `PLAN.md`

PR #1:

- erstellt am 2026-07-14,
- Titel: **Add comprehensive execution plan (PLAN.md) for GitHub Browser roadmap**,
- konsolidierte die vorhandenen Markdown-Dateien in einen Plan.

Der Plan trennte:

1. Phase 1 — erweiterter GitHub Browser,
2. Phase 2 — spätere Gamification,
3. Phase 3 — späterer ANVIL Core.

FLUBBER wurde dabei nicht als Phase-1-Vertrag aufgenommen. Die Editorwahl blieb ausdrücklich offen. Ein funktionaler Papierkorb war kein eigener Phase-1-Meilenstein.

### 2.3 Spätere Wiederaufnahme einzelner Anforderungen

PR #4:

- Titel: **docs: define GitHub desktop, Rubber-Band workspaces, viewers and grouped Taskbar**,
- Dokumentationsänderung, keine vollständige Implementierung.

Dieser PR führte unter anderem wieder ausdrücklich ein:

- Desktop-Shell,
- gruppierte Taskbar,
- Viewer,
- Settings,
- Recycle Bin.

Damit wurde ein Teil des ursprünglichen Produktumfangs wieder als Spezifikation sichtbar, aber noch nicht vollständig gebaut.

### 2.4 Zu frühe Abnahme

PR #6:

- Titel: **Multi-repo workspace refactor, add PR/Issues/Triage/Dock/ControlPanel/StartMenu features, LFS, editor & merge primitives**.

Dort wurde ein sehr einfacher Edit-Modus in `FileView.tsx` ergänzt und M3 anschließend als erledigt markiert.

Der aktuelle Editor ist im Kern weiterhin eine rohe `<textarea>` mit Edit/Preview-Umschaltung und Speicherung als Delta. Das ist eine brauchbare Basis, aber kein vollständig abgenommener Code- und Texteditor.

---

## 3. Verbindliche Phasentrennung

### Phase 1 — GitHub-Client und normale 2D-Oberfläche

DRAGHUB bleibt in Phase 1 ein **browser-first GitHub-Arbeitsraum**. Die Anwendung spricht weiterhin mit GitHub und bildet GitHub-Repositories, Dateien, Änderungen, Pull Requests, Issues und weitere GitHub-Funktionen in einer Desktop-artigen Arbeitsoberfläche ab.

Phase 1 umfasst außerdem die nicht-gamifizierte Grundlage von FLUBBER:

- mobile Bedienlogik statt bloßem Rechtsklick-Ersatz,
- einhändig erreichbare Kernaktionen,
- konsistente Zustände und Gesten in Explorer, Editor, Changes, Diff, Papierkorb und Fenstern,
- klares Feedback für Beginn, Fortsetzung, Abschluss und Abbruch einer Interaktion,
- unveränderte Desktop-Bedienbarkeit mit Maus und Tastatur.

### Phase 2 — räumliche und gamifizierte Darstellung

Erst Phase 2 umfasst die räumliche Übersetzung:

- durch Repositories laufen,
- Dateien und Ordner als Orte, Gebäude oder räumliche Strukturen,
- Kontexte und Werkzeuge entlang der Bewegung öffnen,
- vorhandene Phase-1-Zustände in einer begehbaren Darstellung wiederverwenden.

Phase 2 darf keine zweite inkompatible Bedienlogik erfinden. Sie baut auf den Zuständen und Interaktionsverträgen von Phase 1 auf.

### Phase 3 — optionaler Git-nativer ANVIL Core

Phase 3 bleibt ein gesondertes späteres Tool beziehungsweise ein optionaler Unterbau im selben Repository.

Es gilt ausdrücklich:

```text
Phase 1: DRAGHUB = GitHub-Client
Phase 2: GitHub-Client + räumliche Darstellung
Phase 3: optionaler zusätzlicher Git-nativer ANVIL Core
```

Phase 3 ersetzt Phase 1 nicht rückwirkend. Der direkte GitHub-Modus muss erhalten bleiben. GitHub wird nicht im aktuellen Browserplan beiläufig durch lokales Git ersetzt.

---

## 4. FLUBBER — derzeit sicher rekonstruierter Phase-1-Vertrag

FLUBBER ist in Phase 1 keine 3D-Welt und kein Skin. Es ist die gemeinsame mobile beziehungsweise geräteübergreifende Interaktionsgrammatik.

### 4.1 Sichere Mindestanforderungen

- Long Press darf nicht überall pauschal in einen simulierten Rechtsklick übersetzt werden.
- Gesten müssen abhängig vom aktiven Kontext und Zustand ausgewertet werden.
- Ein begonnener Vorgang muss während normalem Scrollen oder Navigieren erhalten bleiben, sofern kein ausdrücklicher Abbruch erfolgt.
- Desktop-Maus- und Tastaturverhalten bleiben erhalten und werden nicht durch Touch-Sonderlogik beschädigt.
- Native Browser-/OS-Bedienung bleibt als Fallback verfügbar, wenn eine eigene Interaktion nicht zuverlässig unterstützt wird.

### 4.2 Verbindliche mobile Textauswahl

Der bisher rekonstruierte Ablauf lautet:

```text
Long Press 1
→ Auswahlstart festlegen
→ frei durch das Dokument scrollen
→ Long Press 2
→ Auswahlende festlegen
→ Auswahl mit verschiebbaren Griffen nachjustieren
```

Anforderungen:

- Die Auswahl kann über mehrere Bildschirmseiten reichen.
- Scrollen zwischen Start und Ende darf die begonnene Auswahl nicht löschen.
- Vorwärts- und Rückwärtsauswahl müssen funktionieren.
- Nach Festlegung beider Enden erscheinen bedienbare Auswahlgriffe.
- Kopieren, Ausschneiden und Ersetzen müssen anschließend möglich sein.
- Abbruch und Zurücksetzen müssen eindeutig sein.
- Die Umsetzung darf nicht darauf beruhen, dass native OS-Auswahlgriffe programmgesteuert erzwungen werden können. Bei Bedarf sind eigene Griffe auf Basis der Editorpositionen zu verwenden.

### 4.3 Technische Grundlage

Eine rohe `<textarea>` ist für präzise Koordinaten-zu-Zeichen-Abbildung, mehrseitige Auswahl, eigene Griffe und kontrollierte Touch-Zustände unnötig fragil.

Für M3 ist deshalb ein echter Editor wie **CodeMirror 6** oder eine gleichwertige Engine die vorgesehene Grundlage. Die FLUBBER-Auswahl wird auf Dokumentpositionen des Editors aufgebaut, nicht als zusätzlicher Hack um eine Textarea.

---

## 5. M3 — korrigierter Status

### M3a — vorhandene Basis

Vorhanden beziehungsweise teilweise vorhanden:

- Dateiinhalt kann im Browser verändert werden.
- Speichern legt einen Working Change beziehungsweise Delta-Eintrag an.
- Reset auf den geladenen Inhalt ist möglich.
- Ein einfacher Edit/Preview-Wechsel existiert.

M3a ist eine Vorstufe. Sie erfüllt M3 nicht vollständig.

### M3b — weiterhin offen

Ein abnahmefähiger Editor benötigt mindestens:

- echte Editor-Engine, vorzugsweise CodeMirror 6,
- Syntax-Highlighting im Edit-Modus,
- Zeilennummern,
- Suchen und Ersetzen,
- korrektes Tabulator- und Einrückungsverhalten,
- Klammerpaarung und grundlegende Sprachunterstützung,
- Undo/Redo mit verlässlichem Verlauf,
- `Ctrl/Cmd+S` zum Ablegen als Working Change,
- Dirty-State im Dateitab,
- Schutz vor stillem Verlust bei Tab-, Fenster-, Repo-Wechsel und Reload,
- Erhalt von Cursor, Auswahl und Scrollposition bei normalen Ansichtswechseln,
- gerenderte Markdown-Vorschau, optional als Split View,
- FLUBBER-Textauswahl über mehrere Bildschirmseiten,
- zugängliche Tastatur-, Maus- und Touch-Bedienung,
- Schutz vor ungefragtem Laden oder Editieren ungeeignet großer Dateien,
- beim Editieren historischer Refs die Möglichkeit, eine neue Variante abzuzweigen.

**Eine nackte Textarea gilt ausdrücklich nicht als abgeschlossener Milestone M3.**

---

## 6. Papierkorb — verbindliche Produktanforderung

Der Papierkorb ist keine bloße Trash-Schaltfläche und kein anderes Wort für ein Delete-Delta.

Er benötigt eine eigene funktionale Ansicht beziehungsweise einen eigenen Zustand:

- noch nicht eingecheckte Löschungen erscheinen als Einträge,
- Einträge sind dem korrekten Repository und der korrekten Variante zugeordnet,
- Ursprungspfad und Löschzustand bleiben nachvollziehbar,
- Wiederherstellung an den Ursprungspfad ist möglich,
- bei Pfadkonflikten wird ein neues Ziel verlangt,
- endgültiges Verwerfen beziehungsweise Leeren benötigt eine Zusammenfassung und ausdrückliche Bestätigung,
- nach einem bereits erstellten Checkpoint erzeugt Wiederherstellen eine neue Änderungsschicht; die Git-Historie wird nicht heimlich umgeschrieben,
- das Entfernen einer Desktop-Verknüpfung darf niemals das Repository löschen.

---

## 7. Fehler beim ersten Korrekturversuch

Auf Wunsch, den Plan zu reparieren, wurde `PLAN.md` am 2026-07-16 mit Commit

- `5047470a730ac2843236e7d99f236b55190c9845`
- **docs: restore FLUBBER and correct Phase 1 acceptance**

nahezu vollständig ersetzt.

Das war falsch, obwohl einzelne neue Anforderungen inhaltlich sinnvoll waren. Statt eines gezielten Zusatzdiffs wurde der bestehende 405-Zeilen-Plan als Ganzes neu formuliert. Dadurch wurde die Grenze zwischen aktuellem GitHub-Client und späterem Git-nativen ANVIL Core unsauber.

Der ursprüngliche GitHub-first-Plan wurde deshalb mit Commit

- `2bebc080e63f5e4fd79a62be81ad9c3c3b54da9e`
- **docs: restore original GitHub-first execution plan**

wiederhergestellt.

Dabei wurde kein Anwendungscode auf lokales Git umgebaut. Betroffen war ausschließlich die Plan-Dokumentation.

---

## 8. Regeln für die nächste `PLAN.md`-Korrektur

Die nächste Anpassung von `PLAN.md` muss:

1. den bestehenden GitHub-first-Plan als Basis behalten,
2. FLUBBER als Phase-1-Querschnitt ergänzen,
3. die räumliche Repo-Welt eindeutig Phase 2 zuordnen,
4. M3 auf teilweise umgesetzt beziehungsweise offen setzen,
5. M3a und M3b klar trennen,
6. den funktionalen Papierkorb in Phase 1 verbindlich machen,
7. zu früh gesetzte Häkchen korrigieren,
8. Phase 3 weiterhin als getrennten optionalen Git-nativen Unterbau behandeln,
9. keine sonstigen Abschnitte ohne zwingenden Grund neu schreiben,
10. vor dem Commit einen Diff zeigen, der genau diese begrenzten Änderungen nachvollziehbar macht.

---

## 9. Schutzregeln für ausführende Agenten

- Kein kompletter Rewrite eines Plans, einer Spezifikation oder zentralen Datei, wenn nur Ergänzungen verlangt wurden.
- Keine Löschung oder Kompression bestehender Anforderungen ohne ausdrückliche Freigabe.
- Keine Gleichsetzung von „vorhandener UI“ mit „Milestone vollständig abgenommen“.
- Keine Behauptung, Phase 1 sei abgeschlossen, solange offene Akzeptanzkriterien bestehen.
- Keine Vermischung von Phase 1, Phase 2 und Phase 3.
- Keine eigenmächtige Ablösung von GitHub durch Git im aktuellen Produkt.
- Repository-Evidenz und Maintainer-Erinnerung müssen getrennt benannt werden: Git kann zeigen, was eingecheckt oder ausgelassen wurde; es kann nicht nachträglich den Inhalt eines nicht archivierten Chats beweisen.

---

## 10. Aktueller verbindlicher Befund

```text
FLUBBER war Teil der besprochenen mobilen Bedienidee,
stand aber nicht vollständig im an Claude übergebenen Markdown-Paket.

Der konsolidierte Plan nahm FLUBBER deshalb nicht als Phase-1-Vertrag auf.

Die erste Implementierung bot nur normale Touch-Anpassungen,
insbesondere Long Press als Kontextmenü.

M3 wurde mit einer primitiven Textarea zu früh als erledigt markiert.

Der funktionale Papierkorb war im Plan nicht ausreichend verankert
und wurde später nur in Spezifikationen wieder eingeführt.

Die räumlich begehbare Repository-Welt gehört zu Phase 2.

Phase 1 bleibt ein GitHub-Client.
Phase 3 bleibt ein späterer optionaler Git-nativer Unterbau.
```

Dieses Dokument dient als dauerhafter Nachweis, damit dieselben Anforderungen beim nächsten Agenten- oder Planübergang nicht erneut verloren gehen.
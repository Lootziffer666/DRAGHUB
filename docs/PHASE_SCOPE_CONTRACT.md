# DRAGHUB — Verbindlicher Phasenvertrag

**Status:** verbindliche Maintainer-Vorgabe  
**Stand:** 2026-07-16  
**Geltungsbereich:** gesamte weitere Planung und Umsetzung von DRAGHUB

> Dieser Vertrag ist eine direkte Maintainer-Korrektur und hat bei der Zuordnung von Anforderungen zu Phase 1, Phase 2 oder Phase 3 Vorrang vor älteren Planformulierungen, PR-Beschreibungen, Agentenzusammenfassungen und früheren Milestone-Häkchen.

---

## 1. Grundregel

Alles, was im zugehörigen Produktgespräch besprochen wurde, gehört zu **Phase 1**, sofern es nicht ausdrücklich eine der beiden folgenden Kategorien betrifft:

1. ein **spielbares, räumlich oder gamifiziert dargestelltes Repository**,
2. den **Git-nativen Unterbau** beziehungsweise die Entkopplung von GitHub.

Formal:

```text
Phase 1 = alle besprochenen DRAGHUB-Funktionen
          minus spielbares Repository
          minus Git-nativer Unterbau

Phase 2 = spielbares / räumlich-gamifiziertes Repository

Phase 3 = Git-nativer Unterbau und GitHub-Entkopplung
```

Diese Regel ist absichtlich weit gefasst. Anforderungen dürfen nicht deshalb in eine spätere Phase verschoben werden, weil sie ungewöhnlich, umfangreich, mobil, interaktiv, visuell oder schwerer umzusetzen sind.

---

## 2. Phase 1 — vollständiger GitHub-Arbeitsraum

Phase 1 bleibt ein browser-first GitHub-Client und umfasst alle normalen, nicht spielbaren Produktfunktionen aus dem Gespräch.

Dazu gehören insbesondere:

- GitHub-Repositories als dauerhafte Arbeitsbereiche beziehungsweise Laufwerke,
- Multi-Repo-Fenster,
- echte Fensterverwaltung,
- Minimieren, Wiederherstellen und Schließen,
- dauerhaft sichtbare, gruppierte Taskleiste,
- Dock und Startmenü,
- Explorer, Datei- und Ordneroperationen,
- Working Changes und Checkpoints,
- funktionaler Papierkorb,
- Editor und Markdown-Ansicht,
- Bild-Thumbnails und minimierbare Viewer,
- repository-eigene GitHub-Werkzeuge,
- Pull Requests, Issues, Triage, Security, Access, Branch Rules, Releases, Packages, Codespaces und Wiki-Zugänge,
- Rubber-Band-Arbeitsbereiche,
- Mobile- und Touch-Bedienung,
- FLUBBER als gemeinsame Interaktionsgrammatik,
- das `.dh`- beziehungsweise DHF-Dateiformat,
- alle weiteren im Gespräch beschriebenen nicht spielbaren Bedien-, Datei-, Darstellungs- und Workflow-Funktionen.

Phase 1 ist nicht auf einen Desktop-Skin, einen Dateibrowser oder Standard-Web-UI beschränkt.

---

## 3. `.dh` / DHF gehört zu Phase 1

Das `.dh`- beziehungsweise DHF-Format ist keine Phase-2-Gamification und kein Phase-3-Git-Unterbau.

Es gehört vollständig zu Phase 1.

Der genaue Formatvertrag muss separat rekonstruiert beziehungsweise aus den ursprünglichen Gesprächen übernommen werden. Bis dieser Vertrag vollständig dokumentiert ist, darf kein Agent behaupten, `.dh` beziehungsweise DHF sei umgesetzt, verworfen oder einer späteren Phase zugeordnet.

Mindestens gilt:

- `.dh` ist ein DRAGHUB-eigenes Format,
- es ist Teil der normalen Repository- und Arbeitsraumoberfläche,
- es muss in Planung, Dateierkennung, Editor/Viewer-Zuordnung und Akzeptanzkriterien berücksichtigt werden,
- ein fehlender `.dh`-Vertrag ist eine offene Phase-1-Lücke.

Es dürfen keine weiteren Eigenschaften des Formats erfunden werden, solange sie nicht durch Maintainer-Aussage oder eine wiederhergestellte Spezifikation belegt sind.

---

## 4. FLUBBER gehört zu Phase 1

FLUBBER ist keine spätere optische Gamification-Schicht.

FLUBBER ist die gemeinsame Interaktions-, Zustands- und Bewegungsgrammatik der normalen Phase-1-Oberfläche für:

- Touch,
- Maus,
- Tastatur,
- Mobile,
- Explorer,
- Editor,
- Änderungen,
- Diff,
- Papierkorb,
- Fenster und Viewer.

Die räumliche Darstellung in Phase 2 darf dieselben Verträge verwenden, aber keine zweite inkompatible Bedienlogik erfinden.

---

## 5. Phase 2 — spielbares Repository

Phase 2 beginnt erst dort, wo das Repository selbst als spielbare, begehbare oder gamifizierte Welt dargestellt wird.

Dazu gehören beispielsweise:

- begehbare Repository-Welten,
- Dateien und Ordner als Gebäude oder Orte,
- räumliche Code-City,
- spielartige PR-, Issue- oder Konfliktdarstellungen,
- spielbare Navigation und weitere ausdrücklich gamifizierte Systeme.

Phase 2 ist nicht Voraussetzung für FLUBBER, `.dh`, Mobile-Steuerung, Fensterverwaltung oder andere normale Phase-1-Funktionen.

---

## 6. Phase 3 — Git-nativer Unterbau

Phase 3 betrifft ausschließlich den späteren Git-nativen Unterbau und die optionale Entkopplung von GitHub als zwingendem Fundament.

Dazu gehören insbesondere:

- lokaler Git Object Store,
- Worktrees und Copy-on-Write-Zustände,
- Object Vault,
- Artifact Store,
- Layered-State-Engine,
- Command Queue,
- Persistence Queue,
- CUE Evidence Ledger,
- weitere Git-Remote-Adapter,
- lokaler ANVIL Core beziehungsweise Daemon.

Phase 3 ersetzt Phase 1 nicht. Der direkte GitHub-Modus muss weiterhin funktionsfähig bleiben.

---

## 7. Schutzregeln für Agenten

1. Keine Phase-1-Anforderung darf ohne ausdrückliche Maintainer-Freigabe in Phase 2 oder 3 verschoben werden.
2. „Komplex“, „später leichter“ oder „passt besser zu Gamification“ sind keine gültigen Gründe für eine Verschiebung.
3. Ein Desktop-Skin erfüllt die Desktop-, Fenster- oder FLUBBER-Verträge nicht.
4. Eine rohe `<textarea>` erfüllt M3 nicht.
5. Ein Delete-Badge erfüllt den Papierkorb nicht.
6. Touch-Long-Press als Rechtsklick-Ersatz erfüllt FLUBBER nicht.
7. Ein reservierter Dateityp oder eine bloße Erwähnung erfüllt `.dh`/DHF nicht.
8. Milestones werden nur nach vollständiger Umsetzung und End-to-End-Abnahme als abgeschlossen markiert.
9. Unklare oder verloren gegangene Anforderungen werden als offene Rekonstruktionslücke dokumentiert, nicht erfunden oder still gestrichen.
10. Änderungen an `PLAN.md` müssen klein, nachvollziehbar und auf den betroffenen Vertrag begrenzt bleiben.

---

## 8. Konsequenz für den aktuellen Status

Phase 1 ist ausdrücklich nicht abgeschlossen, solange unter anderem folgende Punkte fehlen oder nicht vollständig abgenommen sind:

- vollständiger M3-Editor,
- FLUBBER-Integration,
- funktionaler Papierkorb,
- vollständige Fenster- und Taskleistenlogik,
- Viewer- und Thumbnail-Verträge,
- vereinheitlichte Working-Changes-Pfade,
- dokumentierter und implementierter `.dh`-/DHF-Vertrag,
- alle weiteren im Gespräch beschriebenen nicht spielbaren Phase-1-Funktionen.

Die Freigabe von Phase 2 oder Phase 3 ändert daran nichts.

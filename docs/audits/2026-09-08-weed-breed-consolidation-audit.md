# Weed Breed – Konsolidierungs-Audit und Lieferstrategie

Stand: 8. September 2026

## Kurzurteil

Weed Breed ist nicht an fehlenden Ideen oder fehlender technischer Substanz gescheitert. Das Projekt ist wiederholt daran gescheitert, dass Architektur, Verträge und Teilfeatures schneller gewachsen sind als ein überprüfbarer Spielkern.

Das heutige Hauptrepository enthält die beste technische Basis: deterministische Simulation, klar getrennte Engine/Façade/Transport-Schichten, validierte Blueprints und umfangreiche Tests. Es ist aber noch kein durchgehend spielbares Produkt. Der namensgebende Zucht-Loop ist im aktuellen Kern praktisch nicht vorhanden; viele Spieleraktionen enden in UI-Stubs; Typecheck, Gesamt-Testlauf und LOC-Gate sind rot.

Die Empfehlung lautet deshalb ausdrücklich: **kein weiterer Reboot und keine horizontale Feature-Erweiterung.** `weedbreed-2re-boot` bleibt der einzige aktive Produktstrang. Aus den übrigen Repositories werden nur nachweislich wertvolle Mechaniken, Inhalte und UX-Muster übernommen. Geliefert wird zuerst ein kleiner, vollständiger Loop von New Game bis zur ersten eigenen F1-Kreuzung.

## 1. Untersuchte Entwicklungsstränge

| Strang | Rolle in der Geschichte | Verwertbarer Kern | Urteil |
| --- | --- | --- | --- |
| `weed-breed-js-zwo` | Früher Node/JS-Simulationsansatz | Geräte, Strains, Tick-Machine, erste Savegame-Struktur | Historische Quelle; kein Testsystem und nur zwei Strains |
| `weed-breed-ui` | Früher separater UI-Ansatz | Dashboard-/Editor-Komponenten und Formularideen | UX-Referenz, nicht als Codebasis übernehmen |
| `weed-breed-js` / `wbzwo` | Ausgebauter JS-Engine-/Server-Strang | Pflanzenwachstum, Klima, Kosten, Replanting, APIs; 56 aktive Tests grün | Gute Mechanikquelle, aber technisch überholt und teilweise dupliziert |
| `weed-breed-ai` | Browsernaher spielbarer Prototyp | New/Save/Load, Facility-CRUD, Pflanzen, HR sowie eine einfache echte Breed-Aktion | Wichtigste Referenz für den Spielerfluss; nur zwei Determinismus-Tests |
| `weebbreed-reboot` | Großer TypeScript-Reboot | Umfangreiche Domänenarbeit, UI-Spezifikation, Content, Zucht-/Terpen-Ideen | Wertvolles Wissensarchiv; 870 Commits in zwölf Tagen und sehr hohe Komplexität |
| `weedbreed-rereboot` / `weed-breed-docs` | Vertrags- und Dokumentkonsolidierung | SEC, DD, TDD, Vision und Datenbestand | Normative Quelle, aber kein Produkt |
| `weedbreed-factory` | Kleiner Browser-Graph-Prototyp | Visuelles Produktionsnetz, Bottleneck-Erklärung, sechs grüne Tests | Gutes UX-Experiment; nicht die Hauptspielarchitektur |
| `weedbreed-flow` | Erweiterung des Factory-Gedankens | Hierarchie, Budgets, Transfers, Workforce-Pools, Plugin-Modell | Ideenquelle; aktueller Testlauf findet seine Tests nicht |
| `weedbreed-2re-boot` | Aktueller SEC-basierter Monorepo-Strang | Beste Engine, Datenvalidierung, Golden Runs, Façade, Telemetrie, aktuelle UI | Einzige sinnvolle Lieferbasis; zuerst stabilisieren und vertikal schließen |
| `weebbreed-reboot-backup` | Legacy-Frontend-ZIP | Nur als Notfall-/Archivreferenz | Nicht aktiv einbeziehen |

## 2. Das konsolidierte Spiel

### 2.1 Spielerfantasie

Der Spieler baut aus einem kleinen Indoor-Grow eine spezialisierte Cannabis-Zuchtfirma. Er kontrolliert Klima und Ressourcen, wählt Sorten und Methoden, reagiert auf Störungen, erntet und verkauft Qualität – und nutzt die besten Pflanzen, um eigene, wiedererkennbare Linien zu züchten.

Der entscheidende Satz lautet:

> **Baue eine Anlage, lerne ihre Umwelt zu beherrschen und erschaffe darin eine Sorte, die besser zu deiner Strategie und deinem Markt passt als ihre Eltern.**

Damit wird „Breed“ vom Add-on zum Meta-Loop und die vorhandene Cultivation-Simulation zu seinem Prüfstand.

### 2.2 Drei ineinandergreifende Loops

1. **Stündlicher Management-Loop**
   - Telemetrie lesen: Temperatur, RH/VPD, PPFD/DLI, CO₂, Feuchte, Kosten.
   - Engpass verstehen: Gerätekapazität, Zeitplan, Ressourcen, Personal oder Krankheit.
   - Eine Entscheidung treffen und deren Wirkung in den nächsten Ticks sehen.

2. **Anbauzyklus**
   - Saat/Steckling und Anbaumethode wählen.
   - Beleuchtung, Klima und Bewässerung konfigurieren.
   - Wachstum, Stress, Gesundheit und Risiken managen.
   - Ernten, trocknen/curen, Qualität bewerten, verkaufen und reinvestieren.

3. **Zucht- und Progressions-Loop**
   - Zwei Eltern nach Traits auswählen.
   - Population erzeugen, Phänotypen unter realen Anlagenbedingungen testen.
   - Nach Zielprofil selektieren: Ertrag, Dauer, Robustheit, Chemotyp/Terpene, Kosten.
   - F1/F2/BX/IBL entwickeln, Linie stabilisieren, benennen und in Marktsegmenten etablieren.

### 2.3 Konsolidierter Systemkatalog

**Für den Kern relevant:**

- Company → Structure → Room → Zone → Plant als räumliche Hierarchie.
- Deterministischer Stundentick mit expliziter Phasenfolge.
- Geräte als kapazitätsbegrenzte, kombinierbare Effekte; Strom wird zu Wärme gekoppelt.
- Strain-spezifische Umweltbänder, Stress → Gesundheit → Wachstum → Qualität.
- Anbaumethoden mit Dichte, Container, Substrat und Bewässerungskompatibilität.
- Harvest, Inventar, Dry/Cure, Qualitätsbewertung und Verkauf.
- Einfache Störungen: Geräteverschleiß sowie zunächst je ein Pest-/Disease-Archetyp.
- Speichern/Laden und reproduzierbare Runs.
- Zucht mit Vererbung, Variation, Population und Selektion.

**Später wertvoll, aber nicht für die erste Lieferung:**

- Vollständige Workforce-Persönlichkeiten, Gehaltsverhandlungen und Kandidatenmarkt.
- 17 Pathogene, tiefe Treatment-Policies und vollständige Wartungsökonomie.
- Plugin-Sandbox, Hot-Reload, Mod-Editor, Terminalmonitor und alternative Transporte.
- Komplexe Transfers/Produktionsgraphen, Forschungssystem und Markenökonomie.
- Voller Terpen-/Wirkungskanon und mehrere Marktsegmente.

## 3. Was technisch bereits belastbar ist

Der Audit-Testlauf im aktuellen Hauptstrang ergab:

- Engine: **103 Testdateien / 517 Tests grün**.
- Façade: **27 Testdateien / 74 Tests grün**.
- Socket-Transport: **5 Testdateien / 14 Tests grün**.
- Golden Master 30 Tage und 200 Tage, Seed-to-Harvest, Geräteketten, Bewässerung/Nährstoffe, Pflanzenstress, Krankheiten, Workforce, Wartung und Kosten besitzen ausführbare Testabdeckung.
- Der Blueprint-Test findet aktuell 3 Container, 3 Methoden, 7 Geräte, 9 Krankheiten, 4 Bewässerungsmethoden, 8 Schädlinge, 5 Strains, 4 Structures, 3 Substrate und 10 Personaldefinitionen.

Diese Basis ist der Grund, warum ein Neustart schädlich wäre. Sie ist ein brauchbares Simulationslabor. Was fehlt, ist die Produktverbindung.

## 4. Wo das Vibe-Coding wiederholt entgleist ist

### 4.1 Horizontaler Ausbau statt vertikalem Spiel

Es wurden viele Systeme nebeneinander implementiert, bevor ein einzelner vollständiger Spielerpfad funktionierte. Im aktuellen UI gibt es Seiten für Dashboard, Structures, Rooms, Zones, Workforce und Strains. Gleichzeitig sind Create Zone, Duplicate Zone, Geräte-Toggle/Remove/Replace, Sow, Harvest und Cull an zahlreichen Stellen noch `console.info("[stub] ...")`.

Folge: Hohe sichtbare Oberfläche, aber wenig Handlungskontinuität. Der Spieler kann Daten betrachten, jedoch den Kernzyklus nicht zuverlässig selbst erzeugen und abschließen.

### 4.2 Der Spieltitel wurde nicht als Priorisierungsfilter benutzt

Eine echte, wenn auch einfache Breed-Aktion existierte bereits im `weed-breed-ai`-Prototyp. Der große Reboot dokumentierte sogar F1/F2/BX/IBL, Populationsselektion und Generationenzeiten. Im aktuellen Hauptstrang findet sich davon kein integrierter Gameplay-Loop.

Stattdessen wurde ein sehr tiefes Workforce-System bis hin zu Persönlichkeitseffekten, Raises, Termination und externem Kandidatenprofil-Fallback gebaut. Das ist solide Simulationsarbeit, beantwortet aber nicht die erste Produktfrage: Warum heißt dieses Spiel Weed Breed?

### 4.3 Verträge wurden zum Produkt-Ersatz

SEC, DD, TDD, ADRs, Task-Kataloge, Changelogs und kuratierte „Final Truth“-Dokumente haben reale Widersprüche beseitigt. Danach wuchsen sie jedoch weiter, obwohl der interaktive Loop nicht geschlossen war. Der ältere Reboot enthält rund 30.000 Markdown-Zeilen, der aktuelle weitere rund 8.000.

Ein Vertrag verhindert Drift nur, wenn ein kurzer Acceptance-Test an ein Spielergebnis gekoppelt ist. Hier validieren viele Tests interne Regeln, ohne zu beweisen, dass ein Mensch vom Startbildschirm bis zur Belohnung gelangt.

### 4.4 Zu hohe Änderungsfrequenz ohne Integrationsruhe

- `weebbreed-reboot`: 870 Commits in zwölf Tagen, an Spitzentagen über 100.
- `weedbreed-2re-boot`: 769 Commits in rund drei aktiven Wochen, davon 333 Merge-Commits und 150 Commit-Betreffzeilen mit „task“.
- `weed-breed-js`: 333 Commits in gut fünf Wochen.

Das Muster begünstigt kleine lokal „fertige“ Aufgaben, aber erschwert regelmäßige Gesamtsystemprüfung, Spieltests und Architekturpflege. Die aktuellen roten Gates sind ein typisches Integrationsresultat davon.

### 4.5 Definition of Done und tatsächliche Gates laufen auseinander

Der aktuelle Vertrag fordert ein CI-Fail ab 700 LOC. Das ausführbare LOC-Gate warnt erst ab 700 und scheitert erst ab 1.200; es zählt außerdem generierte `dist`-Dateien mit. Gleichzeitig liegen produktive Dateien bei 1.164, 1.262, 1.350, 1.569 und 1.822 LOC.

Das führt zu „Governance auf Papier“: Regeln existieren, werden aber nicht früh genug technisch erzwungen. Besonders die großen Dateien konzentrieren genau die Integrationsrisiken – Command Routing, Read Models, Konstanten und UI-Hooks.

### 4.6 Tests messen Komponentenstärke, nicht Release-Fähigkeit

Der aktuelle Gesamt-Testlauf endet trotz über 700 grüner Einzeltests rot:

- Ein UI-Test enthält aktuell einen Syntaxfehler.
- Ein App-Test bleibt im Verbindungs-Ladescreen hängen.
- Der Telemetrie-E2E-Test scheitert an einem nicht auflösbaren Transport-Factory-Export.
- Der Typecheck meldet zahlreiche Zod-Input/Output-, Branded-UUID-, Readonly- und Export-Konflikte.

Ältere Stränge zeigen das Gegenstück: `weed-breed-js` hat einen grünen kleinen Testlauf, überspringt aber unter anderem den Harvest-Langlauftest; `weed-breed-ai` testet nur zwei deterministische Fälle; `weedbreed-flow` findet beim Root-Testlauf keine Tests. „Viele Tests“ und „grün genug“ wurden dadurch mehrfach mit einem lieferbaren Build verwechselt.

### 4.7 Permanenter Rewrite statt kontrollierter Bergung

Die Repository-Folge bildet eine Kette aus JS-Version, separater UI, AI-Prototyp, TypeScript-Reboot, Re-Reboot, Vertrags-Re-Reboot, Factory-Experiment und Flow-Experiment. Jeder Strang löst echte Probleme, verliert aber Teile des zuvor funktionierenden Loops.

Besonders sichtbar ist das bei Zucht und Game Lifecycle: im kompakten Browserprototyp vorhanden, im technisch stärksten Strang nicht als fertige Spielerreise vorhanden.

### 4.8 Scope-Widersprüche wurden nicht produktseitig entschieden

Beispiele:

- „Playability over realism“ steht neben sehr detaillierten Physik-, Workforce- und Datenverträgen.
- MVP fordert 1–2 Strains, der namensgebende Zuchtmechanismus fehlt aber.
- Modding first steht neben fehlendem Basisspiel.
- Ein 200-Tage-Golden-Master schützt Determinismus, kann aber Balancing-Iteration teuer machen, wenn Hashes als unveränderliche Spielwerte statt als reproduzierbare Fixtures behandelt werden.
- Der Referenzstart mit 100.000.000 Kapital nimmt dem Economy-Loop die Spannung, obwohl wirtschaftlicher Druck ein Experience Pillar sein soll.

## 5. Zielarchitektur: behalten, vereinfachen, einfrieren

### Behalten

- `weedbreed-2re-boot` als Monorepo und einzige aktive Wahrheit.
- Engine → Façade → UI als Schichtengrenze.
- Deterministische RNG-Streams, feste Stundenticks und Golden-Run-Werkzeuge.
- Blueprint-Loader, Preis-Trennung und zentrale Domain-Invarianten.
- Bestehende physikalische und biologische Module, soweit sie den Vertical Slice tragen.

### Vereinfachen

- Eine lokale Einzelspieler-Runtime; Socket.IO bleibt Adapter, ist aber kein Produktziel.
- Eine Startkonfiguration, eine Währung ohne Neutralitätsdebatte im Kern, ein Marktsegment.
- Workforce im ersten Slice als fester Arbeitsstunden-Pool statt Mitarbeiter-Lebenssimulation.
- Krankheiten und Wartung auf je einen verständlichen Archetyp reduzieren.
- Read Models entlang konkreter Screens statt als universelle Abbildung des gesamten World Trees schneiden.

### Einfrieren

- Neue Blueprints außerhalb des Slice.
- Plugin-/Modding-Laufzeit, Terminalmonitor, alternative Transporte und externe Identitätsquelle.
- Neue ADRs, sofern keine irreversible Produktentscheidung betroffen ist.
- Weitere Repositories, Branch-Neustarts oder Framework-Wechsel.

## 6. Der erste lieferbare Vertical Slice

### Spielerziel

„Erzeuge aus Northern Lights und Sour Diesel eine F1-Linie mit einem Zielprofil, baue mindestens eine Generation erfolgreich an und verkaufe eine qualifizierte Ernte mit positivem Deckungsbeitrag.“

### Inhaltliche Begrenzung

- 1 Company, 1 kleine Structure.
- 1 Growroom mit 2 Zones und 1 Laboratory als funktionaler Zuchtort.
- 3 Eltern-Strains.
- 1 Cultivation Method: Basic Soil Pot.
- 5 Geräteklassen: Licht, Umluft/Abzug, Temperatur, Feuchte, Sensorik.
- Strom, Wasser, Saatgut, Substrat und Verkauf als einzige Geldflüsse.
- 1 Schädling oder 1 Krankheit; nicht beides in voller Breite.
- F1-Vererbung mit sichtbarer Variation; F2/BX/IBL erst nach validiertem Slice.

### Obligatorische Spielerreise

1. New Game erzeugt eine valide Welt und ein klares Startziel.
2. Spieler richtet zwei Zones ein und kauft/installiert notwendige Geräte.
3. Spieler pflanzt beide Eltern und steuert mindestens eine relevante Umweltabweichung.
4. Pflanzen werden erntereif; Spieler erntet und erhält Inventar + Qualitätsaufschlüsselung.
5. Spieler verkauft einen Teil und verwendet selektierte Eltern für eine Kreuzung.
6. Das Spiel erzeugt eine benannte F1 mit nachvollziehbar vererbten Traits und Variation.
7. Spieler baut die F1 an und sieht den Unterschied zu den Eltern.
8. Save/Load stellt genau diesen Fortschritt wieder her.

### Slice-Abnahme

- Frischer Browser bis erste F1 ohne Devtools, Fixtures oder manuellen JSON-Eingriff.
- Jede sichtbare Primäraktion verändert autoritativ Engine-State oder ist nicht sichtbar.
- Ein automatisierter Journey-Test deckt die acht Schritte ab.
- Ein Mensch kann das Ziel in höchstens 30 Minuten erreichen.
- Gleicher Seed + gleiche Intents ergeben dasselbe Ergebnis.
- Build, Typecheck, Lint, Unit/Integration und Journey-Test sind grün.

## 7. Umsetzungsstrategie

### Phase 0 – Stop the line

Ziel: wieder eine ehrliche Baseline herstellen.

- Feature-Freeze.
- Aktuelle uncommittete UI-Arbeit sauber abschließen oder separat sichern.
- Typecheck, UI-Tests und LOC-Gate reparieren.
- Gate exakt auf die dokumentierten 500/700-Grenzen ausrichten und generierte Dateien ausschließen.
- Die fünf größten produktiven Dateien entlang ihrer Verantwortlichkeiten teilen.
- Einen einzigen Root-Befehl `pnpm verify` etablieren, der lokal und in CI identisch läuft.

Exit: sauberer Checkout, ein Befehl, vollständig grün.

### Phase 1 – Product Contract statt weiterer System Contracts

Ziel: den Spielerpfad zur alleinigen Priorisierung machen.

- Eine maximal zweiseitige Product Bible erstellen: Fantasie, drei Loops, Slice, Nicht-Ziele.
- Den achtstufigen Journey-Test zunächst als roten Acceptance-Test anlegen.
- Aktuelle UI-Aktionen inventarisieren: `works`, `stub`, `missing`, `remove from slice`.
- Golden Tests trennen in Determinismus-Invarianten und bewusst versionierte Balance-Fixtures.

Exit: Jede nächste Aufgabe referenziert einen Schritt der Spielerreise.

### Phase 2 – Walking Skeleton

Ziel: alle acht Schritte mit vereinfachter Logik einmal durchlaufen.

- New Game/Reset, Facility Setup, Buy/Install, Sow, Tick, Harvest, Sell, Breed F1, Save/Load verbinden.
- Fehlende Intents in kleinen Domänenmodulen implementieren; keine Erweiterung des monolithischen Command-Pipeline-Files.
- Stubs entweder anschließen oder aus dem Slice-UI entfernen.
- Zuchtlogik zunächst aus den vorhandenen `weed-breed-ai`- und `breeding_module.md`-Ideen ableiten, aber auf ein sauberes `BreedF1`-Domain-Modul reduzieren.

Exit: automatisierter Journey-Test grün; UX darf noch roh sein.

### Phase 3 – Entscheidungen und Feedback

Ziel: aus dem Walking Skeleton ein Spiel machen.

- Pro Phase mindestens eine echte Trade-off-Entscheidung:
  - mehr Licht = mehr Wachstum, Wärme und Kosten;
  - trockenere Luft = weniger Schimmelrisiko, mehr Wasserverbrauch;
  - frühe Selektion = schneller, aber genetisch unsicherer;
  - bessere Geräte = CapEx gegen stabilere Qualität.
- Jede Abweichung erklärt Ursache, Wirkung und mögliche Aktion.
- Zeitraffer so balancieren, dass Entscheidungen häufig, aber nicht hektisch sind.
- Startkapital und Preise auf einen engen, testbaren Economy-Loop reduzieren.

Exit: fünf moderierte Spieltests; Spieler verstehen Ziel, Ursache und Belohnung ohne Erklärung.

### Phase 4 – Content und Präsentation

Ziel: eine vorzeigbare Demo statt eines Technikdemos.

- Beste bestehende UI-Muster aus `weed-breed-ai`, aktuellem UI und Factory-Bottleneck-Ansatz kombinieren.
- Onboarding, Tooltips, Trait-Vergleich Eltern → F1 und Run-Summary polieren.
- Erst jetzt zusätzliche Strains, zweite Methode und weitere Risiken hinzufügen.

Exit: 30-Minuten-Demo, reproduzierbarer Release-Build, Save-Kompatibilität und klare Steam-/Web-Demo-Story.

### Phase 5 – Ausbau nach Nutzersignal

Reihenfolge nach Spieltests, nicht nach technischer Attraktivität:

1. F2/BX/IBL und Phänotyp-Selektion.
2. Dry/Cure und differenzierte Marktsegmente.
3. Workforce-Vertiefung und Automation.
4. Krankheiten/Wartung erweitern.
5. Facility- und Produktionsgraph-Planung.
6. Modding, Plugins und Editoren.

## 8. Neue Arbeitsregeln gegen erneutes Vibe-Coding

1. **Kein Feature ohne Spielerverb.** Jede Aufgabe beginnt mit „Der Spieler kann …“.
2. **Ein aktives Repository, ein Backlog, ein Release-Ziel.** Alte Repositories sind read-only Quellen.
3. **Vertical Slice vor Vollständigkeit.** Ein kompletter dünner Pfad schlägt zehn tiefe Subsysteme.
4. **WIP-Limit 1 pro Schicht.** Höchstens ein offenes Engine-, ein Façade- und ein UI-Teil derselben Journey-Funktion.
5. **Integration täglich, Spieltest wöchentlich.** Nicht nur Test-Suite, sondern echte Start-bis-Ziel-Session.
6. **Stubs sind sichtbar befristet.** Jeder Stub hat Owner, Slice-Schritt und Löschdatum; sonst wird die UI entfernt.
7. **Red main stoppt Features.** Erst Gates reparieren, dann weiterbauen.
8. **Dokumentationsbudget.** Product Bible + SEC + ADRs; keine neue Parallel-„Final Truth“.
9. **Balance ist versioniert, nicht eingefroren.** Determinismus bleibt hart; konkrete Zahlen dürfen bewusst neu gebaselined werden.
10. **Definition of Done endet beim Nutzer.** Code + Intent + Read Model + UI + Journey-Test + verständliches Feedback.

## 9. Konkrete nächste Entscheidungen

Vor der Implementierung müssen nur drei Produktentscheidungen fallen:

1. Ist die erste öffentliche Form eine Web-Demo oder ein Desktop-Build? Empfehlung: Web-Demo, weil die vorhandenen React/Vite-Stränge und lokale Persistenz den kürzesten Weg bieten.
2. Soll die erste Zucht nur F1 liefern oder bereits Population + Selektion? Empfehlung: kleine Population mit 3–5 sichtbaren Kandidaten, aber nur F1-Generation.
3. Ist Workforce im ersten Slice spielbar oder automatisiert? Empfehlung: als fester Kapazitätspool automatisieren und die tiefe HR-Oberfläche vorübergehend aus der Hauptnavigation nehmen.

Mit diesen Entscheidungen kann Phase 0 unmittelbar in einen ausführbaren Recovery-Backlog übersetzt werden.

## 10. Evidenzhinweise

- Aktueller Scope und Verträge: `docs/VISION_SCOPE.md`, `docs/SEC.md`, `docs/DD.md`, `docs/TDD.md`.
- Aktueller Intent-Router: `packages/facade/src/transport/engineCommandPipeline.ts`.
- Aktuelle UI-Stubs: `packages/ui/src/pages/roomDetailHooks.ts`, `packages/ui/src/pages/zoneDetailHooks.ts`, `packages/ui/src/pages/structureHooks.ts`.
- Früher spielbarer Zuchtansatz: `D:/__DEV/weed-breed-ai/game/models/Company.ts` und `D:/__DEV/weed-breed-ai/components/BreedingStation.tsx`.
- Ausgearbeitete Zuchtidee: `D:/__DEV/weebbreed-reboot/docs/addendum/ideas/breeding_module.md`.
- Produktionsgraph-/Bottleneck-UX: `D:/__DEV/weedbreed-factory` und `D:/__DEV/weedbreed-flow`.
- Historische konsolidierte Wahrheit: `D:/__DEV/weebbreed-reboot/docs/weedbreed-final-truth.md`.

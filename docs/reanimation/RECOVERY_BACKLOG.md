# Weed Breed — Recovery-Backlog

Dieser Backlog ist nach der Spielerreise geordnet, nicht nach Packages. P0 ist die Stop-the-line-Voraussetzung. Danach darf immer nur das oberste noch nicht abgenommene Journey-Inkrement begonnen werden.

## Verschobene, nicht blockierende Schulden

Diese Punkte dürfen den Journey-Durchstich nicht anhalten. Sie werden erst
gezogen, wenn sie einen roten Gate-Lauf verursachen oder ihr fachlicher Bereich
ohnehin bearbeitet wird:

- Browserlist-/Baseline-Browserdaten aktualisieren.
- Den aktuell 534,49 kB großen minifizierten UI-Hauptchunk bei einer späteren
  Performance-Runde per Route-Splitting verkleinern.
- Den bestehenden React-`act`-Hinweis im `SimControlBar`-Test bereinigen.
- Das derzeit bewusst ignorierte Payroll-Telemetrie-Topic in der UI anbinden,
  sobald Workforce wieder Teil eines sichtbaren Produktpfads wird.

Build-, Typ-, Determinismus-, Datenintegritäts- und Spielerflussfehler sind
keine verschiebbaren Blocker.

## Arbeits- und Eigentumsregeln

- **Engine Owner** besitzt autoritativen State, deterministische Regeln und reine Domain-Tests.
- **Façade Owner** besitzt Intent-Schemas, Command Handler, Read Models und Transport-Integration.
- **UI Owner** besitzt nur Darstellung, Formzustand, Intent-Abgabe und Nutzerfeedback.
- **Journey Owner** besitzt Fixture, Browser-Test und deterministischen Replay-Test; er darf keine Produktlogik in Test-Helfern nachbauen.
- Dateien ab 500 LOC werden vor Erweiterung geschnitten; `engineCommandPipeline.ts`, `readModelProviders.ts`, `roomDetailHooks.ts` und `zoneDetailHooks.ts` erhalten keine weitere Domänenlogik.
- Ein Item ist erst fertig, wenn Engine + Façade + UI + relevante Tests gemeinsam integriert sind. Keine Folgeaufgabe darf eine sichtbare Stub-Aktion hinterlassen.

## P0 — Ehrliche grüne Baseline

### R-000: Verify-Gate wiederherstellen

**Spielerverb:** Der Spieler kann die Demo zuverlässig starten.
**Owner:** Integration/Build
**Dateibesitz:** Root-Skripte und CI; fehlerhafte Tests in ihrem vorhandenen Package. Keine Gameplay-Änderungen.
**Arbeit:** Typecheck, kompletter Testlauf und LOC-Gate reparieren; einen lokalen und CI-identischen `pnpm verify`-Befehl etablieren; generierte Dateien vom LOC-Gate ausschließen und 500/700 durchsetzen.

**Abnahme:**

- Frischer Checkout mit Node 22 und pnpm führt `pnpm verify` ohne Fehler aus.
- Verify enthält mindestens Build/Typecheck, Lint, Unit/Integration und LOC-Gate.
- Keine Tests werden zur Grünfärbung übersprungen oder abgeschwächt.
- Produktive Dateien ab 700 LOC blockieren; generierte Artefakte tun dies nicht.

### R-001: Slice-Oberfläche entstuben

**Spielerverb:** Der Spieler sieht nur Handlungen, die funktionieren.
**Owner:** UI
**Dateibesitz:** `packages/ui/src/routes/**`, `packages/ui/src/components/layout/**`, bestehende Pages/Hooks.
**Arbeit:** Workforce aus der Demo-Hauptnavigation nehmen; alle Stubs inventarisieren; nicht zur Journey gehörende Stubs ausblenden; Journey-Stubs erst in den nachfolgenden Items ersetzen.

**Abnahme:**

- Im Demo-Pfad erzeugt kein Primärbutton `console.info("[stub]")`.
- Workforce bleibt technisch erreichbar/testbar, ist aber kein Hauptnavigationsziel.
- Eine automatisierte UI-Prüfung schlägt fehl, wenn im sichtbaren Demo-Pfad eine Stub-Aktion zurückkehrt.

## J1 — New Game und reproduzierbarer Start

### R-100: Demo-Szenario als kanonischer Start

**Spielerverb:** Der Spieler kann ein neues Spiel mit Namen und Seed beginnen.
**Abhängigkeit:** R-000
**Owner:** Engine + Façade
**Dateibesitz:** neuer Engine-Ordner `packages/engine/src/backend/src/scenarios/`; `packages/facade/src/backend/deterministicWorldLoader.ts` wird in kleine Builder aufgeteilt; neue Lifecycle-Intent-Datei unter `packages/facade/src/intents/`.
**Wiederverwenden:** `parseCompanyWorld`, `createRng`, `deterministicUuid`, vorhandene Blueprint-/Preisparser.

**Abnahme:**

- `game.new.v1 { companyName, seed }` erzeugt genau 1 Structure, 1 Growroom, 2 leere Zones, 1 Storage Room und 1 Laboratory; Welt ist pausiert.
- Beide Zones referenzieren genau eine valide Cultivation Method, Container, Substrat und kompatible Irrigation Method.
- Derselbe Seed und Name ergeben denselben kanonischen World-State; ein anderer Seed ändert mindestens die dafür vorgesehenen deterministischen Merkmale.
- Kein Blueprint unter `/data` wird verändert.

### R-101: Startscreen und Zielanzeige

**Spielerverb:** Der Spieler versteht sein Ziel und betritt den Grow.
**Owner:** UI
**Dateibesitz:** neuer Feature-Ordner `packages/ui/src/features/session/`; App-/Route-Integration.
**Wiederverwenden:** Start-/Save-/Load-Fluss aus `D:/__DEV/weed-breed-ai/views/StartScreen.tsx` nur als UX-Referenz.

**Abnahme:**

- „New Game“ fragt Name und optionalen Seed ab und wartet auf bestätigten Intent-Ack.
- Nach Erfolg zeigt die UI das Ziel „Erzeuge und teste deine erste F1“ sowie 0/9 Journey-Fortschritt.
- Fehler bleibt im Formular sichtbar; kein optimistischer Fake-State.

## J2 — Zwei betriebsbereite Zonen

### R-200: Facility-Intents schließen

**Spielerverb:** Der Spieler kann Räume/Zonen erstellen und ein notwendiges Gerät kaufen und installieren.
**Abhängigkeit:** R-100
**Owner:** Engine + Façade
**Dateibesitz:** neue Domain-Commands unter `packages/engine/src/backend/src/commands/facility/`; kleine Adapter unter `packages/facade/src/intents/facility/`; `engineCommandPipeline.ts` nur als Registry/Dispatcher.
**Wiederverwenden:** Validierungslogik aus `packages/ui/src/lib/facilityFlows.ts` als UX-Vorprüfung, aber sämtliche Regeln serverseitig wiederholen; `parseDeviceBlueprint`, Device-Preis-Map, Placement-/Room-Purpose-Validatoren.

**Abnahme:**

- `room.create.v1`, `zone.create.v1` und `device.purchaseInstall.v1` sind schema-validiert, deterministisch und idempotent über `intentId`.
- Zones außerhalb eines Growrooms, fehlende Cultivation Method, inkompatible Bewässerung, Überbelegung und unzulässige Device-Platzierung werden autoritativ abgelehnt.
- Kauf/Installation mindert das sichtbare Guthaben genau einmal; Erfolg erscheint im Read Model nach Commit.
- Der Journey benötigt keine Duplicate-, Move-, Remove- oder Replace-Funktion.

### R-201: Facility-Wizard auf den Slice reduzieren

**Spielerverb:** Der Spieler macht seine zwei Zones ohne Fachwissen startklar.
**Owner:** UI
**Dateibesitz:** `packages/ui/src/components/forms/FacilityDialogs.tsx` in `packages/ui/src/features/facility/**` aufteilen; `packages/ui/src/lib/facilityFlows.ts` beibehalten/teilen.
**Abnahme:**

- Der Wizard bietet nur die Slice-kompatible Soil-Konfiguration und notwendige Geräte an.
- Fläche, Pflanzenlimit, Kompatibilität, Einmalkosten und danach verbleibendes Guthaben sind vor Bestätigung sichtbar.
- Nach Ack zeigt jede Zone „bereit“ oder exakt die noch fehlende Voraussetzung.

## J3 — Eltern anbauen

### R-300: Sow-Command und dynamische Strain-Auflösung

**Spielerverb:** Der Spieler kann Northern Lights, Sour Diesel und später seine F1 säen.
**Abhängigkeit:** R-200
**Owner:** Engine + Façade
**Dateibesitz:** neue Commands `packages/engine/src/backend/src/commands/plants/`; Strain-Resolver neben `domain/blueprints/strainBlueprint.ts`; `packages/facade/src/intents/plants/`.
**Wiederverwenden:** `plantSchema`, `validateSowing` aus `packages/ui/src/lib/facilityFlows.ts` als UI-Vorprüfung, deterministische UUID-Helfer, Strain-Preis-Map.

**Abnahme:**

- `plants.sow.v1 { zoneId, strainId, count }` erzeugt valide Pflanzen bis zur Zonenkapazität und bucht Seeds exakt einmal.
- Zone muss leer sein; inkompatible Sorte, unbekannte Sorte, ungültige Anzahl und fehlendes Guthaben werden abgelehnt.
- Pflanzen-IDs stammen deterministisch aus Seed, Zone, Intent und Sequenz.
- Derselbe Resolver lädt statische Blueprints und später Custom Strains; UI kennt keine Wachstumsformeln.

### R-301: Säen und Fortschritt sichtbar machen

**Spielerverb:** Der Spieler wählt pro Zone einen Elternteil und beobachtet Wachstum.
**Owner:** UI + Façade Read Model
**Dateibesitz:** `packages/ui/src/features/grow/**`; kleine Projektionen unter `packages/facade/src/readModels/grow/`; keine Erweiterung von `zoneDetailHooks.ts` über Delegation hinaus.
**Abnahme:**

- Leere Zone bietet „Säen“, valide Sorte und Menge; nach Ack erscheinen reale Pflanzen.
- Pro Zone sind Sorte, Phase, Alter, Gesundheit, Biomasse und geschätzte Reife sichtbar.
- Northern Lights und Sour Diesel können gleichzeitig in getrennten Zones laufen.

## J4 — Ein Problem erkennen und lösen

### R-400: Deterministischer Demo-Vorfall

**Spielerverb:** Der Spieler erkennt und korrigiert eine Umweltabweichung.
**Abhängigkeit:** R-300
**Owner:** Engine + Façade + UI
**Dateibesitz:** neuer Szenario-Incident unter `packages/engine/src/backend/src/scenarios/demo/`; vorhandene Klima-/Licht-Intents; Incident-Projektion und Grow-UI.
**Wiederverwenden:** `intent.zone.climate.adjust.v1`, `intent.zone.lighting.adjust.v1`, `advancePhysiology`, Zone-Telemetrie.

**Abnahme:**

- Der Vorfall tritt bei festem Seed/Tick reproduzierbar auf und pausiert den Zeitraffer.
- Hinweis nennt Messwert, Zielband, Wachstums-/Qualitätsfolge und passende Aktion.
- Eine vorhandene autoritative Klima- oder Lichtaktion bringt den Wert innerhalb einer definierten Zahl Ticks zurück ins Band.
- Unbehandelt entsteht messbar mehr Stress beziehungsweise weniger Gesundheit/Ertrag als behandelt.

## J5 — Bewusst ernten und verkaufen

### R-500: Manuelle Ernte statt Sofort-Automatik

**Spielerverb:** Der Spieler entscheidet, wann erntereife Pflanzen geerntet werden.
**Abhängigkeit:** R-300
**Owner:** Engine + Façade
**Dateibesitz:** `packages/engine/src/backend/src/engine/pipeline/applyHarvestAndInventory.ts`, neuer Harvest-Command unter `commands/plants/`, `packages/facade/src/intents/plants/`, Inventory-Projektion.
**Wiederverwenden:** `createHarvestLot`, `HarvestLotSchema`, `resolveStorageRoomForStructure`, Harvest-Telemetrie und Inventory-Readmodels.

**Durchstich-Entscheidung (2026-09-08):** Der vorhandene autoritative
`intent.zone.lighting.adjust.v1` setzt bei einem validen 12/12-Lichtplan die
`photoperiodPhase` auf `flowering` und bei 18/6 auf `vegetative`. Ohne diese
Kopplung blieb der normale Sow→Tick-Pfad dauerhaft vegetativ und konnte R-500
nur über Test-Fixture-Mutationen erreichen; solche Abkürzungen sind im
Journey-Test ausdrücklich unzulässig.

**Abnahme:**

- Erreichen von `harvest-ready` erzeugt noch kein Lot; Pflanze bleibt bis zum Intent erhalten.
- `plants.harvest.v1` akzeptiert nur aktive erntereife Pflanzen und erzeugt pro Pflanze höchstens ein deterministisches Lot.
- Fehlender/eindeutig nicht auflösbarer Storage blockiert Ernte mit verständlichem Fehler.
- Gleiches Intent-Replay erzeugt weder zweites Lot noch zweite Zustandsänderung.

### R-501: Guthaben, Ledger und Lot-Verkauf

**Spielerverb:** Der Spieler kann einen Teil seiner Ernte verkaufen und den Deckungsbeitrag sehen.
**Owner:** Engine + Façade
**Dateibesitz:** additive Economy-State-Dateien unter `packages/engine/src/backend/src/economy/`; `domain/entities.ts` nur um schlanken Verweis erweitern; `packages/facade/src/intents/inventory/`; Economy-/Inventory-Readmodels.
**Wiederverwenden:** `data/prices/strainPrices.json`, vorhandene Cost Accruals, Inventory-Summaries.
**Abnahme:**

- World/Save enthält Guthaben und unveränderliche Ledger-Einträge für CapEx, OpEx, Seed und Sale.
- `inventory.sell.v1 { lotId, fraction01 }` verkauft nur verfügbare Menge; 0 < fraction01 ≤ 1.
- Erlös = verkaufte trockengewicht-normalisierte Menge × strainabhängiger Preis × klarer Quality-Faktor; Formel ist pure und getestet.
- Lot bewahrt `strainId` beziehungsweise eine auflösbare Herkunft; Teilverkauf lässt deterministischen Restbestand.
- UI zeigt Guthaben vorher/nachher, Erlös und Deckungsbeitrag des laufenden Zyklus.

## J6 — F1-Population erzeugen und selektieren

### R-600: Minimaler Breeding-State und F1-Domain

**Spielerverb:** Der Spieler kann aus zwei qualifizierten Eltern 3–5 F1-Kandidaten erzeugen.
**Abhängigkeit:** R-500, R-501
**Owner:** Engine
**Dateibesitz:** neuer Ordner `packages/engine/src/backend/src/breeding/`; World-/Save-Schema-Integration; keine Blueprint-Dateien schreiben.
**Wiederverwenden:** aktuelles `StrainBlueprint`-Schema, `createRng`, `deterministicUuid`; Algorithmenideen aus `weebbreed-reboot/docs/addendum/ideas/breeding_module.md` nach Anpassung an aktuelle Feldnamen/Einheiten.

**Durchstich-Entscheidung (2026-09-08):** Elternrollen sind bewusst als
`seedParentId` und `pollenParentId` geordnet. Ein Harvest-Lot mit positiver
Menge und `quality01 >= 0.5` erzeugt dauerhafte Qualifikations-Evidence, sodass
ein späterer Komplettverkauf den Zuchtfortschritt nicht rückwirkend löscht.
Selektierte Custom-F1 werden aus zurückbehaltenem Zuchtmaterial zum Seedpreis
0 erneut ausgesät; diese Slice-Regel ist eine autoritative Engine-Policy und
kein UI-Sonderfall.

**Abnahme:**

- Breeding State speichert Runs, Eltern-UUIDs, Kandidaten, Status, selektierten Kandidaten und Custom-Strain-Registry.
- `crossF1` ist pure/deterministisch; Population 3–5; Parent-Reihenfolge wird kanonisiert oder bewusst als Rolle modelliert und getestet.
- Nur Eltern mit mindestens einem qualifizierten Harvest-Lot im Run sind zulässig; identische Eltern werden abgelehnt.
- Jeder Kandidat validiert gegen das aktuelle Runtime-Strain-Schema; Genotyp summiert sich innerhalb EPS auf 1, alle 0..1-Werte sind geklemmt, Bereiche bleiben geordnet.
- Golden Vectors beweisen gleiche Population/Sortierung über wiederholte Läufe und verschiedene Plattformen.

### R-601: Breeding-Intents und Projektion

**Spielerverb:** Der Spieler startet den Cross, vergleicht Kandidaten und übernimmt genau einen.
**Owner:** Façade
**Dateibesitz:** `packages/facade/src/intents/breeding/`; `packages/facade/src/readModels/breeding/`; Dispatcher registriert nur Handler.
**Abnahme:**

- `breeding.crossF1.v1 { laboratoryRoomId, parentAId, parentBId, populationSize }` und `breeding.selectCandidate.v1 { runId, candidateId, name }` sind validiert und idempotent.
- Cross erfordert genau einen Laboratory Room im Scope, zwei qualifizierte Eltern und Populationsgröße 3–5.
- Auswahl erlaubt genau einen Kandidaten, validiert Namen/Slug-Kollisionen und registriert eine anbaubare Custom Strain.
- Read Model zeigt Eltern und Kandidaten in identischen Trait-Feldern samt Abweichung vom Elternmittel.

### R-602: Breeding Lab UI

**Spielerverb:** Der Spieler trifft eine informierte F1-Auswahl.
**Owner:** UI
**Dateibesitz:** neuer Feature-Ordner `packages/ui/src/features/breeding/`; Laboratory Route.
**Wiederverwenden:** Parent-Picker/Trait-Vergleich aus `weed-breed-ai` als UX-Muster; keine Übernahme seiner `Date.now()`- oder Deep-Clone-Logik.

**Abnahme:**

- Nur qualifizierte Eltern erscheinen; gleiche Eltern können nicht gewählt werden.
- Standardpopulation ist 4, Auswahl 3–5.
- Tabelle zeigt Ertragspotenzial, Zyklusdauer, Robustheit, THC/CBD und Temperaturband für Eltern und Kandidaten mit Einheiten.
- Nach Auswahl und Naming erscheint die Custom Strain in der Säen-Auswahl; verworfene Kandidaten sind nicht anbaubar.

## J7 — Eigene F1 anbauen und vergleichen

### R-700: Eltern-vs.-F1-Run-Summary

**Spielerverb:** Der Spieler beweist den Wert seiner F1 im Grow.
**Abhängigkeit:** R-300, R-602
**Owner:** Façade + UI
**Dateibesitz:** neue Summary-Projektion unter `packages/facade/src/readModels/runSummary/`; `packages/ui/src/features/run-summary/`.
**Abnahme:**

- Selektierte F1 kann über denselben Sow-Intent wie statische Sorten angebaut werden.
- Nach F1-Ernte zeigt Summary Eltern und F1 für tatsächlichen Ertrag, mittlere Qualität, Zyklusdauer und Deckungsbeitrag; Blueprint-Potenzial wird klar getrennt.
- Das Demo-Ziel wird erst nach mindestens einer F1-Ernte abgeschlossen, nicht beim Klick auf „Breed“.
- Der strainbezogene `realizedDirectMarginCc` enthält ausschließlich gebuchte,
  eindeutig zuordenbare Verkaufserlöse minus Saatkosten. Gemeinsame Tick-OpEx
  werden nicht erfunden auf Strains verteilt, sondern separat als
  `unallocatedOperatingExpenseCc` gezeigt; der globale Ledger-Saldo bleibt als
  `overallCycleContributionMarginCc` sichtbar.

## J8 — Speichern und laden

### R-800: Vollständiger Session-Snapshot

**Spielerverb:** Der Spieler kann seinen F1-Fortschritt speichern und wieder laden.
**Abhängigkeit:** R-501, R-601
**Owner:** Engine + Façade
**Dateibesitz:** `packages/engine/src/backend/src/saveLoad/**`; `packages/facade/src/intents/session/` beziehungsweise HTTP-Endpunkte.
**Wiederverwenden:** `saveGameSchema`, `serialiseSaveGame`, `loadSaveGame`, Migration Registry.

**Engine-/Session-Grenze (2026-09-08):** Engine-Save v2 enthält ausschließlich
den autoritativen `SimulationWorld` samt Economy und Breeding. Abgeleitete Read
Models, Playback und Journey-Fortschritt gehören nicht in den World-State;
Playback und Journey werden vom Facade-Session-Envelope neben `engineSave`
persistiert. Die v0/v1-Migration ergänzt fehlende Felder der früheren
Prototype-Saves deterministisch.

**Abnahme:**

- Save enthält World, Economy/Ledger, Breeding Runs, Custom Strains, qualifizierte Eltern, Journey-Fortschritt und Simulationssteuerung; keine abgeleiteten Read Models.
- Export → Import ergibt denselben kanonischen Hash und setzt deterministische RNG-Sequenzen korrekt fort.
- Unbekannte/neue Schema-Version wird verständlich abgelehnt; Migrationen sind getestet.
- Der Facade-Envelope v1 enthält den Engine-Save, dessen kanonischen World-Hash,
  `paused|running` plus Geschwindigkeit und chronologisch geordnete,
  weltvalidierte Milestone-Evidence. Load validiert vollständig, bevor World,
  Playback und Journey gemeinsam ersetzt und alle vorgemerkten Commands sowie
  domänenspezifischen Ack-Caches verworfen werden.
- Socket.IO akzeptiert ein vollständiges Session-Envelope nur unterhalb der
  exportierten Grenze `MAX_SESSION_ENVELOPE_BYTES` (8 MiB). Das ersetzt den
  1-MiB-Default mit Headroom für die gemessene 2.111.926-Byte-Langlaufprobe,
  ohne den Eingang unbegrenzt zu
  öffnen; größere Pakete werden vor Intent-Dispatch getrennt und können die
  autoritative Welt nicht verändern.

### R-801: Web-Slots und Reload

**Spielerverb:** Der Spieler findet und lädt seinen Spielstand nach einem Browser-Reload.
**Owner:** UI + Façade
**Dateibesitz:** `packages/ui/src/features/session/**`; Session-API der Façade.
**Abnahme:**

- Mindestens ein benannter lokaler Slot plus JSON-Export/Import funktionieren.
- Reload während des F1-Vergleichs stellt ausgewählte Custom Strain, Inventory, Guthaben, Weltzeit und Journey-Schritt wieder her.
- UI meldet Save-Erfolg erst nach erfolgreicher Validierung/Persistenz.

## J9 — Release-Gate

### R-900: Journey und moderierter Spieltest

**Spielerverb:** Ein neuer Spieler erreicht ohne Hilfe seine erste angebaute F1.
**Abhängigkeit:** alle vorherigen Items
**Owner:** Journey/Release
**Dateibesitz:** `packages/ui/e2e/reanimation/**`, Engine-Replay-Fixtures, Release-Dokumentation.
**Abnahme:**

- Die Spezifikation `END_TO_END_JOURNEY_TEST.md` ist automatisiert und grün.
- Derselbe Intent-Trace erzeugt in zwei frischen Läufen denselben täglichen und finalen State Hash.
- Fünf moderierte Spieltests: mindestens vier schließen in ≤30 Minuten ab; alle verstehen Ziel, Problemursache und F1-Auswahl ohne verbale Erklärung.
- Keine P0/P1-Fehler, keine sichtbaren Stubs, `pnpm verify` grün.

## Explizit geparkter Backlog

F2/BX/IBL, Breeding-Timeline, Dry/Cure, mehrere Märkte, Vertragswesen, Personal-Mikromanagement, weitere Krankheiten/Schädlinge, Facility-Graph, Plugins/Mods, Terminalmonitor, alternative Transporte, Desktop-Paketierung und neuer Content werden erst nach R-900 priorisiert. Vorherige Implementierungen dazu werden erhalten, aber nicht vertieft.

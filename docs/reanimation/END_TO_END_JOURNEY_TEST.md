# Weed Breed — Ende-zu-Ende-Journey-Test „First F1“

## 1. Zweck

Dieser Test ist der Produktvertrag der Web-Demo. Er beweist nicht nur, dass Seiten rendern oder Commands isoliert funktionieren, sondern dass ein Spieler aus einem frischen Zustand eine eigene F1 erzeugt, anbaut, erntet, speichert und reproduzierbar wieder lädt.

Der Test besteht aus zwei Ebenen mit demselben Intent-Trace:

1. **Browser Journey:** echte UI, echte Façade, echte Engine; nur Zeitraffer darf beschleunigt werden.
2. **Deterministischer Replay:** derselbe normalisierte Intent-Trace läuft zweimal headless; tägliche und finale kanonische State Hashes sowie Eventzahlen müssen identisch sein.

Mockdaten sind nur an den äußeren Grenzen erlaubt: keine gemockten Acks, Read Models, Ticks, Ernten, F1-Kandidaten oder Guthabenbewegungen.

## 2. Testort und Eigentum

- Browser-Suite: `packages/ui/e2e/reanimation/first-f1.spec.ts`
- Page Objects/Helfer: `packages/ui/e2e/reanimation/support/`
- Kanonischer Start: `packages/engine/tests/fixtures/reanimation-first-f1-start.json`
- Intent-Trace: `packages/engine/tests/fixtures/reanimation-first-f1-intents.json`
- Replay-Test: `packages/engine/tests/integration/reanimation/firstF1Journey.integration.test.ts`
- Erwartete Hash-/Event-Metadaten: `packages/engine/tests/fixtures/reanimation-first-f1-golden.json`

Fixtures enthalten keine abgeleiteten Read Models. Balancewerte dürfen bewusst neu gebaselined werden; Determinismus-Invarianten nie stillschweigend.

## 3. Feste Testparameter

| Parameter | Wert |
| --- | --- |
| Seed | `WB-DEMO-FIRST-F1-V1` |
| Company | `Ramp Labs` |
| Ausgangszustand | keine Pflanzen, Simulation pausiert |
| Eltern A/B | Northern Lights / Sour Diesel, über UUID aus Katalog aufgelöst |
| Anbaumethode | kleinste valide Soil-Konfiguration des Demo-Szenarios |
| Population | 4 F1-Kandidaten |
| gewählter Kandidat | Kandidat mit höchstem deterministischen Zielscore; Tie-Break UUID aufsteigend |
| Custom-Strain-Name | `Ramp One` |
| Verkauf | 50 % des ersten Northern-Lights-Lots |
| Zeitsteuerung | Step/Speed über echte Simulation-Control-Intents |

Der Zielscore ist nur Testauswahl, keine versteckte Produktentscheidung: `0.40 × normalisiertes Ertragspotenzial + 0.30 × Robustheit + 0.20 × inverse normalisierte Zyklusdauer + 0.10 × THC`. Die UI muss die zugrunde liegenden Traits zeigen; der Browser-Test berechnet keine Genetik.

## 4. Vorbedingungen

- `pnpm verify` ist grün.
- UI und Façade laufen in der produktionsnahen Testkonfiguration.
- Browser besitzt keine Save-Slots, Local Storage oder Service-Worker-Daten für Weed Breed.
- Systemzeit, Locale und Dateisystempfade dürfen den Simulationszustand nicht beeinflussen.
- Der Katalog enthält Northern Lights, Sour Diesel, notwendige Geräte sowie kompatible Cultivation-/Container-/Substrat-/Irrigation-Definitionen.

## 5. Journey-Szenario

### Schritt 1 — Neues Spiel

**Aktion:** Startscreen öffnen, „New Game“ wählen, `Ramp Labs` und Seed eingeben, bestätigen.
**UI-Orakel:** Zielanzeige ist sichtbar; Simulation ist pausiert; Growroom, zwei leere Zones, Storage und Laboratory sind navigierbar.
**State-Orakel:** `simTimeHours = 0`; World Seed stimmt; Hierarchie validiert; keine Pflanzen, Lots, Breeding Runs oder Custom Strains.
**Event-Orakel:** genau ein bestätigtes New-Game-Ereignis mit `intentId` und `simTick`.

### Schritt 2 — Zones betriebsbereit machen

**Aktion:** In jeder Zone den Setup-Wizard abschließen; mindestens ein erforderliches Gerät über Kauf/Installation hinzufügen.
**UI-Orakel:** Vor Bestätigung sind Kapazität, Kompatibilität und Kosten sichtbar; danach melden beide Zones „bereit“.
**State-Orakel:** alle Referenzen sind gültig, Device-Placement stimmt, Guthaben wurde genau einmal pro Kauf reduziert.
**Negativprobe:** denselben Purchase-Intent mit gleicher `intentId` erneut senden; kein zweiter Kauf und keine zweite Abbuchung.

### Schritt 3 — Eltern säen

**Aktion:** Northern Lights in Zone A, Sour Diesel in Zone B säen; jeweils die im Szenario festgelegte kleine Anzahl.
**UI-Orakel:** Pflanzenzahl, Sorte, Phase, Gesundheit und Alter erscheinen aus dem Read Model.
**State-Orakel:** deterministische UUIDs, aktive Seedlings, richtige Strain-/Container-/Substrat-IDs; Seedkosten exakt einmal gebucht.
**Negativprobe:** zusätzliche Aussaat in die nicht leere Zone wird autoritativ abgelehnt und als verständlicher Fehler angezeigt.

### Schritt 4 — Umweltvorfall lösen

**Aktion:** Zeitraffer starten, bis der kanonische Demo-Vorfall die Simulation pausiert; Warnung öffnen; vorgeschlagene Klima- oder Lichtanpassung ausführen; einige Ticks fortsetzen.
**UI-Orakel:** Warnung nennt Istwert, Zielband, Folge und Aktion; nach der Korrektur wechselt der Status nachvollziehbar zurück.
**State-Orakel:** Abweichung tritt am erwarteten Tick auf; Setpoint/Plan ändert sich nur nach Intent; Messwert kehrt innerhalb des spezifizierten Fensters ins Band zurück.
**Kontrafaktische Engine-Probe:** Parallelfixture ohne Korrektur endet bei gleichem Tick mit schlechterer Gesundheit, Qualität oder Biomasse als der behandelte Run.

### Schritt 5 — Eltern ernten und Teilverkauf

**Aktion:** Bis zur ersten Erntebereitschaft beschleunigen; prüfen, dass noch kein Lot existiert; Northern Lights manuell ernten; anschließend Sour Diesel manuell ernten.
**UI-Orakel:** Zeitraffer pausiert bei Reife; „Ernten“ ist erst dann aktiv; Ack führt zu Inventory-Eintrag und Qualitätsaufschlüsselung.
**State-Orakel:** Vor Harvest-Intent bleibt die Pflanze `harvest-ready` und aktiv. Danach existiert genau ein Lot pro geernteter Pflanze, Pflanze ist terminal geerntet, Lot liegt im eindeutigen Storage.
**Negativprobe:** Harvest-Intent wiederholen; kein Duplikatlot.

**Aktion:** Inventory öffnen, erstes Northern-Lights-Lot wählen, Vorschau für 50 % prüfen und verkaufen.
**UI-Orakel:** verkaufte Menge, Quality-Faktor, Preis, Erlös und Guthaben vorher/nachher sind sichtbar.
**State-Orakel:** genau 50 % bleiben mit derselben Herkunft im Inventory; genau ein Sale-Ledger-Eintrag; Guthaben steigt exakt nach der dokumentierten Formel.
**Negativprobe:** Verkauf von mehr als dem Restbestand wird abgelehnt.

### Schritt 6 — F1-Population erzeugen

**Aktion:** Laboratory öffnen; Northern Lights und Sour Diesel auswählen; Population 4 bestätigen.
**UI-Orakel:** Nur qualifizierte Eltern sind auswählbar; anschließend erscheinen vier Kandidaten neben beiden Eltern mit identischen Trait-Spalten.
**State-Orakel:** genau ein abgeschlossener Breeding Run, vier valide Kandidaten, eindeutige deterministische UUIDs, korrekte Parent-UUID-Lineage; noch keine Custom Strain.
**Negativproben:** gleiche Eltern sowie Populationsgröße 2 oder 6 werden abgelehnt.

### Schritt 7 — Kandidaten selektieren und benennen

**Aktion:** Den nach festem Zielscore besten Kandidaten wählen, `Ramp One` eingeben und übernehmen.
**UI-Orakel:** Unterschiede zum Elternmittel sind sichtbar; Bestätigung zeigt `Ramp One` in Breeding-Historie und Strain-Auswahl.
**State-Orakel:** genau eine Custom Strain referenziert Kandidat und Eltern; nur dieser Kandidat ist anbaubar; Traitwerte sind unverändert gegenüber der Vorschau.
**Negativprobe:** zweiter Kandidat desselben Runs kann nicht zusätzlich übernommen werden.

### Schritt 8 — F1 anbauen und Ziel abschließen

**Aktion:** Eine leere Zone mit `Ramp One` säen, bis Reife führen und manuell ernten; Run Summary öffnen.
**UI-Orakel:** Summary vergleicht tatsächlichen Ertrag, mittlere Qualität, Zyklusdauer und Deckungsbeitrag der F1 mit beiden Eltern; Zielstatus ist abgeschlossen.
**State-Orakel:** F1-Pflanzen wurden durch denselben Physiology-/Harvest-Pfad verarbeitet; Harvest-Lot löst die Custom-Strain-Herkunft auf; Journey-Completion-Tick ist gesetzt.

### Schritt 9 — Save, Reload, Load

**Aktion:** Slot `First F1` speichern, Seite hart neu laden, Slot laden.
**UI-Orakel:** App startet im geladenen Run; `Ramp One`, Summary, Inventory, Guthaben, Weltzeit und abgeschlossenes Ziel sind vorhanden.
**State-Orakel:** kanonischer Hash vor Save und nach Load ist identisch; keine doppelte Telemetrie, kein zusätzlicher Tick, keine erneut gebuchte Transaktion.
**Fortsetzungsprobe:** Einen weiteren Step ausführen; der neue Hash stimmt mit dem ununterbrochenen Kontrolllauf überein.

## 6. Determinismus- und Event-Orakel

Der Replay-Test zeichnet nur normalisierte Spielerintents mit stabilen IDs und expliziten Simulationsschritten auf. Er führt Trace A und B aus frischen Prozessen aus und vergleicht:

- kanonischen State Hash nach jedem Ingame-Tag und nach jedem Journey-Schritt;
- Anzahl und Reihenfolge der Lifecycle-, Harvest-, Sale-, Breeding- und Save/Load-relevanten Domain Events;
- IDs von Pflanzen, Lots, Breeding Run, Kandidaten, Custom Strain und Ledger-Einträgen;
- numerische Werte mit `EPS_REL = 1e-6` und `EPS_ABS = 1e-9`;
- Fortsetzung nach Save/Load gegen einen ununterbrochenen Kontrolllauf.

Aus Hashes ausgeschlossen bleiben ausschließlich abgeleitete/transiente Felder gemäß SEC: UI-Zustand, Socket-Verbindungsdaten, Wandzeit, formatierte Labels und gecachte Read Models. Breeding State, Economy/Ledger, Custom Strains, Intent-Idempotenz und Journey-Fortschritt sind ausdrücklich **nicht** transient.

## 7. Browser-Orakel und Selektoren

- Selektoren verwenden zugängliche Rollen/Namen oder stabile `data-testid` nur an Domänengrenzen; keine CSS-Klassen oder Tabellenindizes.
- Nach jeder Mutation wartet der Test auf den passenden Ack **und** das post-commit Read Model/Event.
- Zeitraffer wird nie durch Manipulation von `simTimeHours` ersetzt.
- Kandidatenwerte werden aus der UI gelesen und gegen das Read Model geprüft, aber niemals im Browser-Test erzeugt.
- Screenshots werden nur bei Fehlern gespeichert; visuelle Snapshots ersetzen keine Zustandsassertion.

## 8. Fehler- und Recovery-Anforderungen

Jede Negativprobe muss drei Dinge beweisen: keine autoritative Zustandsänderung, stabiler maschinenlesbarer Fehlercode und eine handlungsorientierte Meldung in der UI. Nach dem Fehler muss dieselbe Session mit korrigierter Eingabe fortsetzbar bleiben.

Verbindungsabbruch zwischen Intent und Ack wird mit derselben `intentId` wiederholt. Für Käufe, Säen, Ernten, Verkauf und Breeding darf dies nie doppelte Entitäten oder Ledger-Einträge erzeugen.

## 9. Performance-Budget

- Interaktive Acks: p95 unter 250 ms in lokaler Demo-Konfiguration, ausgenommen explizite Zeitrafferläufe.
- Read Model nach Commit: p95 unter 500 ms sichtbar.
- Beschleunigter kompletter Headless-Trace: unter 30 Sekunden auf CI-Referenzhardware.
- Browser Journey darf Simulationszeiträume per Speed-Control komprimieren und soll unter 5 Minuten Testlaufzeit bleiben.

## 10. Release-Entscheidung

Die Web-Demo ist nicht releasefähig, wenn ein Pflichtschritt übersprungen, gemockt oder nur durch Fixture-Mutation erreicht wird; wenn derselbe Intent doppelt abbucht; wenn Save/Load die RNG-Fortsetzung verändert; wenn die F1 nicht durch den normalen Grow-/Harvest-Pfad läuft; oder wenn irgendein sichtbarer Pflichtbutton ein Stub ist.

Releasefähig ist sie erst, wenn Browser Journey, Replay, kompletter Verify-Lauf und fünf moderierte Spieltests die Abnahme aus `RECOVERY_BACKLOG.md` erfüllen.

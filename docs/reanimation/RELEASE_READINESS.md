# Weed Breed — Release Readiness

Stand: 2026-09-09

## Automatisierter deterministischer Replay-Nachweis

Der R-900-Nachweis liegt unter
`packages/facade/tests/integration/replay/journeyReplay.integration.test.ts`.
Der zugehörige Headless-Treiber führt dieselbe feste Journey zweimal in zwei
frischen Welten und Command-Pipelines aus. Er verändert keine Test-Fixture und
keinen Domain-State direkt. Sämtliche Fortschritte entstehen durch produktive
Facade-Intents und jeden einzelnen kanonischen Ein-Stunden-Tick.

Die feste Trace verwendet den Seed `integration-seed` und feste UUIDs im
Namensraum `90000000-0000-4000-8000-*` für alle Intents, deren Vertrag eine
Intent-ID vorsieht. Sie umfasst:

1. `game.new.v1` und die reale Einrichtung beider Grow-Zonen mit insgesamt 14
   LEDs und zwei Klimageräten.
2. Aussaat von Northern Lights und Sour Diesel, 12/12-Lichtpläne, Auslösen und
   Korrigieren des kanonischen Temperatur-Incidents.
3. Stundenweise Simulation bis zur Reife, reale Ernte beider Eltern und einen
   real gebuchten Teilverkauf.
4. F1-Cross mit vier Kandidaten, deterministische Auswahl und Benennung von
   `Replay One`, kostenlose Wiederaussaat, erneuten 12/12-Wechsel und Setzen des
   sichtbaren F1-Temperaturband-Mittelpunkts.
5. Stundenweise Simulation bis zur realen F1-Ernte und `session.save.v1`.

Batch-Schleifen sind nur ein Testtreiber: Sie rufen weiterhin für jede Stunde
den echten `simulation.control.step`-Pfad und damit die vollständige
Neun-Phasen-Pipeline auf. Alle 100 Ticks wird lediglich der Node-Eventloop
freigegeben, damit der Testprozess erreichbar bleibt.

### Reproduzierbares Ergebnis

Beide frischen Läufe ergaben exakt:

- 5.280 Simulationsstunden beziehungsweise 220 Tagesgrenzen
- 220 paarweise identische tägliche kanonische World-Hashes
- finaler World-Hash
  `991ce7f901e425c9b37ac4f03914576a3c474f49113395d6c16aa0abfefc0dd4`
- 35.747 synchrone Telemetrie-Emissionen
- 9 von 9 chronologisch belegte Journey-Meilensteine
- 36 identische Trace-Einträge einschließlich zusammengefasster Tick-Blöcke

Für die Hashes wird der Engine-Vertrag `hashSaveGameWorld` verwendet. Er
normalisiert Objektkeys, `-0` und finite numerische Blätter auf neun
Dezimalstellen. Der Test ist damit ein harter Runtime-/Save-Replay-Nachweis;
er behauptet keine über diesen dokumentierten Hash-Vertrag hinausgehende
Plattformgarantie.

## Einziges extern ausstehendes Release-Gate

Der automatisierte Nachweis ersetzt keinen Verständlichkeits- und Spieltest.
Als einziges externes Gate bleibt der moderierte Test nach
[MODERATED_PLAYTEST_PROTOCOL.md](./MODERATED_PLAYTEST_PROTOCOL.md) offen:

- fünf echte, unabhängige Testpersonen
- mindestens vier von fünf schließen die Journey selbstständig in höchstens
  30 Minuten mit real geernteter F1 und abgeschlossenem Summary ab
- fünf von fünf verstehen ohne verbale Hilfe das Ziel, Ursache, Folge und
  Korrektur des Incidents und begründen ihre F1-Auswahl anhand sichtbarer Traits
- null P0/P1-Befunde und keine sichtbaren Stubs

Dieses Gate ist ausdrücklich **noch nicht bestanden**.

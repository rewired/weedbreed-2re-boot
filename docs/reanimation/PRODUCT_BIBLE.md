# Weed Breed — Product Bible der Reanimation

Status: verbindlicher Produktfilter für die erste Web-Demo
Stand: 8. September 2026

## 1. Das Spiel in einem Satz

> Baue einen kleinen Indoor-Grow, beherrsche seine Umwelt und erschaffe aus zwei bewährten Eltern eine eigene F1-Sorte, die in deiner realen Anlage sichtbar anders performt.

`Weed Breed` ist eine Management-Simulation über **Züchten durch Anbauen**. Die Anlage ist kein Selbstzweck, sondern der Prüfstand für Genetik. Die Zucht ist kein Menübonus, sondern die Belohnung dafür, dass der Spieler Klima, Kosten und Pflanzen verstanden hat.

## 2. Ziel der ersten Veröffentlichung

Die erste Veröffentlichung ist eine lokale Singleplayer-**Web-Demo** mit React/Vite als Oberfläche und der vorhandenen Engine/Façade als autoritativem Laufzeitsystem. Sie beweist genau eine vollständige Reise:

1. Spiel mit reproduzierbarem Seed starten.
2. Zwei Anbauzonen und ein Labor betriebsbereit machen.
3. Northern Lights und Sour Diesel säen.
4. Mindestens eine Umweltabweichung erkennen und wirksam korrigieren.
5. Beide Eltern ernten, einen Teil der Ernte verkaufen und die Eltern für Zucht qualifizieren.
6. Eine F1-Population von **3 bis 5** Kandidaten erzeugen.
7. Einen Kandidaten anhand sichtbarer Traits auswählen, benennen und als eigene Sorte übernehmen.
8. Diese F1 anbauen und mit den Eltern vergleichen.
9. Speichern, neu laden und denselben Fortschritt wiederfinden.

Ein neuer Spieler soll dieses Ziel ohne Devtools oder JSON-Eingriffe in höchstens 30 Minuten erreichen können.

## 3. Spielerfantasie und Versprechen

Der Spieler ist weder Laborwissenschaftler noch bloßer Gebäudeverwalter. Er ist Grower und Züchter mit einem klaren Lernbogen:

- **Beobachten:** Temperatur, Luftfeuchte/VPD, Licht, Pflanzenzustand und Kosten zeigen, was passiert.
- **Verstehen:** Warnungen nennen Ursache, Auswirkung und eine mögliche Gegenmaßnahme.
- **Entscheiden:** Mehr Licht, bessere Klimaführung, früher Verkauf oder riskantere Selektion haben erkennbare Vor- und Nachteile.
- **Erschaffen:** Die eigene F1 trägt nachvollziehbare Merkmale beider Eltern plus kleine deterministische Variation.
- **Beweisen:** Erst der Anbau zeigt, ob die gewählte F1 in der eigenen Anlage besser zur Strategie passt.

## 4. Die drei Loops der Demo

### Stündlicher Management-Loop

Telemetrie lesen → eine Abweichung verstehen → Licht oder Temperatur anpassen → Zeit fortsetzen → Wirkung beobachten. Ein Tick bleibt eine Spielstunde; Geschwindigkeit verändert nur die Wandzeit.

### Anbauzyklus

Sorte wählen → säen → Umwelt führen → Reife abwarten → manuell ernten → Inventar und Qualität prüfen → Teilmenge verkaufen. Die Demo verwendet nur die bereits vorhandene Cultivation Method `Basic Soil Pot` und genau die für den Journey nötigen Geräte.

### Zuchtzyklus

Zwei bereits angebaute Eltern wählen → 3–5 F1-Kandidaten erzeugen → Eltern/Kandidaten anhand derselben Trait-Spalten vergleichen → genau einen Kandidaten selektieren und benennen → F1 säen → reales Anbauergebnis vergleichen.

## 5. F1-Regeln für den Slice

- Nur **F1**. Kein F2, BX, IBL, Stabilisieren, Forschungsbaum oder Langzeitprogramm.
- Zwei verschiedene Eltern sind erforderlich; beide müssen im aktuellen Spiel mindestens eine qualifizierte Ernte hervorgebracht haben.
- Der Spieler wählt eine Populationsgröße von 3, 4 oder 5; Standard ist 4.
- Jeder Kandidat erhält eine deterministische UUID und Lineage aus den Eltern-UUIDs.
- Traits entstehen aus Elternmittelwerten plus kleiner, begrenzter Variation aus `createRng(world.seed, streamId)`; keinerlei `Math.random`, `Date.now()` oder zufällige UUID-Erzeugung.
- Für die Demo sichtbar und bewertbar sind genau: Ertragspotenzial, Zyklusdauer, Robustheit, THC/CBD und bevorzugtes Temperaturband. Genotypanteile dürfen zusätzlich angezeigt werden, sind aber keine eigene Spielmechanik.
- F1-Heterosis darf als kleiner, dokumentierter Bonus auf Wachstum oder Ertrag wirken. Alle Werte werden auf die gültigen Bereiche des aktuellen Strain-Schemas begrenzt.
- Nur der selektierte Kandidat wird zur benannten Custom Strain. Nicht gewählte Kandidaten bleiben im abgeschlossenen Breeding Run als Historie, aber sind nicht anbaubar.
- Eine Custom Strain ist Laufzeitinhalt des Savegames, kein zur Laufzeit geschriebenes Blueprint-JSON unter `/data`.

Der alte Prototyp liefert den bewährten UX-Kern (zwei Eltern, direkter Trait-Vergleich, Name), nicht seine Technik: `D:/__DEV/weed-breed-ai/components/modals/content/BreedStrainModalContent.tsx` und `D:/__DEV/weed-breed-ai/game/models/Company.ts`. Das detaillierte Konzept in `D:/__DEV/weebbreed-reboot/docs/addendum/ideas/breeding_module.md` ist nur Quelle für deterministische Mischung, Population und Heterosis. Seine F2/BX/IBL-, Zeitplan- und `randomUUID`-Teile sind für diesen Slice ausdrücklich verworfen.

## 6. Economy und Workforce

Die Demo führt ein einziges verständliches Guthaben in Company Credits. Sichtbar sind Startguthaben, Käufe, laufende Strom-/Wasser-/Anbaukosten, Verkaufserlös und Deckungsbeitrag des Zyklus. Die existierenden Preisdateien bleiben Quelle; Device-Blueprints bleiben preisfrei.

Workforce ist **automatisiert**:

- Ein fester Kapazitätspool erledigt fällige Standardaufgaben automatisch.
- Fehlende Kapazität kann eine Aktion verzögern und wird als verständlicher Hinweis angezeigt.
- Mitarbeiterverzeichnis, Kandidatenmarkt, Gehaltsverhandlung, Persönlichkeit und manuelle Zuweisung gehören nicht zur Hauptnavigation der Demo.
- Das tiefe vorhandene Workforce-System darf intern weiterlaufen, bestimmt aber nicht den Produktpfad und erhält im Slice keine neuen Features.

## 7. Startzustand und Schwierigkeit

Die Demo startet pausiert mit einer kleinen Structure, einem Growroom, zwei leeren Zones, einem Storage Room und einem Laboratory. Basisausstattung darf als Quick-Start-Paket vorhanden sein; der Spieler muss mindestens eine nachvollziehbare Kauf-/Installationsentscheidung treffen. Northern Lights und Sour Diesel sind verfügbar. Startguthaben ist so bemessen, dass eine schlechte Entscheidung spürbar, ein einmaliger Fehlkauf aber nicht sofort run-beendend ist.

Ein geskripteter, deterministischer Temperatur- oder Feuchtevorfall stellt sicher, dass jeder Demo-Run eine erklärbare Reaktion verlangt. Es gibt im Slice höchstens einen weiteren biologischen Risikotyp; wenn er die 30-Minuten-Reise gefährdet, wird er deaktiviert.

## 8. UX-Vertrag

- Jede sichtbare Primäraktion hat einen autoritativen Intent und sichtbares Erfolgs- oder Fehlerfeedback. Andernfalls wird sie ausgeblendet.
- Die Hauptnavigation folgt der Reise: **Grow → Inventory → Breeding → Run Summary**. Workforce wird aus der Hauptnavigation entfernt.
- Jeder Warnhinweis beantwortet: Was ist falsch? Was bewirkt es? Was kann ich jetzt tun?
- Eltern und F1-Kandidaten werden in derselben Vergleichstabelle mit identischen Einheiten gezeigt.
- Zeitraffer stoppt automatisch bei entscheidungsrelevanten Ereignissen: Umweltvorfall, Erntebereitschaft, abgeschlossener Breeding Run und unzureichende Arbeitskapazität.
- Der Spieler kann nie unbeabsichtigt automatisch ernten oder verkaufen. Reife und Verkauf sind Entscheidungen.

## 9. Harte Nicht-Ziele

- Kein weiteres Repository, Reboot, Framework oder Transportprotokoll.
- Kein Desktop-Build und kein öffentliches Hosting als Voraussetzung der Demo.
- Kein F2/BX/IBL, keine Samenreifungs-Simulation und keine Mendel-Locus-Simulation.
- Kein Dry/Cure-Subsystem, kein differenzierter Markt, keine Verträge oder Markenökonomie.
- Kein Workforce-Mikromanagement, keine Plugins, Mods, Editoren, Terminalmonitore oder externe Identitätsquellen.
- Keine neuen Blueprint-Kategorien und kein Content-Ausbau außerhalb der Journey.
- Keine kosmetische Politur, solange der Journey-Test nicht grün ist.

## 10. Definition of Done

Die Demo ist fertig, wenn ein frischer Browser die neun Schritte reproduzierbar ausführen kann, gleiche Seeds plus gleiche Intents denselben kanonischen Endzustand ergeben, ein Reload den selektierten F1-Kandidaten erhält und Build, Typecheck, Lint, Unit-/Integrationstests sowie der Journey-Test gemeinsam grün sind. Fertig bedeutet nicht „Subsystem implementiert“, sondern „Spielerhandlung bis sichtbare Konsequenz integriert“.

## 11. Technische Leitplanken

- SEC v0.2.1 und `AGENTS.md` bleiben für Engine-Invarianten maßgeblich.
- Engine → Façade → UI bleibt die Richtung; UI sendet Intents und liest Projektionen.
- Telemetrie bleibt read-only und getrennt vom Intent-Kanal.
- Dynamic/Custom Strains leben im World-/Save-State und werden vor dem statischen Blueprint-Katalog aufgelöst.
- Existierende Module werden erweitert statt kopiert: Tick-Pipeline, `applyHarvestAndInventory`, Inventory-Readmodels, `strainBlueprint`, `createRng`, deterministische UUID-Helfer und Save-Schemas.
- Jede Backlog-Aufgabe muss einem Schritt der Journey zugeordnet sein. Roter Main stoppt neue Features.

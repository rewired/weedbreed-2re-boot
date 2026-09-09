# Weed Breed — Moderiertes Playtest-Protokoll „First F1“

Status: **extern ausstehendes Release-Gate**
Geltungsbereich: R-900, lokale Singleplayer-Web-Demo
Teilnehmende: fünf echte, voneinander unabhängige Testpersonen

## 1. Zweck und harte Abnahme

Der Test prüft, ob ein neuer Spieler ohne Erklärung die vollständige Reise versteht und abschließt:

`Grow → Inventory → Breeding Lab → Run Summary`

Die moderierten Tests sind erst bestanden, wenn alle folgenden Bedingungen durch tatsächlich beobachtete Sitzungen belegt sind:

- Genau fünf echte Testpersonen absolvieren je einen frischen Lauf. Teammitglieder, Bots, Agenten und nachgespielte Sitzungen zählen nicht.
- Mindestens vier von fünf erreichen innerhalb von 30 Minuten eine angebaute und manuell geerntete eigene F1 sowie den abgeschlossenen Run Summary.
- Alle fünf können ohne inhaltliche Hilfe erklären:
  1. dass das Ziel eine eigene, real angebaute und geprüfte F1 ist;
  2. wodurch der Klima-Incident verursacht wird, welche Auswirkung er hat und warum die gewählte Korrektur hilft;
  3. warum sie ihren F1-Kandidaten anhand der sichtbaren Traits ausgewählt haben.
- Während der fünf Sitzungen tritt kein P0- oder P1-Fehler und keine sichtbare Stub-Aktion auf.
- Technische Automatisierung und `pnpm verify` ersetzen diese Beobachtung nicht.

Bis fünf ausgefüllte Beobachtungsbögen und eine unterschriebene Auswertung vorliegen, bleibt dieses Gate **nicht bestanden**.

## 2. Teilnehmerprofil

Rekrutiere fünf Personen, die die konkrete Demo noch nicht gespielt haben. Mindestens drei sollen weder am Projekt gearbeitet noch die Produktdokumente gelesen haben. Halte pro Person nur folgende, nicht identifizierende Angaben fest:

- Teilnehmercode `P01` bis `P05`;
- Erfahrung mit Management-/Aufbauspielen: keine, gelegentlich oder häufig;
- Vorwissen zu Pflanzenzucht: keines, allgemein oder fachlich;
- verwendeter Browser, Bildschirmgröße und Eingabegerät.

Keine Namen, Kontaktdaten oder Aufnahmen ohne gesonderte Einwilligung in dieses Dokument eintragen.

## 3. Testumgebung und Vorbereitung

Vor jeder Sitzung:

1. Den für den Release vorgesehenen Commit und die lokale Produktionskonfiguration starten.
2. `pnpm verify` ausführen und Ergebnis/Commit im Beobachtungsbogen notieren.
3. Browser-Speicher, Save-Slots und Service-Worker-Daten von Weed Breed löschen.
4. Einen frischen Browserkontext öffnen; Zoom 100 %, keine Entwicklerwerkzeuge sichtbar.
5. Prüfen, dass UI und Façade verbunden sind, ohne bereits ein Spiel zu starten.
6. Bildschirmaufnahme nur mit vorheriger Einwilligung starten; andernfalls ausschließlich Zeitpunkte und Beobachtungen notieren.

Jede Person erhält denselben Rechnerzustand, aber wählt ihren Company-Namen und optionalen Seed selbst. Der Moderator greift nicht in Maus oder Tastatur ein.

## 4. Wortlaut für den Moderator

### Einführung

> Du testest heute eine unfertige lokale Spieldemo, nicht deine Fähigkeiten. Bitte denke laut und sage, was du erwartest, bevor du klickst. Dein Ziel ist, eine eigene F1-Sorte zu erschaffen, sie real anzubauen und das Ergebnis zu prüfen. Alles Weitere soll dir das Spiel selbst erklären. Du hast maximal 30 Minuten.

Danach keine Spielmechanik, Navigation, Incident-Ursache, Trait-Bedeutung oder optimale Auswahl erklären.

### Zulässige neutrale Antworten

- „Was erwartest du an dieser Stelle?“
- „Was zeigt dir die Oberfläche?“
- „Was würdest du als Nächstes versuchen?“
- „Bitte beschreibe, warum du diese Entscheidung triffst.“
- Bei einem technischen Stillstand: „Ich notiere das als Problem.“

### Unzulässige Hilfen

- eine Route, Schaltfläche oder Eingabe nennen oder darauf zeigen;
- sagen, wann beschleunigt, pausiert, geerntet oder verkauft werden soll;
- Incident-Zielwerte oder die richtige Korrektur vorsagen;
- einen Elternteil, Kandidaten oder Trait empfehlen;
- erklären, dass erst eine echte F1-Ernte das Ziel abschließt;
- einen Fehler durch direkte State-, URL-, Speicher- oder Entwicklerwerkzeug-Manipulation umgehen.

Benötigt eine Person eine unzulässige Hilfe, wird sie samt Zeitpunkt notiert. Die Sitzung darf zur Diagnose fortgesetzt werden, zählt aber nicht als selbstständig abgeschlossen.

## 5. Aufgaben und Beobachtungspunkte

Der Moderator liest nur die Einführung vor. Die folgenden Punkte sind eine interne Checkliste und werden nicht als Schritt-für-Schritt-Anleitung gezeigt.

| Abschnitt | Erwartetes sichtbares Verhalten | Zu beobachten |
| --- | --- | --- |
| Start und Ziel | Neues Spiel starten; Ziel „Erzeuge und teste deine erste F1“ erkennen | Kann die Person das Ziel vor dem ersten Grow-Schritt in eigenen Worten wiedergeben? |
| Grow vorbereiten | Beide Zones betriebsbereit machen und Northern Lights/Sour Diesel säen | Findet sie die Grow-Zones und versteht Kosten, Bereitschaft und Sortenwahl? |
| Incident | Warnung bemerken, Ursache/Folge lesen, vorgeschlagene Korrektur anwenden | Stoppt sie bei der Warnung? Kann sie Problem und Wirkung vor dem Anwenden erklären? |
| Ernte und Inventory | Eltern manuell ernten, Inventory öffnen, Verkaufsvorschau verstehen und 50 % verkaufen | Findet sie den Wechsel Grow→Inventory und erkennt sie Menge, Erlös und Guthabenänderung? |
| Breeding Lab | Zwei qualifizierte, verschiedene Eltern und Population 4 kreuzen | Ist klar, warum vorher keine bzw. jetzt genau diese Eltern verfügbar sind? |
| F1-Auswahl | Kandidaten mit denselben Traitspalten vergleichen, einen auswählen und benennen | Nennt sie mindestens einen sichtbaren Trade-off oder Vorteil als Auswahlgrund? |
| F1 anbauen | Nur die selektierte F1 säen, bis zur Reife führen und manuell ernten | Versteht sie, dass nicht ausgewählte Kandidaten nicht anbaubar sind? |
| Run Summary | Run Summary öffnen und Abschluss erkennen | Unterscheidet sie reale Messwerte von Blueprint-Potenzial und erkennt sie den Zielabschluss? |
| Save/Reload | Benannten Slot speichern, Browser neu laden und Slot laden | Bleiben Sorte, Inventory, Guthaben, Zeit, Playback, Journey und Summary verständlich erhalten? |

Zeitmessung beginnt mit sichtbarem Startscreen und endet, sobald die Person im Run Summary den abgeschlossenen Status korrekt benennt. Setup- oder Ladezeiten außerhalb ihrer Kontrolle werden separat notiert, aber nicht stillschweigend aus der Messung entfernt.

## 6. Verständnisfragen ohne Lehrwirkung

Stelle die Frage jeweils erst, nachdem die Person die zugehörige Entscheidung getroffen hat:

1. Nach Spielstart: „Was ist dein Ziel in diesem Lauf, und woran wirst du erkennen, dass es erreicht ist?“
2. Vor Incident-Korrektur: „Was ist hier das Problem, welche Folge erwartest du und warum sollte deine Aktion helfen?“
3. Vor F1-Übernahme: „Warum wählst du genau diesen Kandidaten? Welche sichtbaren Werte waren ausschlaggebend?“
4. Im Run Summary: „Welche Werte stammen aus dem echten Anbau und welche beschreiben nur das Potenzial?“

Eine Antwort gilt als verstanden, wenn sie den fachlichen Zusammenhang in eigenen Worten korrekt trifft. Das Wiederholen einzelner UI-Begriffe ohne Zusammenhang genügt nicht. Der Moderator korrigiert Antworten erst nach Ende der Zeitmessung.

## 7. Schweregrade und Abbruchregeln

| Schweregrad | Definition | Beispiele |
| --- | --- | --- |
| P0 | Datenverlust, nicht wiederherstellbarer Lauf, Absturz oder autoritativ falscher Zustand | Save zerstört den Lauf; F1/Inventory verschwinden; doppelte Abbuchung; Hash-/State-Widerspruch |
| P1 | Pflichtreise ohne technische Umgehung nicht abschließbar oder Kernentscheidung fachlich irreführend | Primäraktion ist Stub; Incident ohne erkennbare Handlung; falscher Kandidat wird angebaut; Summary meldet Abschluss vor F1-Ernte |
| P2 | Deutliche Reibung mit möglicher selbstständiger Erholung | Beschriftung wird mehrfach missverstanden; Route wird lange gesucht; Fehlermeldung hilft nicht |
| P3 | Kosmetische oder geringe Reibung | Ausrichtung, Wortwahl oder unwichtige visuelle Inkonsistenz |

Bei P0 wird die Sitzung sofort beendet und der Build gesichert. Bei P1 darf zur Ursachenanalyse fortgesetzt werden, die Sitzung gilt aber nicht als Erfolg. P2/P3 werden gesammelt und priorisiert; sie dürfen die harten Verständnis- und Zeitkriterien nicht nachträglich relativieren.

## 8. Beobachtungsbogen — pro Person kopieren

### Sitzungsdaten

| Feld | Eintrag |
| --- | --- |
| Teilnehmercode | |
| Datum / Moderator | |
| Commit / Build | |
| Browser / Viewport / Eingabe | |
| Managementspiel-Erfahrung | |
| Zucht-Vorwissen | |
| Einwilligung Bildschirmaufnahme | ja / nein |

### Zeit und Verlauf

| Meilenstein | Uhrzeit ab Start | selbstständig? | Beobachtung / Irrweg / Zitat |
| --- | ---: | --- | --- |
| Ziel korrekt beschrieben | | ja / nein | |
| Erste Zone bereit | | ja / nein | |
| Beide Eltern gesät | | ja / nein | |
| Incident verstanden und korrigiert | | ja / nein | |
| Eltern geerntet und 50 % verkauft | | ja / nein | |
| Vier F1-Kandidaten sichtbar | | ja / nein | |
| Kandidat begründet und benannt | | ja / nein | |
| Eigene F1 gesät | | ja / nein | |
| Eigene F1 manuell geerntet | | ja / nein | |
| Run Summary als abgeschlossen erkannt | | ja / nein | |
| Save nach Reload erfolgreich geladen | | ja / nein | |

### Verständnis und Fehler

| Prüffrage | bestanden? | Wortlaut der Antwort / Evidenz |
| --- | --- | --- |
| Ziel und Abschlusskriterium verstanden | ja / nein | |
| Incident-Ursache, Folge und Korrektur verstanden | ja / nein | |
| F1-Auswahl anhand sichtbarer Traits begründet | ja / nein | |
| Reale Werte vs. Blueprint-Potenzial unterschieden | ja / nein | |

| Problem-ID | Zeitpunkt | Schweregrad | Erwartung | Beobachtung | reproduzierbar? |
| --- | ---: | --- | --- | --- | --- |
| | | | | | |

**Endzeit bis abgeschlossenem Run Summary:** ____ Minuten
**Unzulässige Hilfe benötigt:** ja / nein; falls ja: ____
**Sitzung zählt als selbstständiger Abschluss ≤30 Minuten:** ja / nein
**P0/P1 aufgetreten:** ja / nein

## 9. Gesamtauswertung und Release-Entscheidung

| Kennzahl | P01 | P02 | P03 | P04 | P05 | Ergebnis |
| --- | --- | --- | --- | --- | --- | --- |
| Abschlusszeit in Minuten | | | | | | |
| Selbstständig ≤30 Minuten | | | | | | mindestens 4/5 erforderlich |
| Ziel verstanden | | | | | | 5/5 erforderlich |
| Incident verstanden | | | | | | 5/5 erforderlich |
| F1-Auswahl verstanden | | | | | | 5/5 erforderlich |
| P0/P1-frei | | | | | | 5/5 erforderlich |

Release-Entscheidung erst nach allen fünf Sitzungen:

- [ ] Fünf echte Sitzungen vollständig dokumentiert.
- [ ] Mindestens vier selbstständige Abschlüsse in höchstens 30 Minuten.
- [ ] Zielverständnis 5/5.
- [ ] Incident-Verständnis 5/5.
- [ ] Begründete F1-Auswahl 5/5.
- [ ] Keine P0/P1-Fehler und keine sichtbaren Stubs.
- [ ] Offene P2/P3 mit Owner und Entscheidung dokumentiert.

**Gate:** offen / bestanden / nicht bestanden
**Ausgewertet von / Datum:** ____________________
**Verweise auf Beobachtungsbögen und Issues:** ____________________

Ohne ausgefüllte Nachweise bleibt „offen“ die einzig zulässige Voreinstellung.

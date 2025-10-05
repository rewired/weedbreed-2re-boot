# HR & Workforce — Feature Request (MVP, Finalized)

> Status: **Final** · Owner: TBD · Labels: domain/hr, engine/workforce, ui/read-model · Target: MVP

---

## 1) Summary & Goals

* Mitarbeitende sind genau **einer** Structure zugeordnet (keine Cross‑Site‑Einsätze im Tick).
* Deterministische Aufgabenvergabe & Auslastung je Structure innerhalb der Tick‑Pipeline.
* Schichtplanung **light** mit Arbeitszeitkontingent (Gleitzeit, min 5 h, max 16 h/Tag; OT bis +5 h/Tag mit Morale‑Malus).
* Zustandsgrößen auf **0..1‑Skalen**: `skills{}`, `morale01`, `fatigue01`.
* Monitoring/KPIs: Queue‑Tiefe, erledigte Tasks/Tick, Auslastung, p95‑Wartezeit, Overtime‑Minuten, Wartungsrückstand.
* **Payroll IN‑SCOPE**: deterministische Stundenkostenerfassung (ohne Währung in der Engine).

---

## 2) Scope

**In‑Scope (MVP)**

* Personalstamm, Schicht/Arbeitszeit, Aufgabenmatching, Dispatcher/Arbiter, KPIs/Telemetry
* Identity‑Sourcing (online→offline) + deterministischer Personen‑RNG
* Payroll (Formel unten), Learning‑by‑Doing

**Out‑of‑Scope (MVP)**

* Urlaubsverwaltung, Lohnabrechnungsexporte/Steuern, Bewerbungsprozess/Talentpipeline, Site‑Wechsel am selben Tag

---

## 3) Domain Model (Engine)

**Employee (immutable identity keys in bold):**

* **`id: UUID`**, **`structureId: ID`**
* **`firstName: string`**, **`lastName: string`**, **`gender: 'm'|'f'|'d'`**
* **`rngSeedUuid: UUIDv7`** *(Pflicht nur für **personenbezogenen RNG‑Seed**; andere IDs frei)*
* `role: EmployeeRole`
* `skills: Record<SkillKey, number /*0..1*/>` (Keys aus `data/configs/task_definitions.json`)
* `morale01: number`, `fatigue01: number`
* `hourBudgetPerDay: number /*hours*/`
* `overtimePolicy: { allow: boolean; dailyMaxH: number }`

**Rollen (MVP):** `Gardener`, `Technician`, `Janitor`
**Später:** `LabTech`, `Supervisor`

**Datenschutz (Spiel):** Pseudodaten; keine DOB/Adresse/Kontakt.

---

## 4) Identity Sourcing & Fallback

**Primär (online):** randomuser.me mit `seed={rngSeedUuid}`; Mapping `male→'m'`, `female→'f'`, sonst `'d'`; Timeout 500 ms.

**Fallback (offline, garantiert):** `/data/personnel/first_names.json`, `/data/personnel/last_names.json`, `/data/personnel/traits.json` (Traits **Flavor‑only**). Ziehung deterministisch via Personen‑RNG.
**Default Gender‑Verteilung:** `{ m: 0.49, f: 0.49, d: 0.02 }`.

---

## 5) Skills: Initialisierung & Progression

**Initialisierung bei Einstellung:** Für **alle** `SkillKey`s:

```
skill[k] = lerp(0.05, 0.5, rng_person.next01()) // deterministisch pro Mitarbeiter
```

**Learning‑by‑Doing:** Nach Abschluss eines Tasks `τ`: für jeden `k ∈ τ.requiredSkills`

```
skill[k] ← clamp(skill[k] + 0.01, 0.05, 1.00)
```

---

## 6) Matching & Produktivität

* Mindest‑Skill‑Schwellen → Best‑Fit (Skill × Verfügbarkeit) → Round‑Robin bei Gleichstand.
* Morale/Fatigue‑Einfluss **gering (±10%)** auf Produktivität.

---

## 7) Arbeitszeit, Overtime & Breakroom

* Tagesfenster 00–24; Gleitzeit.
* **Budgets:** min 5 h / max 16 h pro Tag (hart).
* **Overtime:** erlaubt bis **+5 h/Tag** (innerhalb 16 h Cap).
* **Morale‑Malus bei OT:** linear **−0.02 pro OT‑Stunde**, gedeckelt **−0.10** pro Tag.
* **Breakroom:** **−0.02 `fatigue01` pro 30 min Aufenthalt** (tick‑proportional; nie < 0).

---

## 8) Tasks, Prioritäten & Arbiter

**Katalog (MVP):**

* *Gardener:* Re/Plant, manuelle Bewässerung, Ernte, Substratwechsel
* *Technician:* Wartung, Reparatur, Filterwechsel
* *Janitor:* Reinigung, Quarantäne‑Hygiene

**Priorität:** Pflanzenschutz > Ernte > Re‑Plant > Wartung > Reinigung
**Dispatcher/Arbiter:** zentral je Structure
**Kapazität:** weiche Grenzen (Morale‑Penalty), nie über harte Arbeitszeitlimits.

---

## 9) Pipeline & Telemetrie

* **Hook‑Position:** Workforce nach **Irrigation**, vor Economy/Costs; Commit‑Barrier gewahrt.
* **KPIs:** erledigte Tasks, offene Queue, Auslastung (%), p95‑Wartezeit, Overtime‑Minuten, Wartungsrückstand (Tick/Tag).

---

## 10) Payroll (Engine‑intern)

**Stundenlohn‑Formel (pro Minute akkumuliert):**

```
relevantSkill = avg(skill[k] for k in task.requiredSkills) // sonst avg aller Skills
base = 5                                     // 5/h
skillTerm = 10 * relevantSkill               // bis +10/h
rate = (base + skillTerm) * locationIndex * otMultiplier
minuteCost = rate / 60
```

* **OT‑Multiplikator:** **1.25×** für alle OT‑Minuten (jenseits Tagesbudget).
* **Location‑Index:** pro Structure aus `/data/payroll/location_index.json` (Default 1.00).
* **Aggregation:** per‑Tick/Minute → **täglich**, Banker’s Rounding am Tagesende.
* **Read‑Model (pro Tag & Structure):** `baseMinutes`, `otMinutes`, `baseCost`, `otCost`, `totalLaborCost`.

---

## 11) UI/UX Read‑Model

* **Directory:** Filter (Structure/Rolle/Skill/Gender).
* **Live‑Queue:** Priorität, ETA, Zuständigkeit.
* **Employee‑Detail:** Name, Gender‑Badge, Rolle, Skills, Morale/Fatigue, Schicht, heutige Stunden, **rngSeedUuid (readonly, Debug)**.
* **Warnungen:** Unterdeckung, SLA‑Verletzungen, Overtime‑Trend, Skill‑Mismatch.

---

## 12) Agents (opt‑in)

Aktivierbar: Auto‑Replant, Harvest‑Scheduler, Maintenance‑Advisor, Cleaning‑Cadence. Policies TBD (16 h hard cap bindend).

---

## 13) Files to Add

* `/data/personnel/first_names.json`, `/data/personnel/last_names.json`, `/data/personnel/traits.json`
* `/data/payroll/location_index.json`

---

## 14) Acceptance Criteria (MVP)

1. **Deterministische Zuweisung** gemäß Priorität/Skills unter Last.
2. **Structure‑Binding**: keine Cross‑Site‑Einsätze im Tick.
3. **Identity deterministisch**: Gleiches `rngSeedUuid` (v7) liefert stabil `firstName/lastName/gender` (online & offline Golden).
4. **Fallback robust**: Online‑Timeout (≤ 500 ms) → Offline‑Namen; Employee‑Erstellung schlägt nicht fehl.
5. **Skills‑Bounds**: Bei Einstellung `∀k: 0.05 ≤ skill[k] ≤ 0.5`; LbD: +0.01 pro relevantem Skill/Task, max 1.00.
6. **OT‑Morale**: −0.02/h, Cap −0.10/Tag; **Breakroom** senkt `fatigue01` um 0.02 je 30 min (proportional).
7. **Payroll**: `rate = (5 + 10*relevantSkill) * locationIndex * otMultiplier`; OT 1.25× nur jenseits Budget; **tägliche** Aggregation + Banker’s Rounding.
8. **KPIs** sichtbar (Tick/Tag): Durchsatz, Backlog, Auslastung, p95‑Wartezeit, OT‑Minuten, Wartungsrückstand.
9. **Immutability**: Identity‑Felder & `rngSeedUuid` unveränderlich nach Erstellung.

---

## 15) Test Plan (High‑Level)

* **Golden**: feste v7‑Seeds → identische Identitäten (online/offline via `forceOffline`).
* **Bounds/Distribution**: Property‑Test für Skill‑Bounds; deterministische Wiederholbarkeit pro Seed.
* **OT‑Grenze**: exakte Umschaltung ab erster OT‑Minute; 1.25× nur für OT‑Minuten.
* **Morale/Breakroom**: Malus‑Kurve & Breakroom‑Dosis verifizierbar, nie < 0.
* **Payroll**: Tagessummen & Banker’s Rounding; Location‑Index skaliert linear; Idempotente Reberechnung aus Commit‑Log.
* **Validation**: schema/zod erzwingt v7 für `rngSeedUuid` (nur Employee); andere IDs beliebig gültig.

---

## 16) Open Questions / Future

* Bewerbungsprozess / Hiring‑Pipeline, Senioritätsbänder, Schichtdifferenziale (Nacht), weitere Payroll‑Parameter.
* Traits mit Gameplay‑Einfluss (optional), Supervisor‑Logik, 3‑Schicht‑Betrieb.

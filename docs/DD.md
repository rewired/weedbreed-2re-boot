# Design Document (DD) — Weed Breed (Aligned to **Simulation Engine Contract v0.2.1**)

> **Audience:** Architects, senior engineers, Coding‑AI ("Codex").  
> **Contract precedence:** If this DD and the **Simulation Engine Contract (SEC)** disagree, **SEC wins**.

---

## 0) Executive Summary

Weed Breed is a deterministic, tick‑driven cultivation & economy simulator. The **headless engine** advances a world tree (**Company → Structure → Room → Zone → Plant → Device**) in **fixed one‑hour ticks**. The **façade** validates intents, computes read‑models, and emits **read‑only telemetry** via a transport adapter (Socket.IO default). This DD specifies structure, data flows, invariants, performance budgets, and integration points **exactly aligned** to SEC v0.2.1.

UI component layer: shadcn/ui (on Radix primitives) with Tailwind for styling; icons via lucide-react; micro-animations via Framer Motion. Charts via Recharts, optionally Tremor for dashboard presets. Components are in-repo (shadcn “copy-in” model) to avoid vendor lock and keep them themable with Tailwind.

Local version markers (`.nvmrc`, `.node-version`) pin Node.js 22 (LTS) for both local development and CI; the entire stack runs Node.js 22 (LTS) per ADR-0012.

---

## 1) Goals / Non‑Goals

**Goals**

- Deterministic simulation with reproducible seeds and stream‑scoped RNG.
- Test-only determinism scaffolds (`hashCanonicalJson`, `newV7`) live under `packages/engine/src/shared/determinism` until an ADR approves runtime adoption (see docs/tasks/0002A).
- Strict conformance to **per‑hour** economic units; tick derives from hours.
- Clean separation of **engine** (no I/O) and **façade/transport**.
- Enforce **roomPurpose**, **device placement**, and **zone cultivationMethod** rules.
- Realistic device capacity and **power→heat** coupling.

**Non‑Goals**

- No dynamic energy/water market modelling (tariffs fixed at sim start unless a scenario explicitly overrides policy).
- No 3D geometry or CFD; we use lumped‑parameter environment models.
- Psychrometric helper (`computeVpd_kPa`) is test-only until docs/tasks/0003A greenlights pipeline integration and `psychrolib` ships the ^2 release.

---

## 2) Canonical Constants (SEC §1.2)

- `AREA_QUANTUM_M2 = 0.25` — minimal calculable floor area.
- `ROOM_DEFAULT_HEIGHT_M = 3` — default room height, overridable by blueprint.
- `HOURS_PER_TICK = 1` — one in‑game hour per tick.
- Calendar: `HOURS_PER_DAY = 24`, `DAYS_PER_MONTH = 30`, `MONTHS_PER_YEAR = 12`.
- Thermodynamics: `CP_AIR_J_PER_KG_K = 1 005`, `AIR_DENSITY_KG_PER_M3 = 1.2041`.
- Headquarters defaults: `DEFAULT_COMPANY_LOCATION_LAT = 53.5511`, `DEFAULT_COMPANY_LOCATION_LON = 9.9937`, `DEFAULT_COMPANY_LOCATION_CITY = "Hamburg"`, `DEFAULT_COMPANY_LOCATION_COUNTRY = "Deutschland"`.

**Implementation:** centralize in `src/backend/src/constants/simConstants.ts`; no magic numbers.

---

## 3) World Model (SEC §2)

Hierarchy and constraints:

- **Company** → **Structure** (max usable area/volume; may represent outdoor fields).
- Company metadata stores `location` (`longitude`, `latitude`, `city`, `country`) with SEC clamps and Hamburg defaults until UI capture overrides them.
- **Room** with mandatory `roomPurpose` ∈ {growroom, breakroom, laboratory, storageroom, salesroom, workshop}.
- **Zone** only inside **growrooms**; **must** declare `cultivationMethodId`.
- **Plant** belongs to a zone; physiology depends on schedule & environment.
- **Device** attaches by `placementScope: 'zone'|'room'|'structure'` with `allowedRoomPurposes` eligible set.

Implementation note: Engine code codifies the hierarchy in
`packages/engine/src/backend/src/domain/world.ts`. The validation module pairs
`validateCompanyWorld` with a dedicated `validateRoom` helper so structure-level
and room-level guardrails remain focused while still enforcing SEC contracts
(room purposes, cultivation methods, photoperiod schedule, device placement,
geometry bounds) before the tick pipeline consumes a scenario payload.

---

## 4) Data Layout & Schemas (SEC §3, §7.5)

```
/data
  /blueprints
    /device/climate/cool-air-split-3000.json
    /device/airflow/exhaust-fan-4-inch.json
    /cultivation-method/sea-of-green.json
    /substrate/soil-single-cycle.json
    /container/pot-10l.json
    /room/purpose/growroom.json
    ...
  /prices
    electricity.json
    water.json
    ...
  /...
```

**Blueprints are templates**; never mutated at runtime. **Prices are separated** from device blueprints.

Validation schemas live alongside the engine domain types (`packages/engine/src/backend/src/domain`) so the engine stays the single source of truth; façade packages import the engine exports instead of maintaining copies (ADR-0005).

- **Blueprint taxonomy:** All blueprints expose `class` values using a domain-level
  identifier (`strain`, `cultivation-method`, `device.climate`, `room.purpose.growroom`,
  etc.) plus a kebab-case `slug` unique within that class. JSON stays authoritative for
  metadata; the filesystem only provides expectations. When the folder taxonomy and
  JSON `class` disagree, the loader throws a `BlueprintTaxonomyMismatchError` and
  rejects the payload. Subtype information (device climate mode, airflow subtype,
  cultivation family/technique, pathogen, taxon, substrate material/cycle, irrigation
  method/control, etc.) is expressed by explicit fields within the JSON payload instead
  of being inferred from paths.

- Device blueprints declaring multi-interface capabilities include `effects` arrays with matching config blocks (`thermal`, `humidity`, `lighting`, etc.); `createDeviceInstance` copies and freezes them so pipeline stages consume blueprint intent deterministically.

Blueprint directory rule: All blueprints are auto-discovered under /data/blueprints/<domain>/<file>.json with a maximum depth of two segments (domain + file). Devices are /data/blueprints/device/<category>.json or /data/blueprints/device/<category>/<file>.json limited to two levels; no deeper subfolders are allowed.

### 4.2 Price Maps

- `/data/prices/devicePrices.json` captures device **CapEx** (`capitalExpenditure`), **scheduled service visit costs** (`maintenanceServiceCost`), and **maintenance** progression (`baseMaintenanceCostPerHour`, `costIncreasePer1000Hours`).
- `/data/prices/utilityPrices.json` is the canonical tariff source exposing **`price_electricity` per kWh** and **`price_water` per m³** only; nutrient costs are derived from irrigation/substrate consumption, not a standalone utility price (ADR-0004).
  - **Decision:** Monetary field names stay currency-neutral — never encode `EUR`, `USD`, `GBP`, symbols, or locale-specific suffixes. Scenario configuration contextualizes the neutral cost values.

### 4.1 Cultivation Method (minimum shape)

```json
{
  "id": "uuid",
  "slug": "scrog",
  "name": "Screen of Green",
  "areaPerPlant_m2": 0.2,
  "containers": [
    { "id": "uuid", "slug": "pot-10l", "capex_per_unit": 2.0, "serviceLife_cycles": 8 }
  ],
  "substrates": [
    {
      "id": "uuid",
      "slug": "soil-basic",
      "purchaseUnit": "liter",
      "unitPrice_per_L": 0.15,
      "densityFactor_L_per_kg": 0.7,
      "reusePolicy": {
        "maxCycles": 1,
        "sterilizationTaskCode": "sterilize_substrate"
      }
    }
  ],
  "notes": "SEC §7.5 compliant"
}
```

- Additional required metadata for taxonomy v2:
  - `family` (e.g. `training`, `soil`, `hydroponic`).
  - `technique` (canonical slug such as `sog`, `scrog`, `basic-soil-pot`).

The `densityFactor_L_per_kg` drives container fill and irrigation calculations — cultivation tooling
uses it to convert container volumes into substrate mass, while irrigation modelling derives moisture
targets from the same factor to keep unit conversions deterministic.

> **Irrigation compatibility note:** Cultivation methods no longer list irrigation method IDs directly. Instead, irrigation method blueprints enumerate the substrates they support via `compatibility.substrates`, and methods inherit compatibility from whichever substrate option a zone selects (ADR-0003).

---

## 5) Economy & Tariffs (SEC §3.6)

- **Per‑hour** units for all recurring rates. No `*_per_tick` fields.
- **Tariff policy** (backend config + difficulty):
  - Backend exposes **`price_electricity`** (per **kWh**) and **`price_water`** (per **m³**).
  - Difficulty may supply **`energyPriceFactor`**/**`energyPriceOverride`** and **`waterPriceFactor`**/**`waterPriceOverride`** (override wins).
  - **Effective tariffs** are resolved **once at simulation start** and stay constant for the run (unless a scenario explicitly models variability).

**Derived costs**

- Electricity: `kWh = (powerW / 1000) * hoursOn`; `cost = kWh * tariff.kWh`.

- Water: `m3 = liters / 1000`; `cost = m3 * tariff.m3`.

## 5a) Workforce Domain (SEC §10)

- `SimulationWorld` embeds a deterministic `workforce` branch alongside the company tree. The branch collects:
  - `roles`: immutable catalogue of `EmployeeRole` records with SEC-aligned slugs and optional descriptions.
  - `employees`: directory of `Employee` entities carrying morale/fatigue (`0..1` scale), role assignment, structure assignment, and
    a deterministic `rngSeedUuid` (UUID v7) for stochastic trait streams.
  - `taskDefinitions`: scheduling templates that expose `requiredRoleSlug`, structured `requiredSkills` (`skillKey` + `minSkill01`),
    deterministic labour cost models, and integer priorities.
  - `taskQueue`: queued/in-progress task instances used by the dispatcher and telemetry.
  - `kpis`: rolling `WorkforceKpiSnapshot` entries summarising throughput, labour hours, overtime, and aggregate morale/fatigue.
  - `warnings`: deterministic `WorkforceWarning` entries carrying `code`, `severity`, `message`, optional `structureId`/`employeeId`/`taskId`, plus metadata for diagnostics and the façade.
  - `identity`: deterministic pseudodata service that seeds `randomuser.me` calls with UUID v7, enforces a 500 ms timeout, and falls back to curated offline lists via `createRng(rngSeedUuid, "employee:<rngSeedUuid>")` so only pseudonymous records persist.
  - `payroll`: day-indexed accumulators capturing `baseMinutes`, `otMinutes`, `baseCost`, `otCost`, and `totalLaborCost` for the
    entire company as well as per-structure slices. Hourly rates follow the SEC 10.3 formula
    `rate_per_hour = (5 + 10 × relevantSkill) × locationIndex × roleBaseMult × employeeBaseMult × experienceMult × laborMarketFactor`,
    with shift premiums applied multiplicatively and overtime billed at `1.25×`. `relevantSkill` averages the required task
    skills (fallback: average of the employee’s full skill set). Location factors resolve via `/data/payroll/location_index.json`
    (city overrides beat country overrides; default is `1.0`). Daily totals close with **Banker’s rounding** before the economy
    stage consumes the snapshot.
- `Employee` records now persist compensation context: `baseRateMultiplier`, `laborMarketFactor`, `timePremiumMultiplier`,
  `employmentStartDay`, `salaryExpectation_per_h`, cumulative `experience` (`hoursAccrued` + `level01` driving the experience
  multiplier), and a deterministic `raise` cadence (`cadenceSequence`, `lastDecisionDay`, `nextEligibleDay`). Experience accrues
  from minutes worked and trait XP multipliers during scheduling.
- `Employee.schedule` constrains base hours to **5–16 h per in-game day**, allows overtime up to **+5 h**, and records the number of
  working days per week (`1..7`) with an optional shift start hour (`0..23`). Schema guards reject violations and normalise seeds to UUID v7.
- `Employee.skills` and `EmployeeRole.coreSkills` share the `EmployeeSkillRequirement` shape (`skillKey`, `minSkill01 ∈ [0,1]`).
- Task definitions in `/data/configs/task_definitions.json` now store deterministic `requiredRoleSlug` values and structured
  `requiredSkills` arrays. Legacy integer skill levels were mapped onto `minSkill01 = level/5` to preserve intent while aligning to
  the canonical [0,1] skill scale referenced by SEC §10.
- `applyWorkforce` emits read-only telemetry after each tick via `telemetry.workforce.kpi.v1` (latest KPI snapshot),
  `telemetry.workforce.warning.v1` (batched warnings), `telemetry.workforce.payroll_snapshot.v1` (current-day payroll accrual),
  `telemetry.workforce.raise.accepted|bonus|ignored.v1`, and `telemetry.workforce.employee.terminated.v1`. The telemetry bus
  remains isolated from intents in keeping with SEC §1.4.
- The workforce market cache (`workforce.market.structures[]`) records `lastScanDay`, `scanCounter`, and deterministic candidate
  pools (main + secondary skills, trait strength, optional base rate hints). Pools persist until the next manual scan and use
  RNG streams `workforce:scan:<structureId>:<scanCounter>` and
  `workforce:candidate:<structureId>:<scanCounter>:<index>`.
- Engine bootstrap configuration now surfaces `workforce.market` defaults (30-day cooldown, pool size 16, scan cost 1000 CC) so
  façade layers can present consistent hiring controls. Market scans debit the configured cost and emit
  `telemetry.hiring.market_scan.completed.v1`; successful hires emit `telemetry.hiring.employee.onboarded.v1`.
- The façade exposes `createWorkforceView` which projects the workforce branch into UI-ready structures:
  - Directory listings with structure/role/skill/gender filter facets and morale/fatigue mapped onto percentages.
  - Live queue entries resolving task metadata (priority, ETA, wait/due times, structure bindings, assigned employees).
  - Employee detail records (schedule, RNG seed, development plans) and decorated warnings for dashboards.
  - Payroll snapshot mirroring the engine state so dashboards can surface the latest labour totals per day/structure.
- Workforce traits are centralised in `traits.ts` and persisted on employees as `{ traitId, strength01 }` pairs alongside the
  hiring market skill triad (`skillTriad`). Metadata captures conflict sets, strength ranges, and effect hooks so the scheduler
  and façade can reason about task duration, error deltas, fatigue/morale shifts, device wear, XP gain, and salary hints without
  re-deriving random draws.
- `applyTraitEffects()` is invoked from `applyWorkforce`, the hiring market, and the identity source to ensure deterministic trait
  behaviour. Assignments now expose `taskEffects`/`wellbeingEffects` so downstream subsystems (economy, maintenance) can reuse the
  same trait multipliers. A façade `createTraitBreakdown` read-model aggregates counts/strengths with optional economy hints for
  dashboards.

---

## 6) Tick Pipeline (SEC §4.2)

### Tick Pipeline (Canonical, 9 Phases)

1. Device Effects
2. Sensor Sampling
3. Environment Update
4. Irrigation & Nutrients
5. Workforce Scheduling
6. Plant Physiology
7. Harvest & Inventory
8. Economy & Cost Accrual
9. Commit & Telemetry

---

## 7) Light Schedule (SEC §8)

- Variables: `onHours`, `offHours`, optional `startHour`.
- Domains: `onHours ∈ [0,24]`, `offHours ∈ [0,24]` (integer or **0.25h grid**). Constraint: `onHours + offHours = 24`. `startHour ∈ [0,24)`.
- DLI is computed by integrating PPFD over the on‑window.

**Validation strategy:** clamp to grid, normalize sum to 24, modulo `startHour` into range; log façade warnings for corrections.

---

## 8) Devices (SEC §6)

- **Placement rules:** enforced at install/move; `allowedRoomPurposes` filter.
- **Capacity realism:** devices surface coverage/airflow/dehumid capacity; zones may require multiple devices.
- **Power→Heat coupling:** all electrical draw not exported becomes **sensible heat** in hosting zone.
- **Quality/Condition:** canonical **[0,1]** engine scale (`quality01`, `condition01`); mapping to `%` only in read‑models.

**Device blueprint essentials**

```json
{
  "id": "uuid",
  "slug": "veg-light-01",
  "name": "Veg Light 01",
  "placementScope": "zone",
  "allowedRoomPurposes": ["growroom"],
  "power_W": 480,
  "efficiency01": 0.9,
  "coverage_m2": 1.2
}
```

- **Coverage vs. demand:** Phase 1 sums `coverage_m2` across zone devices and scales useful work by `min(1, coverage/zoneArea)`. Emit `zone.capacity.coverage.warn` when the ratio < 1.
- **Airflow audit:** Airflow totals yield **ACH**; raise `zone.capacity.airflow.warn` for ACH < 1 and expose totals for downstream models.

## 8a) Interface-Stacking Architecture (Phase 1)

**Concept:** Devices implement one or more interfaces (`IThermalActuator`, `IHumidityActuator`, `ILightEmitter`, `IAirflowActuator`, `IFiltrationUnit`, `ISensor`, `INutrientBuffer`, `IIrrigationService`). Effects are computed deterministically in pipeline order and aggregated.

**Composition Patterns:**

- **Pattern A — Multi-Interface in One Device (Split-AC):**
  - A device implements multiple interfaces (e.g., `IThermalActuator` + `IHumidityActuator` + `IAirflowActuator`)
  - Example: Split-AC cools (Thermal), dehumidifies (Humidity), and moves air (Airflow)
  - Test: `multiEffectDevice.integration.test.ts:226-276`
- **Pattern B — Combined Device with Coupled Effects (Dehumidifier with Reheat):**
  - Humidity effect (dehumidification) + Thermal effect (reheat from waste heat)
  - Example: Dehumidifier with reheat function
  - Test: `multiEffectDevice.integration.test.ts:278-327`
- **Pattern C — Composition via Chain (Fan→Filter):**
  - Two separate devices in chain: Fan (Airflow) → Filter (Filtration + pressure drop)
  - Example: Inline fan with downstream carbon filter
  - Test: `fanFilterChain.integration.test.ts`
- **Pattern D — Sensor + Actuator in One Housing:**
  - A device implements `ISensor` + actuator interface (e.g., `IThermalActuator`)
  - Example: Temperature controller with integrated sensor
  - Note: Sensor readings must not be "polluted" by actuator output in the same tick — pipeline order runs `applySensors` immediately after `applyDeviceEffects`, before `updateEnvironment` integrates actuator deltas.
- **Pattern E — Substrate Buffer + Irrigation (Service + Domain):**
  - Service (`IIrrigationService`) + Domain stub (`INutrientBuffer`) jointly deliver nutrient outcome
  - Example: Irrigation service calculates flow, substrate buffer manages uptake/leaching

**Stub Conventions (Design Decision):**

- All stubs are **pure functions** (no side effects)
- **Deterministic:** Same input set ⇒ same output set (with fixed seed)
- **SI-Units:** W, Wh, m², m³/h, mg/h, µmol·m⁻²·s⁻¹ (PPFD), K, %
- **Clamps/Caps:** Respect blueprint parameters (`capacity`, `max_*`)
- **Telemetry:** Each stub returns primary outputs + auxiliary values (e.g., `energy_Wh`)

**Reference:** `/docs/proposals/20251002-interface_stubs.md` (consolidated specification)

---

## 9) Engine vs Façade vs Transport (SEC §11)

- **Engine:** pure, deterministic, no network/time syscalls; advances tick and returns state + events.
- **Façade:** validates intents, resolves tariffs, computes read‑models, orchestrates tick, exposes telemetry (read‑only) over adapter.
- **Transport Adapter:** Socket.IO default; SSE supported; **never accept inbound writes on telemetry**.

---

## 10) RNG & Reproducibility (SEC §5)

- `createRng(seed, streamId)`; stable stream ids, e.g., `plant:<uuid>`, `device:<uuid>`, `economy:<scope>`.
- Daily canonical **state hashes** (exclude derived/transient fields) for conformance checks.

---

## 11) Persistence & Savegame

- **Savegame JSON** contains world tree (no derived fields).
- **Load**: validate against schemas; compute effective tariffs; seed RNG streams; start ticking.

---

## 12) Error Handling & Validation

- Schema guards in façade (Zod).
- Violations (e.g., zone without cultivationMethod, device in wrong purpose room) → **hard errors** on load or **rejected intents** at runtime.
- Light schedule normalization → **soft warnings**; recorded in diagnostics log.

---

## 13) Performance Budget

- Headless throughput: **≥ 5k ticks/min** on dev baseline for demo world.
- No cumulative memory growth after **10k ticks**.
- Profiling hooks around each pipeline stage.

---

## 14) Telemetry & Read‑Models

- Telemetry: `simTick`, `eventId`, payload snapshots (small deltas preferred).
- Read‑models: zone/plant summaries (health, stress, PPFD, DLI, water use), economy snapshots (hourly energy/water, maintenance), device status.

---

## 15) Configuration Surfaces

```ts
// src/backend/src/config/runtime.ts (facade)
export interface BackendConfig {
  price_electricity: number; // cost per kWh (currency-neutral)
  price_water: number; // cost per m^3 (currency-neutral)
  difficulty?: {
    energyPriceFactor?: number;
    energyPriceOverride?: number;
    waterPriceFactor?: number;
    waterPriceOverride?: number;
  };
}
```

Tariff resolution occurs **once** at simulation start; façade provides `getEffectiveTariffs(): { kWh: number; m3: number }`.

---

## 16) Testing Strategy (see TDD.md)

- Unit: validators, tariffs, RNG, physio pure functions.
- Module: device models, placement, power→heat, light schedule.
- Integration: tick pipeline order and interactions.
- Conformance: 30‑day golden master with daily hashes.

---

## 17) Security & Trust Boundaries

- Engine runs without network; all inbound data is validated in façade.
- Telemetry channel is write‑protected; intents use separate ingress.

---

## 18) Open Issues / ADR Hooks

- **Variable tariffs** (time‑of‑day pricing): ADR if needed; impacts economy stage.
- **CO₂ modelling depth** (simple bucket vs mass‑balance): ADR to change.
- **Irrigation granularity** (per‑plant vs per‑zone): ADR to change.

---

## 19) Acceptance Criteria (for PRs implementing this DD)

- ✅ Imports and uses `simConstants.ts` (no magic numbers).
- ✅ Zone requires `cultivationMethodId`; schema enforced.
- ✅ Device placement rules + roomPurpose eligibility enforced.
- ✅ Tariffs resolved from `price_electricity`/`price_water` with factor/override (override wins).
- ✅ All recurring costs are per‑hour; tick derives cost via hours.
- ✅ Power→heat coupling implemented where applicable.
- ✅ Telemetry is read‑only and transport‑separated.
- ✅ Deterministic RNG streams and daily state hashes in place.
- ✅ Performance budget & profiling hooks present.
- ✅ Tests cover unit/module/integration/conformance (see TDD.md).

---

## 20) Pseudocode Snippets (informative)

```ts
// tariffs.ts
export function resolveTariffs(cfg: BackendConfig) {
  const kWh =
    cfg.difficulty?.energyPriceOverride ??
    cfg.price_electricity * (cfg.difficulty?.energyPriceFactor ?? 1);
  const m3 =
    cfg.difficulty?.waterPriceOverride ?? cfg.price_water * (cfg.difficulty?.waterPriceFactor ?? 1);
  return { kWh, m3 };
}

// lightSchedule.ts
export function validateLightSchedule(onHours: number, offHours: number, startHour = 0) {
  const grid = (x: number) => Math.round(x * 4) / 4; // 0.25h
  let on = grid(Math.max(0, Math.min(24, onHours)));
  let off = grid(Math.max(0, Math.min(24, offHours)));
  if (on + off !== 24) off = grid(24 - on);
  const start = ((startHour % 24) + 24) % 24;
  return { onHours: on, offHours: off, startHour: start };
}

// powerToHeat.ts (simplified)
export function applyDeviceHeat(
  zone: Zone,
  d: { powerDraw_W: number; dutyCycle01: number; efficiency01: number },
) {
  const wasteW = d.powerDraw_W * (1 - d.efficiency01) * d.dutyCycle01;
  const joules = wasteW * 3600; // 1h
  const airMassKg = zone.airMass_kg; // bootstrap: area × (height || default) × 1.2041 kg/m³
  const dT = joules / (airMassKg * 1005); // Cp_air ≈ 1005 J/(kg·K)
  return dT;
}
```

---

**End of DD (SEC‑aligned v0.2.1).**

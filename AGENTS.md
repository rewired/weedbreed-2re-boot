# AGENTS.md — Weed Breed (Aligned to **Simulation Engine Contract v0.2.1**)

> **Audience:** Coding‑AI ("Codex") + engineers.  
> **Source of truth:** When this file and the **Simulation Engine Contract (SEC)** disagree, **SEC wins**.

---

## 0) Purpose

Steer implementation so the codebase **conforms to SEC v0.2.1** while remaining pragmatic. This document is prescriptive for tooling, directory layout, guardrails, and developer ergonomics; it does **not** redefine the engine semantics—those are owned by the SEC.

---

## 1) Platform & Monorepo (must‑haves)

- **Node.js 22 (LTS)**, **ES Modules** end‑to‑end. (`"type": "module"` in packages.)
  - `.nvmrc` / `.node-version` pin **Node.js 22 (LTS)** locally; adopt it via your version manager and match CI, which also runs Node.js 22 (LTS).
- **TypeScript** (strongly recommended in backend and UI) with strict mode; emit ESM.
- **pnpm workspaces** monorepo: engine (headless), façade (integration/transport), UI (React+Vite), tools (monitoring/validation).
- **UI:** React + Vite + Tailwind. "Dumb UI": read‑models in, intents out.

UI component layer: shadcn/ui (on Radix primitives) with Tailwind for styling; icons via lucide-react; micro-animations via Framer Motion. Charts via Recharts, optionally Tremor for dashboard presets. Components are in-repo (shadcn “copy-in” model) to avoid vendor lock and keep them themable with Tailwind.

- **Terminal monitor:** neo‑blessed (read‑only telemetry). **MUST NOT** send commands over telemetry.
- **Transport adapter:** default **Socket.IO**; **SSE** is acceptable behind the same adapter.

> Keep tech choices aligned with SEC §0.1. Breaking changes require an ADR.

---

## 2) Core Invariants (mirror SEC §1)

1. **Determinism everywhere.** One RNG interface: `createRng(seed, streamId)`; **no `Math.random`** in sim/logic.
2. **Blueprints are templates.** Never mutate JSON under `/data/**` at runtime.
3. **SI units; canonical IDs.** UUID v4 for all entities; formatting is UI‑only.
4. **Telemetry bus ≠ command bus.** Telemetry is uni‑directional (server → client) and **read‑only**.
5. **Ordered tick pipeline.** Every zone/plant advances through all phases each tick.
6. **No hidden globals.** State changes are explicit within the world tree.

---

## 3) Canonical Constants & Terminology (SEC §1.2)

- `AREA_QUANTUM_M2 = 0.25` — **minimal calculable floor area** (hotfix).
- `ROOM_DEFAULT_HEIGHT_M = 3` — default interior height; blueprint may override.
- **Calendar:** `HOURS_PER_DAY = 24`, `DAYS_PER_MONTH = 30`, `MONTHS_PER_YEAR = 12`.
- **Tick standard:** **1 tick = 1 in‑game hour**. Game speed only affects wall‑clock, not in‑game duration.

> **Enforcement:** Define these in `src/backend/src/constants/simConstants.ts` and reference from all subsystems. JSDoc each constant and mirror in `/docs/constants/**`.

---

## 4) World Model & Placement (SEC §2 + §1.1)

- Hierarchy: **Company → Structure → Room → Zone → Plant → Device**.
- **roomPurpose** (growroom, breakroom, laboratory, storageroom, salesroom, workshop) is mandatory for rooms.
- **Zones only exist in growrooms.** Non‑growroom purposes **MUST NOT** host zones.
- **Devices attach by `placementScope`**: `zone | room | structure` (required in device blueprints).
- **Eligibility**: device blueprints declare `allowedRoomPurposes`. Validate on load and on every move/install.
- **Capacity realism**: devices expose effect capacity (coverage/airflow/dehumid). Multiple devices may be required to service a zone.

---

## 5) Data Contracts & Price Separation (SEC §3)

- **Blueprints** live under `/data/blueprints/**` (strains, devices, cultivationMethods, substrates, containers, …). **Never embed prices** in device blueprints.
- **Contributors guardrail:** Blueprint JSON is the source of truth. Keep each file inside the taxonomy folder that mirrors its `class` (`device/climate/*.json`, `device/lighting/*.json`, etc.). The loader fails fast (`BlueprintTaxonomyMismatchError`) whenever the directory and JSON diverge.

Blueprint directory rule: All blueprints are auto-discovered under /data/blueprints/<domain>/<file>.json with a maximum depth of two segments (domain + file). Devices are /data/blueprints/device/<category>.json or /data/blueprints/device/<category>/<file>.json limited to two levels; no deeper subfolders are allowed.

- **Price maps** live under `/data/prices/**`.
- **Recurring monetary rates use per‑hour units** (SEC §3.6). **`*_per_tick` is forbidden.** Derive tick costs via tick hours.
- **Tariff policy (SEC §3.6.1, hotfix clarified):**
  - Backend config exposes **`price_electricity`** (per **kWh**) and **`price_water`** (per **m³**).
  - Difficulty layer may provide **`energyPriceFactor`** and/or **`energyPriceOverride`** (override wins) **and** **`waterPriceFactor`** and/or **`waterPriceOverride`** (override wins).
  - Effective tariffs are computed **once at simulation start** and kept constant for the run (unless a scenario explicitly models variable tariffs).

### 5.1 Cultivation Methods are **required** on Zones (SEC §7.5)

Every **Zone MUST reference exactly one `cultivationMethod`** (blueprint id). The method **must** define:

- **Planting density**: `areaPerPlant_m2` and/or stricter `maxPlants` rule.
- **Containers**: one or more options with **CapEx** (acquisition), **service life** and replacement rules.
- **Substrates**: one or more options with **unit price** (per L **or** per kg), **densityFactor_L_per_kg** (or inverse) for L↔kg conversion, reuse/sterilization policy.
- **Irrigation compatibility**: inherited from substrate options; each substrate blueprint declares supported irrigation method ids + schedules.
- **Costs**: recurring/hour normalized; acquisitions per unit.

> Engine must surface tasks for re‑potting, substrate replacement, sterilization, and disposal where policies require them.

---

## 6) Device Power↔Heat Coupling & Quality Model (SEC §6.1, §6.2 Option A)

- **Non‑useful electrical power becomes sensible heat** in the hosting zone unless explicitly exported.

- **Efficiency & duty** bound power draw and effect rates.

- **Quality/Condition scales:** use canonical **[0,1]** engine scale (`quality01`, `condition01`). UI/read‑models may expose `%` = `round(100*value)`.

- **Quality affects rates/thresholds**, not purchase price.

---

## 6a) Interface-Stacking & Stubs (Phase 1)

- **Interface-Stacking:** Devices may implement multiple interfaces (e.g., Split-AC: `IThermalActuator` + `IHumidityActuator` + `IAirflowActuator`). Effects are computed deterministically in pipeline order and aggregated.

- **Stub Conventions (Phase 1):**
  - **Determinism:** Same input set ⇒ same output set (with fixed seed)
  - **SI-Units:** W, Wh, m², m³/h, mg/h, µmol·m⁻²·s⁻¹ (PPFD), K, %
  - **Clamps:** All 0..1 scales hard-clamped; negative flows/stocks avoided
  - **Caps:** Stubs respect `capacity`/`max_*` from blueprint parameters
  - **Telemetry:** Each stub returns primary outputs + auxiliary values (e.g., `energy_Wh`)

- **Composition Patterns:**
  - **Pattern A:** Multi-Interface in one device (Split-AC)
  - **Pattern B:** Combined device with coupled effects (Dehumidifier with Reheat)
  - **Pattern C:** Composition via chain (Fan→Filter)
  - **Pattern D:** Sensor + Actuator in one housing
  - **Pattern E:** Substrate Buffer + Irrigation (Service + Domain)

- **Reference:** `/docs/proposals/20251002-interface_stubs.md` (consolidated specification)

---

## 7) Tick Pipeline (SEC §4.2)

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

> Implement as a small state machine to support pause/step.

---

## 8) Light Schedule Contract (per‑zone) (SEC §8)

- **Variables**: `onHours`, `offHours`, `startHour`.
- **Domains**: `onHours ∈ [0,24]`, `offHours ∈ [0,24]`; integers **or** multiples of **0.25 h** (15‑min grid).  
   Constraint: **`onHours + offHours = 24`**.  
   Optional: `startHour ∈ [0,24)` marks the daily start of the **on** phase.
- **Examples**: `18/6` (veg), `12/12` (flower).
- **DLI integration**: engine integrates light over the **on** window to a DLI signal for growth heuristics.

> Validation lives in façade schema; clamp/normalize to valid grid and emit warnings when corrections occur.

---

## 9) RNG & Streams (SEC §5)

- `createRng(seed, streamId)` provides reproducible draws. Stable stream ids, e.g. `plant:<uuid>`, `device:<uuid>`, `economy:<scope>`.
- Daily canonical state hashes computed after applying deterministic number formatting and excluding derived/transient fields.

---

## 10) Transports, Facade, and API Boundaries (SEC §11)

- **Engine (headless):** deterministic tick progression; **no network**.
- **Facade:** single ingress; validates & queues **intents**; exposes **read‑models**; owns the **Transport Adapter**.
- **Telemetry:** post‑commit events with `simTick` + `eventId`, **read‑only channel**.
- **No multiplexing** of intents and telemetry on the same channel.

> Keep protocol docs synchronized (topic names, payload shapes). Reject any inbound writes on the telemetry channel at transport level.

---

## 11) Maintainability & Docs Governance (SEC §1.3–§1.4)

- **File size thresholds:** warn at **≥ 500 LOC**, fail CI at **≥ 700 LOC** (generated files exempt by pattern). Refactor before adding features.
- **JSDoc mandatory** for all exported APIs & constants.
- **ADR workflow** for contract/guardrail decisions.
- **CHANGELOG**: keep‑a‑changelog format.
- **Constants governance:** changes mirrored under `/docs/constants/**`.

---

## 12) Testing & Golden Master (SEC §0.2, §15)

- Provide a **canonical savegame JSON** for the reference test (“Golden Master”). No derived fields.
- **Conformance:** running **N days** from T0 yields identical **daily state hashes** and event counts.  
   Numeric comparisons use **EPS_REL = 1e‑6**, **EPS_ABS = 1e‑9**.
- **Physio** modules expose pure functions with golden vectors; tolerances above.
- **Integration** test covers 30‑day scenario; **deterministic** across platforms.

---

## 13) Do & Don’t (quick checklist)

**Do**

- Enforce **per‑hour** economic units; derive per‑tick.
- Require `placementScope` + `allowedRoomPurposes` in device blueprints.
- Require `cultivationMethod` on every zone (with containers, substrates, irrigation compatibility, costs, density factor).
- Convert all **electrical power** not performing useful work into zone heat.
- Keep telemetry **read‑only**; separate channel from intents.

**Don’t**

- Don’t put prices in device blueprints.
- Don’t send commands on the telemetry bus.
- Don’t rely on wall‑clock or `Date.now()` for sim logic.
- Don’t use `*_per_tick` money units.

---

## 14) Package & Tooling Conventions

- Backend dev runner: `tsx` (no experimental loaders). Build with `tsc`/`tsup` → ESM.
- Tests: `vitest` (node env); lint: ESLint + Prettier; path aliases via TS config.
- Root scripts example:

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "format": "pnpm -r format"
  }
}
```

---

## 15) Acceptance Criteria (for PRs touching core)

- ✅ Matches SEC semantics (sections referenced in PR description).
- ✅ Adds/updates constants in `simConstants.ts` **and** `/docs/constants/**`.
- ✅ Validates **roomPurpose** and **device placement** rules on load and move/install.
- ✅ Zones **cannot** exist outside growrooms; every zone has a `cultivationMethod`.
- ✅ Economy units audited: per‑hour only; energy & water tariffs follow policy (price_electricity/price_water + factor/override precedence).
- ✅ Telemetry channel is read‑only; intents/telemetry are not multiplexed.
- ✅ Golden vectors/tests updated and green (unit + integration).
- ✅ LOC guardrails respected; JSDoc present; ADR/CHANGELOG updated.

---

## 16) Appendix A — Light Schedule: Validation Pseudocode

```ts
/** 15‑min grid; enforce on+off = 24h and start ∈ [0,24) */
function validateLightSchedule(onHours: number, offHours: number, startHour = 0): LightSchedule {
  const grid = (x: number) => Math.round(x * 4) / 4; // 0.25h steps
  let on = grid(clamp(onHours, 0, 24));
  let off = grid(clamp(offHours, 0, 24));
  // Normalize sum to 24h
  const sum = on + off;
  if (sum !== 24) {
    // Prefer adjusting offHours to satisfy constraint
    off = grid(24 - on);
  }
  const start = mod(startHour, 24);
  return { onHours: on, offHours: off, startHour: start };
}
```

---

## 17) Appendix B — Quality & Condition (Mapping for UI/Economy)

- Engine scale: `quality01`, `condition01` ∈ **[0,1]**.
- UI/export: `qualityPercent = round(100 * quality01)`; same for condition.
- Economy formulas expecting 0–100 must apply this mapping at the façade/read‑model layer.

---

## 18) Appendix C — Cultivation Method: Minimum JSON Shape (informative)

```json
{
  "id": "uuid",
  "slug": "sog",
  "name": "Sea of Green",
  "areaPerPlant_m2": 0.12,
  "containers": [
    {
      "id": "uuid",
      "slug": "pot-10l",
      "name": "Pot 10 L",
      "capex_per_unit": 2.0,
      "serviceLife_cycles": 8
    }
  ],
  "substrates": [
    {
      "id": "uuid",
      "slug": "soil-basic",
      "name": "Soil (basic)",
      "unitPrice_per_L": 0.15,
      "densityFactor_L_per_kg": 0.7,
      "reusePolicy": { "maxCycles": 1, "sterilizationTaskCode": "sterilize_substrate" }
    }
  ],
  "irrigationMethodIds": ["hand-watering", "drip-emitters"],
  "notes": "SEC §7.5 compliant"
}
```

---

**End of AGENTS.md (SEC‑aligned, hotfix applied).**

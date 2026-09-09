# Weedbreed.AI — Vision & Scope (Aligned to **Simulation Engine Contract v0.2.1**) — Hotfix

> **Contract precedence:** If this document and the **Simulation Engine Contract (SEC)** disagree, **SEC wins**.

---

## 1. Vision

**Elevator Pitch.** _Weed Breed_ is a modular, deterministic cultivation & economy simulation. Players plan **Company → Structure → Room → Zone → Plant**, configure climate & devices, balance **cost vs. yield**, and complete cycles from **seeding → harvest → post‑harvest**. The system is open and content‑driven via **JSON blueprints**, enabling modders and researchers to contribute.

> **Modding note:** Blueprint JSON stays authoritative for metadata, but every file **must** live in the domain folders that mirror its declared `class` (`device/climate/*.json`, `cultivation-method/*.json`, etc.). No subfolders deeper than <domain>/<file>.json are allowed. Misplaced files or path/class mismatches are rejected by the loader so the runtime and data set never drift.

**Why now?** Few titles combine **physically plausible climate & plant physiology**, **deterministic reproducibility**, and a **meaningful economy loop**. _Weed Breed_ fills this gap.

**Guiding Principles.**

1. **Determinism over visuals.** Reproducible runs beat eye‑candy.
2. **Playability over realism.** Plausible first, with explicit simplifications.
3. **Open architecture.** Stable formats, clear interfaces, modding first.
4. **Transparency.** Explainable metrics, logs, audits, replays.
5. **Tight feedback loops.** Fun via frequent, meaningful micro‑decisions.

**Non‑Goals (Anti‑Scope).**

- No political/regulatory sim; legal aspects abstracted.
- No shooter/action mechanics.
- No lab‑grade exact growth models; target is **plausible & playable**.

**Experience Pillars.**

- **Planning & Optimization:** Light, climate, CO₂, device upgrades, VPD-driven stress tuning.
- **Risk Management:** Pests/diseases, device wear, resource bottlenecks.
- **Economy:** OpEx/CapEx, cash flow, break‑even, price/quality.

---

## 2. Target Audiences & Stakeholders

**Primary Personas.**

- **The Optimizer** — spreadsheet mindset; chases PPFD, VPD, cost-per-gram KPIs (currency-neutral).
- **The Builder** — designs efficient, beautiful layouts & upgrades.
- **The Learner** — wants to understand climate ↔ plant ↔ yield relations.

**Stakeholders & Decision Authority (RACI‑light).**

- **Product/Design:** Vision, priorities, balancing guardrails.
- **Engineering:** Architecture, quality, deterministic foundation.
- **Content:** Blueprints (strains/devices/methods), data quality.

**Usage Context.** Solo play; sandbox/editor optional; streaming‑friendly KPIs.

---

## 3. Success Criteria

**Outcome KPIs.**

- **First Harvest Time:** First harvest within **< 30 minutes** for the default MVP setup. _(OPEN: validate)_
- **Retention Proxy:** 70% of players reach day 7 in sandbox. _(OPEN: measure)_
- **Determinism Score:** Reference run (200 days) reproducible within **±0.5%** on core metrics.

**Quality Goals / SLOs.**

- **Performance:** Reference scenario runs at **≥ 1 tick/s at 1×**. With **1 tick = 1 in‑game hour**, one in‑game day (24 ticks) completes in **≤ 24 s** at 1×. Per‑tick CPU budget **≤ 50 ms**.
- **Stability:** No deadlocks; crash recovery without data loss (**< 1 tick**).
- **Memory Target:** Reference scenario uses **< 1.0 GB RAM**. _(OPEN: finalize)_

**Reference Scenario (Benchmark & Balancing Baseline).**

- **Company:** Default company profile.
- **Structure:** 1 medium warehouse (blueprint default height **3 m**).
- **Rooms 1:** 2 growrooms.
  - **Zones:** 5 zones, each with a **cultivationMethod** (containers, substrates incl. density factor, irrigation compatibility).
    **Irrigation:** configured per zone via one of the canonical methods (ADR-0017) — manual watering, drip inline fertigation, top-feed pump, or ebb-flow; **no initial water/nutrient stockpiles** — water is metered from mains, nutrients are costed via irrigation input.
- **Rooms 2:** 1 breakroom for 8 employees (no zones).
- **Staff:** 8 employees (≥ 4× Gardener, 2× Technician, 2× Janitor).
- **Starting Capital:** 100,000,000.
- **Goal:** Fixed load profile for perf measurements (≥ 1 tick/s at 1×) and baseline for balancing.

---

## 4. Canonical Domain Model (SEC‑aligned)

**Entities & Relationships.**

- **Company → Structure → Room → Zone → Plant** (hierarchical).
- **Devices** are installed by **`placementScope`** = `zone | room | structure` (blueprint). Eligibility via `allowedRoomPurposes`.
- **Workforce** snapshot stores deterministic roles/employees/task queues/payroll; employee identities draw from a seeded `randomuser.me` call (500 ms timeout) with deterministic pseudodata fallback.
- **Strains** (JSON) define photoperiod, DLI/PPFD ranges, NPK/water curves, stress tolerances evaluated via the ADR-0018 piecewise quadratic tolerance ramp.
- **CultivationMethods** define topology, planting density, containers, substrates (with L↔kg density factor and reuse/sterilization policy), irrigation compatibility (inherited from irrigation methods listing their substrates), and costs.
- **Irrigation Methods** (JSON) define how water/nutrients are delivered (hand‑watering, drip, etc.) and scheduling hooks.
- **Canonical irrigation set (ADR-0017):** `manual-watering-can`, `drip-inline-fertigation-basic`, `top-feed-pump-timer`, and `ebb-flow-table-small` ship as the guaranteed launch methods across docs, fixtures, and UI.
- **Cultivation presets (ADR-0020):** Default bundles are `basic-soil-pot` (pot-10l + soil-single-cycle), `sea-of-green` (pot-11l + coco-coir), and `screen-of-green` (pot-25l + soil-multi-cycle); hydroponic additions require a future ADR.
- **Pests/Diseases** as events/states with incidence, progression, effects & treatments.

**Binding SEC Rules reflected here.**

- **Zones only exist in growrooms.**
- **Every Zone MUST reference exactly one `cultivationMethod`.**
- **AREA_QUANTUM_M2 = 0.25** (minimal calculable floor area).
- **Default room height = 3 m** (overridable by blueprint); zones inherit this height when neither room nor cultivation method specifies an alternative (ADR-0020).
- **Thermo baselines:** `CP_AIR_J_PER_KG_K = 1 005`, `AIR_DENSITY_KG_PER_M3 = 1.2041`.
- **Company HQ defaults:** Hamburg coordinates (`lat 53.5511`, `lon 9.9937`) with `city = "Hamburg"`, `country = "Deutschland"` seed new worlds until players override them.

**Lifecycles.**

- **Plant:** Seed → Vegetative → Flowering → Harvest → Post‑harvest (dry/curing).
- **Device:** Efficiency degradation, maintenance, replacement triggers.

---

## 5. Time Scale & Scheduling (SEC)

- **Tick semantics:** **One tick equals exactly one in‑game hour**.
- **Calendar:** 24 ticks/day; 168 ticks/week.
- **Game speed** (0.1×…1000×) changes **wall‑clock rate only**, not tick semantics.
- **Light schedule (per zone):** `onHours ∈ [0,24]`, `offHours ∈ [0,24]`, integer or **0.25 h grid** with **constraint `on + off = 24`**; optional `startHour ∈ [0,24)`.
- **DLI integration:** Engine integrates light over on‑window to a DLI signal.

---

## 6. Simulation Philosophy

- **Realism levels:** Climate [plausible], growth [semi‑empirical], economy [playfully plausible].
- **Determinism & RNG:** Global seed + **stream‑scoped RNG**; **no `Math.random`** in sim logic.
- **Calibration:** Literature + expert plausibility; golden runs as reference.
- **Balancing:** Curves/blueprint params; editor‑assisted; automated audits.

---

## 7. Economy & Cost Logic (SEC)

**Units & Policies.**

- Recurring costs use **per‑hour** units; **no `*_per_tick`**.
- **Tariffs:** Backend exposes **`price_electricity`** (per kWh) and **`price_water`** (per m³). Difficulty may set **`energyPriceFactor`/`energyPriceOverride`** and **`waterPriceFactor`/`waterPriceOverride`** (**override wins**). Effective tariffs are computed **once at simulation start**.
- **Decision:** Experience copy and UI labels adopt neutral monetary language — never surface currency symbols/codes (EUR, USD, GBP, etc.) in identifiers or baked-in text; localized presentation layers may add symbols contextually.
- **Tariff source:** `/data/prices/utilityPrices.json` is the single source of truth for electricity & water tariffs; nutrient pricing flows through irrigation/substrate consumption instead of a utility entry.
- **Device maintenance pricing:** `/data/prices/devicePrices.json` carries `capitalExpenditure`, `baseMaintenanceCostPerHour`, `costIncreasePer1000Hours`, and `maintenanceServiceCost` for maintenance curves.
- **Reporting cadence (ADR-0019):** Economy read-models surface hourly (per tick) ledger slices with deterministic daily rollups built from 24-hour sums; dashboards reference the daily aggregates while audits rely on hourly data.
- **Electric power → heat:** Non‑useful electrical power becomes **sensible heat** in the hosting zone unless exported.

**Cost drivers.**

- **CapEx:** Purchase, depreciation, residual value.
- **OpEx:** Energy, water (metered), nutrients (via irrigation), maintenance (increasing), consumables.
- **Replacement tipping point:** If maintenance + efficiency loss > upgrade benefit → agent proposes replacement.

**Revenue.** Quality × quantity × market price (balancing matrix).

---

## 7a. Quality Grades & Price Functions (SEC‑aligned scale)

**Engine scale vs. UI scale.**

- Engine tracks **quality/condition on [0,1]** (`quality01`, `condition01`).
- UI/read‑models map to **0–100%** as needed (e.g., `round(100 * quality01)`).

**Harvest Quality (informative pseudocode).**

```pseudo
function harvestQuality01(finalHealth01, avgStress01, geneticQuality01, methodMod≈0.9..1.1): 0..1 {
  const W_HEALTH=0.55, W_STRESS=0.25, W_GENET=0.20
  let q01 = W_HEALTH*clamp01(finalHealth01)
           + W_GENET *clamp01(geneticQuality01)
           + W_STRESS*(1 - clamp01(avgStress01))
  q01 = clamp01(q01 * methodMod)
  if (q01 > 0.95) q01 = 0.95 + 0.5*(q01 - 0.95)
  return clamp01(q01)
}
```

**Price Function (non‑linear, informative).**

```pseudo
function salePrice(basePrice, quality01): number {
  const BASELINE01 = 0.70
  const q = clamp01(quality01)
  if (q >= BASELINE01) {
    const alpha = 1.25
    return basePrice * pow(q/BASELINE01, alpha)
  } else {
    const beta = 1.5
    const kink = (q < 0.50) ? 0.85 : 1.0
    return basePrice * pow(q/BASELINE01, beta) * kink
  }
}
```

---

## 8. Automation & Agents

**Agent Roles (examples).**

- **Auto‑Replant** — on “zone ready” → plant; high priority; falls back to manual queue.
- **Harvest Scheduler** — ripeness detection, slot planning, post‑harvest buffers.
- **Climate Controller** — hold target corridors (Temp/RH/CO₂/PPFD) cost‑aware.
- **Maintenance Advisor** — monitor degradation/MTBF, plan windows, propose replacement.
- **Pest/Disease Manager** — risk, treatments with cost/quality trade‑offs.

**Priorities & Conflict Resolution.** Central **task arbiter** with deterministic priorities (plant protection > harvest > replant > comfort).
**Failure Modes.** Resource shortage → degrade mode; dead device → emergency shutdown & alarm.

---

## 9. Content & Data Strategy

- **v1 Scope:** ~8–12 strains, ~10–15 devices, 2–3 cultivation methods, basic pests/diseases + treatments. _(OPEN: finalize)_
- **Provenance/Licenses:** Attribute sources; OSS‑friendly licenses.
- **Modding/Editors:** JSON SemVer; in‑game editors for strains/devices/methods.

---

## 10. UX & Presentation Vision

- **Key Screens:** Start (New/Load/Import), Dashboard (time/tick, energy/water/cost), Structure Explorer (Company → Structure → Room → Zone → Plant), detail pane with KPIs & stress breakdown, Shop/Research, Logs/Audits.
- **Info Hierarchy:** Top: tick/time, daily costs with hourly drill-down per ADR-0019, energy/water, balance; middle: active zone/plant KPIs; bottom: events/tasks.
- **Accessibility:** SI units; tooltips; color‑vision‑friendly palettes; scalable typography.

Implementation note (UI components): We will use Tailwind for styling and adopt shadcn/ui (built on Radix) as our unstyled component layer, keeping full theming control in Tailwind while benefiting from accessible primitives and consistent patterns (dialogs, sheets, tabs, tables, toasts).

---

## 11. Persistence, Telemetry & Tests (SEC)

- **Save/Load:** JSON with schema version; migrations; crash‑safe saves.
- **Telemetry:** **read‑only**, uni‑directional from server → client; intents separated.
- **Deterministic Tests:** Golden runs with seeds (e.g., `WB_SEED=golden-200d`), daily hashes, tolerances.

---

## 12. Non‑Functional Requirements (NFR)

- **Performance:** Linear scaling per zone/plant with upper bounds; see §3.
- **Robustness:** Safe defaults on parameter errors; validate blueprints at load.
- **Security/Privacy:** Local saves by default; no personal data.
- **Internationalization:** EN/DE; SI units; configurable decimal/date formats.

---

## 13. Legal & Ethics

- **Portrayal:** Neutral, factual; no glorification; respect age ratings.
- **Open‑Source Strategy:** License model (e.g., AGPL/Polyform?) & PR/CLA policy. _(OPEN: decide)_

---

## 14. Roadmap & Release Criteria

**Milestones.**

1. **MVP:** One structure, basic climate, 1–2 strains, 1 method, basic economy, save/load, deterministic 30‑day run.
2. **Alpha:** Pests/diseases + treatments, device degradation/maintenance, shop/research loop, editor v1.
3. **Beta:** Balancing pass, golden runs (200 days), stability SLOs, localization EN/DE.
4. **1.0:** Content polish, modding docs, replay exporter, perf tuning.

**Definition of Done (MVP).**

- First harvest < 30 min (default scenario).
- Reproducible reference run (±0.5%).
- Schema versioning & migrations present.
- Crash‑safe saves & restart.

---

## 15. Risks, Assumptions & Guardrails (SEC‑aligned)

**Top Risks.** Balancing complexity (climate × strain × devices), agent standoffs, blueprint data quality.

**Mitigations.** Strict audits, phased enablement (feature flags), central arbiter + deadlock detector, schema validation & test seeds.

**Assumptions.** Community values modding; deterministic replays are core; SI units accepted.

**Technical Guardrails (bindings).**

- **Constants:** `AREA_QUANTUM_M2 = 0.25`, `ROOM_DEFAULT_HEIGHT_M = 3`, `HOURS_PER_TICK = 1`.
- **RNG:** All randomness via `createRng(seed, streamId)`; no `Math.random`.
- **Economy:** Per‑hour units; tariffs from `price_electricity`/`price_water` + Difficulty (override > factor); resolved once at sim start.
- **Placement:** `placementScope` & `allowedRoomPurposes` enforced; zones only in growrooms; every zone has a `cultivationMethod`; irrigation configured per zone.
- **Telemetry:** Read‑only; intents on separate ingress.

---

**End — Vision & Scope (SEC‑aligned v0.2.1, Hotfix).**

# Weed Breed — Simulation Engine Contract (SEC) (Re-Reboot Draft)

> Status: **Draft v0.2.1** (iterative). Language: **English**. Source intake includes `/docs/task/**` (preserved), legacy proposals, `AGENTS.md`, `DD.md`, `TDD.md`, and `/data/**`. Nothing is removed; discarded or superseded content is referenced in **Appendix B: Task Proposals Crosswalk**.

---

## 0. Purpose & Reading Guide

This document describes **what the simulation is and should be** at the core level. It is **implementation-agnostic** and **normative** for engine behavior. It consolidates scattered proposals into a single, testable specification. Anything operational (how to build, CI, tooling) is out of scope.

- **Audience:** engine developers, data modelers, test authors.
- **Non-goals:** UI details, CI pipelines, pricing strategy beyond what influences the engine core.
- **Change policy:** additive, with versioned sections. Breaking conceptual changes must note their impact in _§12 Migration Notes_.

---

## 0.1 Platform & Monorepo Baseline (Technology Choices)

We start **fresh**: no external document references; prior proposals are folded in **high-level**. The platform standardizes integration surfaces without constraining the core model.

- **Node.js 22 (LTS), ESM** — Backend and façade **SHALL** use modern ECMAScript modules.

- **Local & CI runtime** — `.nvmrc` and `.node-version` pin **Node.js 22 (LTS)**. Contributors **SHALL** adopt Node.js 22 (LTS) locally and CI runs the same runtime ([ADR-0012](ADR/ADR-0012-node-version-tooling-alignment.md)).

- **TypeScript** — The codebase **SHOULD** use TypeScript for type safety and clearer contracts.
- **Monorepo with pnpm workspaces** — The repository **SHALL** be a pnpm monorepo (engine, façade, UI, tools).
- **React + Vite** — The UI **SHALL** be a React app built with Vite; the UI remains **dumb** (read models in, intents out).
- **Tailwind CSS** — The UI **SHOULD** use Tailwind for styling.

UI component layer: shadcn/ui (on Radix primitives) with Tailwind for styling; icons via lucide-react; micro-animations via Framer Motion. Charts via Recharts, optionally Tremor for dashboard presets. Components are in-repo (shadcn “copy-in” model) to avoid vendor lock and keep them themable with Tailwind (ADR-0016).

- **Terminal Monitor (neo-blessed)** — A read-only terminal monitor **SHOULD** provide live telemetry dashboards; it **MUST NOT** send commands over telemetry.
- **Transport Adapter** — A transport abstraction **SHALL** exist. **Socket.IO SHOULD** be the default transport initially. Alternative transports (e.g., SSE) **MAY** be swapped under the same contract.

---

## 0.2 Reference Test Simulation (Golden Master)

**Intent:** Define a single, canonical test simulation as a **JSON savegame** that the engine **SHALL** reproduce deterministically across platforms and releases.

### 0.2.1 What it is (SHALL)

- A **self-contained JSON** describing a minimal but complete world state (metadata, world tree, schedules, inventory, workforce) at **sim time T0**.
- Contains **no derived fields** (only inputs). The engine computes outputs from it.
- Carries `schemaVersion`, `seed`, `simTime` and a **content hash** over canonical ordering.
- Persisted via an **atomic write path** (temp file → fsync → rename) and stored in `/data/savegames/` using ISO-8601 timestamped filenames (`<timestamp>--<slug>.json`).

### 0.2.2 Scope & Contents (SHOULD)

- **Metadata:** `schemaVersion`, `seed`, `simTime`, `notes`.
- **Repository location:** canonical saves live under `/data/savegames/` and remain source-controlled for regression. Derivations use canonical ordering for deterministic hashing.
- **World:** company → structures → rooms → zones → plants (ids, sizes, starting states).
- **Schedules:** per-zone light cycle (e.g., 18/6 or 12/12), irrigation method reference, any planned switches.
- **Workforce:** a minimal personnel directory; an empty or sample task queue.
- **Inventory:** water meter reading (baseline), nutrient stock items with amounts.

### 0.2.3 Conformance Checks (SHALL)

- Running **N days** from T0 yields **identical daily state hashes** (and identical event counts per topic) on supported platforms.
- Engine publishes a **reference summary** (energy/water/nutrient totals, biomass/harvest KPIs). Values **SHALL** match within strict tolerances (exact where deterministic, fixed rounding elsewhere).
- Canonical fixtures live in `packages/engine/tests/fixtures/golden/<days>{d}/` with `daily.jsonl` and `summary.json` pairs. Replays are driven through `runDeterministic({ days, seed, outDir })` (exported from `@/backend/src/engine/testHarness.ts`) and are exercised in CI via `pnpm --filter @wb/engine test:conf:30d` for the PR gate and `pnpm --filter @wb/engine test:conf:200d` for soak coverage.
- Golden Master topology (seed `gm-001`): one structure hosting a 100 m² growroom (5 × 20 m² zones), a 20 m² storageroom, and a 20 m² breakroom. Zone device counts are derived from blueprint capacity (`led-veg-light-600` for lighting, `cool-air-split-3000` for airflow) and guarantee coverage ≥ 1.0 and ACH ≥ 1.0.
- Zone assignments: each grow zone selects a distinct strain blueprint and exactly one cultivation method, including deterministic container/substrate/irrigation selections. Harvests generate storage lots the same tick; replants occur on the following day with fresh plant UUID streams.
- Workforce guardrails: all 8 h shifts include a 30 min break in the breakroom; janitorial tasks clean storageroom/breakroom on a 7 d / 14 d cadence. Conformance specs assert break compliance, janitorial coverage, and storage inventory integrity.
- `runDeterministic({ outDir: './reporting/<days>d' })` writes git-ignored artifacts for CI retention (`./reporting/30d`, `./reporting/200d`).

### 0.2.4 Evolution (MAY)

- Minor, backward-compatible schema changes **MAY** bump `schemaVersion` with a migration note. The canonical JSON is updated together with new expected hashes.
- A new Golden Master **MAY** be introduced for major releases; previous masters remain for regression.

> This section sets intention and acceptance; exact field names and file paths are not mandated here.

---

## 0.3 SEC Gap Register (Open Issues)

The gap register captures outstanding clarifications that block downstream
implementation. Owners are accountable for closing the loop via the linked
execution tasks; DD and TDD cross-references inherit their status from this
table.

1. **Gap 0110-RM — Read-model live data handshake** *(Closed 2025‑03‑??)*
   **Contract area:** §2 World Model (company → structure → room → zone read-model
   surfaces).
   **Owner:** Façade & UI integration working group.
   **Execution tasks:** 1110 (structure coverage), 1120 (room/zone hydration),
   1130 (workforce), 4100 (read-model store).
   **Resolution:** `companyTree` now surfaces location, capacity, tariff, and
   workforce task metadata at the structure level, room climate aggregates with
   ACH diagnostics, and zone payloads with cultivation/lighting/irrigation
   blueprints, device coverage warnings, telemetry samples, and outstanding
   tasks (see §2.5). Facade contract/integration/unit tests assert the enriched
   schema and UI selectors consume the live payloads.

---

## 1. Core Invariants (Guardrails)

These rules **always hold**. Violations are bugs.

1. **Determinism:** Given the same seed and inputs, outputs are identical. All stochasticity flows through a single RNG interface (createRng(seed, stream)). No direct Math.random.
2. **Blueprints are templates, not instances:** All runtime instances are created as **copies** of blueprints. Blueprints live under /data/\*\* and are never mutated at runtime.
3. **SI units & canonical IDs:** All physical quantities use SI units; every entity has a stable id (UUID). Display formatting is a UI concern.
4. **Separation of concerns:**
   - **Telemetry bus ≠ command bus**: events are read-only observations, not control messages.
   - **Economy/price maps separate** from device blueprints. Devices reference capability, not costs.

5. **Tick pipeline is ordered and total:** All zones/plants advance via the same fixed phase order each tick; no phase is skipped.
6. **No hidden global state:** All state changes are explicit within the world/structure tree.
7. **One-way streaming only:** The engine publishes **telemetry** over a **unidirectional** channel. **Inbound messages over the stream are forbidden** and must be rejected at transport level.

#### 1.1 Device Placement Enforcement (SHALL)

- Device eligibility (room **purpose** + placement scope) **SHALL** live in the **device blueprint** and be validated pre-load and on every placement change.
- **Zone-scoped grow equipment** (e.g., lamps) **SHALL** only be permitted in **growrooms** because **only growrooms may host zones**.
- Violations **SHALL** fail fast (load/startup) or be rejected at the façade boundary.

#### 1.2 Constants & Magic Numbers (STRICT)

**Canonical Simulation Constants (SHALL):**

- `AREA_QUANTUM_M2 = 0.25` — minimal calculable floor area unit (used for geometry rounding and capacity checks).
- `ROOM_DEFAULT_HEIGHT_M = 3` — default room height; **overrideable per structure/room blueprint**.
- `HOURS_PER_DAY = 24`, `DAYS_PER_MONTH = 30`, `MONTHS_PER_YEAR = 12` — **simulation calendar** constants.

- `CP_AIR_J_PER_KG_K = 1 005` and `AIR_DENSITY_KG_PER_M3 = 1.2041` — canonical thermodynamic baselines shared across device stubs and environmental calculations (ADR-0001).

- `DEFAULT_COMPANY_LOCATION_LAT = 53.5511`, `DEFAULT_COMPANY_LOCATION_LON = 9.9937`, `DEFAULT_COMPANY_LOCATION_CITY = "Hamburg"`, `DEFAULT_COMPANY_LOCATION_COUNTRY = "Deutschland"` — deterministic headquarters seed values until UI capture overrides them (ADR-0008).

> **Project standard:** **1 tick = 1 hour in-game (SHALL)**, backend-configurable for advanced scenarios. Game speed only scales wall-clock processing, **not** in-game duration per tick.

> **Precedence (ADR-0001):** Canonical constants live in `simConstants.ts`; any changes propagate SEC → DD → TDD → AGENTS → VISION in that order.

#### 1.3 Maintainability & Modularization (STRICT)

- **File Size Thresholds (SHALL):** Warn at **≥ 500 LOC** per file and **fail** at **≥ 700 LOC**. Generated files excluded by pattern.
- **Refactor-First Rule (SHALL):** When a file crosses the warning threshold, teams **SHALL refactor** before adding features.
- **Single Responsibility (SHOULD):** Each module has one clear purpose; avoid god-objects.
- **Complexity Guards (SHOULD):** Prefer small pure functions; target cyclomatic complexity ≤ 10.
- **Review Checklist (SHOULD):** PRs include purpose summary, touched modules map, test notes, and refactors due to thresholds.

#### 1.4 Documentation & Governance (STRICT)

- **JSDoc Mandatory (SHALL)** for all exported APIs.
- **ADR Workflow (SHALL)** for decisions affecting contracts/guardrails.
- **CHANGELOG (SHALL)** keep-a-changelog style.
- **AGENTS.md Stewardship (SHALL)** sync guardrails in same PR.
- **Doc Quality (SHOULD)** examples > prose; avoid duplication.
- **Doc Debt (MAY)** tracked with owner and due date; no release if critical docs missing.

#### 1.5 Numerical Precision, Rounding & Hash Canonicalization (STRICT)

- **Numerics:** All calculations use **IEEE-754 Float64**.
- **Comparisons:** Use dual tolerance:
  - Absolute: `EPS_ABS = 1e-9`
  - Relative: `EPS_REL = 1e-6`
     A comparison `a ≈ b` holds if `|a-b| ≤ EPS_ABS` **or** `|a-b| ≤ EPS_REL * max(1, |a|, |b|)`.
- **Rounding for reporting:** Explicit per-field rounding rules in read-models (documented alongside schemas).
- **Hash canonicalization:** Golden-master hashes are computed over canonical JSON order, **excluding derived/transient fields** and **after** applying deterministic number formatting (e.g., fixed decimals per schema).

---

## 2. World Model (Company → Structure → Room → Zone → Plant → Device)

The world is a tree with typed nodes and bounded geometry.

- **Company**: top-level owner of all structures (metadata, workforce, policies). Metadata **SHALL** include a `location` object with `longitude`, `latitude`, `city`, and `country`; coordinates are clamped to `[-180, 180]` / `[-90, 90]` and default to the Hamburg seed constants when UI capture is absent (ADR-0008).
- **Structure**: site with total usable area & volume constraints; may include outdoor areas.
- **Room**: subset of a structure; has a **roomPurpose** (see §2.1).
- **Zone**: minimal control unit for environment & scheduling. **Devices attach to zones** unless their placement scope specifies room/structure. **Every Zone SHALL reference a `cultivationMethod` blueprint** (see §7.5).
- **Plant**: biological actor with lifecycle and resource exchange.
- **Device**: capability provider attached per `placementScope` (zone|room|structure).

**Constraints (SHALL)**

- Rooms’ total area ≤ Structure capacity; Zones’ area ≤ their Room’s area.
- Devices define **effect capacity** (coverage/throughput) and may require multiples to meet zone demand.
- **HR connector:** Workforce is employed by the **company**; each employee is **assigned to exactly one structure at a time** and **SHALL** execute jobs only within that structure (see §10).

### 2.1 Room Purposes (Conceptual)

**Intent:** Define common room **purposes** without prescribing layouts or devices.

- **Growroom (room.growroom)** — Hosts one or more **Zones** with environmental control. It **SHALL** be the locus for plant lifecycle, light cycles, irrigation, and device effects. Access/sanitation policies **SHOULD** reduce cross-contamination. **Only growrooms MAY host zones; all other purposes SHALL NOT host zones.**
- **Breakroom (room.breakroom)** — Staff rest/logistics; **SHALL NOT** alter biological/environmental states.
- **Laboratory (room.laboratory)** — **Research/breeding** of new genetics via **lab-only devices**.
- **Storageroom (room.storageroom)** — Inventory authority (nutrients, consumables, equipment) and biosecurity policies.
- **Salesroom (room.salesroom)** — Inventory egress; **SHALL NOT** influence growth.
- **Workshop (room.workshop)** — **Repairs/maintenance**. Repair tasks **SHALL** execute here; may enforce calibration/acceptance policies.

> Purposes are optional presets; the engine treats rooms uniformly. Function emerges from zones, policies, and workflows.

### 2.2 Structure Ownership & Tenure

**Ownership & Tenure (SHALL):**

- Ownership model: Each structure records an owner (company-controlled) and optional tenure metadata (freehold/leasehold/sublease). Tenure does not change simulation physics; it governs economy hooks (lease accruals, deposits).

- Lease terms: Lease contracts define effective start day, base lease rate per hour, and optional indexation rules captured in scenario config. Indexation, if enabled by a scenario, is deterministic and evaluated once per day.

- Deterministic IDs: Ownership and lease records carry immutable structure IDs; changes produce a new record with a new audit entry and preserve prior records for reporting.

- Scope: Real-estate pricing inputs are used by economy modules only; device placement and growth logic remain tenure-agnostic.

### 2.5 CompanyTree Read-Model (Resolved Gap 0110-RM)

The façade `companyTree` read model is the canonical live-data export for
structure, room, and zone dashboards. Payloads are frozen before transport and
are deterministic per tick.

- **Structure nodes** expose `{ id, name, location, area_m2, volume_m3 }`,
  canonical capacity usage, coverage ratios (lighting, HVAC, ACH), resolved
  `tariffs { price_electricity, price_water }`, KPI rollups (energy, water,
  labour, maintenance), device summaries, outstanding task counts, and warning
  envelopes (`scope`, `targetId`, `severity`).
- **Room nodes** carry `{ id, structureId, purpose, area_m2, volume_m3 }`, ACH
  coverage (current vs target) with warnings, a climate snapshot plus
  telemetry samples, device summaries, nested zones, and outstanding task
  totals inherited from child zones.
- **Zone nodes** include `{ id, name, area_m2, volume_m3 }` plus cultivation
  context (method slug/name, container, substrate, strain), lighting schedule
  and duty cycle, irrigation method with water/labour projections, KPI
  snapshots, pest status, device coverage diagnostics, climate snapshots with
  telemetry history, task queues, and warnings (coverage + climate).
- **Device summaries** reuse the `DeviceSummary` contract across all levels.

Contract tests (`packages/facade/tests/contract/**`) and integration/unit
coverage assert the schema; UI selectors consume the payload directly so
fixtures are no longer required for structure/room/zone surfaces.

### 2.3 Entity Lifecycle — Clone / Rename / Delete / Move (Normative)

**Lifecycle rules (SHALL):**

- Clone: Creates a new entity with a new UUID and deep-copied configuration; references are rewired deterministically. Cloning MUST NOT duplicate derived state.

- Rename: Changes human-readable labels only; IDs remain stable; rename events are audit-only and do not affect hashes.

- Delete: Disallowed when it would violate invariants (e.g., deleting a growroom with zones). Deletion occurs through intents at tick boundaries and is reversible only via scenario/restore, not in-run undo.

- Move: Devices may move within the same structure only and must pass placement validation (allowedRoomPurposes, placementScope). Zones cannot be moved outside growrooms. Plants may be reassigned within the same zone family when a method explicitly permits (e.g., re-pot tasks).

- Auditability: All lifecycle changes emit post-commit telemetry and are reflected in read-models with prior↔next references.

---

## 3. Data Contracts (from DD + /data/\*\*)

Validation occurs at load time; on failure, the engine must not start. Validation schemas live with the engine domain types so the engine remains the single source of truth; see [ADR-0005](ADR/ADR-0005-validation-schema-centralization.md) for implementation details.

### 3.0.1 Blueprint Taxonomy (STRICT, ADR-0015)

- Every blueprint under `/data/blueprints/**` **MUST** publish a `class` field with a
  domain-level value plus a kebab-case `slug` that remains unique per class. Valid
  domains are:
  - `strain`, `structure`, `cultivation-method`, `substrate`, `container`, `irrigation`,
    `disease`, `pest`
  - `device.climate`, `device.airflow`, `device.lighting`, `device.filtration`
  - `room.purpose.<slug>` for room purposes (slug preserved in the class)
  - `personnel.role.<slug>` / `personnel.skill.<slug>` when workforce blueprints are in
    play
    Blueprint directory rule: All blueprints are auto-discovered under /data/blueprints/<domain>/<file>.json with a maximum depth of two segments (domain + file). Devices are /data/blueprints/device/<category>.json or /data/blueprints/device/<category>/<file>.json limited to two levels; no deeper subfolders are allowed.
- JSON remains the **single source of truth** for blueprint metadata. Loaders **SHALL**
  trust the JSON payload first, using the filesystem only to derive expectations and to
  surface mismatches when contributors misplace files.
- Loaders **MUST** raise a hard failure (e.g. `BlueprintTaxonomyMismatchError`) when the
  domain inferred from the path and the JSON `class` diverge, preventing silent drift
  between fixtures and runtime logic.
- Subtype semantics move to explicit fields:
  - `device.climate` declares `mode` (`thermal`, `dehumidifier`, `humidity-controller`,
    `co2`, ...)
  - `device.airflow` declares `subtype` (`exhaust`, `intake`, `recirculation`, ...)
  - `device.lighting` declares `stage` (e.g. `vegetative`, `flowering`)
  - `device.filtration` declares `media` (e.g. `carbon`, `hepa`)
  - `cultivation-method` declares `family` and `technique`
  - `disease` declares `pathogen` and `syndrome`; `pest` declares `taxon` and
    `speciesGroup`
  - `substrate` declares `material` and `cycle`; `irrigation` declares `method` and
    `control`
  - `structure` declares `structureType`
- Device blueprints that expose multiple capabilities **SHALL** publish an `effects` array with matching configuration blocks (`thermal`, `humidity`, `lighting`, etc.); `DeviceInstance` snapshots copy these structures immutably so pipeline stages consume blueprint intent before falling back to heuristics (ADR-0011).
- Legacy `kind`/`type` identifiers are **removed**; integrations **MUST** read the
  `class` discriminator and the explicit subtype fields noted above.

### 3.1 Device Placement & Eligibility (STRICT)

**Policy (SHALL):**

- Device blueprints declare **`placementScope ∈ { 'zone' | 'room' | 'structure' }`** and an **`allowedRoomPurposes`** whitelist.
- At **install/move** time, placement is validated against the current room purpose + scope. Zone-scoped devices are valid **only** in growrooms. Violations fail fast.
- Capacity metadata (`coverage_m2`, `airflow_m3_per_h`, `max_*`) is part of the blueprint contract and used for effectiveness scaling and diagnostics.

### 3.2 Room–Device Policy Matrix (Orientation)

**Orientation (SHOULD):**

- Provide a reference matrix mapping **roomPurpose → eligible device classes** (e.g., growroom: lighting, climate, airflow; storageroom: none affecting biology; laboratory: lab-only devices).
- The matrix is **informative**; enforcement derives from blueprint `allowedRoomPurposes` and scope rules.

### 3.3 Task & Treatment Catalogs (Data-Driven)

**Catalogs (SHALL):**

- Task definitions live under `/data/configs/task_definitions.json` with deterministic **codes**, **requiredRoleSlug**, **requiredSkills** (`{ skillKey, minSkill01 }`), **base durations**, and **cost hooks** (ADR-0013).
- Treatments (e.g., pest control, substrate sterilization) are modelled as **tasks** with materials/equipment references.
- Schedulers consume catalog entries deterministically; façade validation rejects unknown codes or malformed thresholds.

### 3.4 Namespaces & Naming Conventions (STRICT)

- **Blueprint taxonomy:** JSON `class` values use domain identifiers (`strain`, `cultivation-method`, `device.climate`, `room.purpose.<slug>`, …). Slugs are **kebab-case**, unique **per class**.
- **Filesystem alignment:** Blueprint files follow the canonical directory rule and **MUST** mirror the JSON `class`. Mismatches are loader errors.
- **Identifiers:** Entity IDs are UUIDs. Human-facing names are free text but **not** used for referential integrity.

### 3.5 Identity & UUID Policy (Traceability)

- **Entities:** UUID v4 for world entities (company/structure/room/zone/plant/device).
- **RNG seeds:** Where RNG streams require persisted seeds (e.g., workforce identities), **UUID v7** is used to brand deterministic seeds without leaking wall-clock into logic.
- **Stability:** IDs are immutable; renames do not affect IDs; move/clone produce new IDs where required and retain cross-references for audit.

### 3.6 Economy Units & Rates (STRICT)

- **Base Unit (SHALL):** All recurring monetary rates **per hour** (e.g., `cost_per_hour`, `maintenance_per_hour`, `lease_per_hour`).
- **No \*\_per_tick (SHALL NOT)**; engine derives tick costs via **in-game tick hours**.
- **Aggregation (SHOULD):** Reports integrate to day/week/month.
- **Consistency (SHALL):** Resource prices use unit pricing (e.g., `price_electricity` per kWh, `price_water` per m³, `price_per_kg`).
- **Neutral terminology (SHALL):** Monetary fields **MUST NOT** embed currency symbols or codes (e.g., `*_EUR`, `*_USD`, `€`); values are interpreted as neutral costs that scenarios contextualize.
- **Price maps (SHALL):** `/data/prices/devicePrices.json` enumerates device **CapEx** (`capitalExpenditure`), **recurring maintenance curves** (`baseMaintenanceCostPerHour`, `costIncreasePer1000Hours`), and **scheduled service visit costs** (`maintenanceServiceCost`). `/data/prices/utilityPrices.json` is the canonical tariff source exposing **`price_electricity` per kWh** and **`price_water` per m³**. Nutrient inputs are costed via irrigation/substrate consumption — there is **no nutrient tariff entry** in the utility map (ADR-0004).
- **Legacy (MAY):** Migrate `per_tick → per_hour` via configured tick length.

#### 3.6.1 Electricity Tariff Policy (STRICT)

- **Backend tariff (SHALL):** The **electricity price is fixed and configured in backend settings** as `price_electricity` (neutral cost per kWh) sourced from `/data/prices/utilityPrices.json`.
- **Difficulty modifiers (SHALL):** Difficulty may **either**
  - apply a **multiplicative factor** `difficulty.energyPriceFactor` to the backend tariff, **or**
  - **override** it via `difficulty.energyPriceOverride`.
     If both are set, **override takes precedence**.
- **Determinism (SHALL):** The effective tariff **MUST** be fully determined by the loaded configuration at simulation start (including difficulty). Changing difficulty mid-run **SHALL** be disallowed or treated as an explicit administrative migration.
- **Computation (SHALL):** Device energy use integrates **power (kW) × time (h) → kWh**, then multiplies by the **effective `price_electricity`** to accrue cost.
- **Reporting (SHOULD):** Read-models expose both **consumption (kWh)** and **cost** per period.

> **Pending live data — Structure/Room/Zone read models (Tasks 1110, 1120, 4100):** The UI wiring requires the `companyTree` provider to emit enriched structure nodes with `{ id, name, location, floorArea_m2, usableArea_m2, roomCount, zoneCount }` plus `structureTariffs` joins for effective `price_electricity`/`price_water`. Room entries must surface `roomPurpose`, geometry, and the latest climate aggregates (temperature_c, relativeHumidity, co2_ppm) needed for dashboards. Zone entries need deterministic cultivation context — `cultivationMethodId`, `cultivationMethodSlug`, active strain reference, `lightSchedule { onHours, offHours, startHour }`, `irrigationMethodId`, coverage diagnostics (`deviceCoverage.{lighting, climate, airflow}`), climate telemetry (`ppfd_umol_m2s`, `dli_mol_m2d_inc`, `temperature_c`, `relativeHumidity`, `co2_ppm`, `ach`), and pending task codes/warnings so Phase 4 UI tasks can hydrate selectors without fixtures.

---

## 4. Simulation Tick (Phase Order)

### 4.1 Tick Semantics (SHALL)

- **Fixed in-game quantum** (project standard: 1h).
- Game speed scales wall-clock only.
- Pause/Resume/Step affect processing, not in-game time.
- All physics/biology/economy use tick’s in-game duration.
- Golden-master hashes are invariant to game-speed.

### 4.2 Phase Order

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

## 5. Determinism & RNG

- **RNG creation**: `createRng(seed, streamId)` returns a pure, reproducible generator (ADR-0007).
- **Streams**: stable `streamId`s (e.g., `plant:<id>`, `device:<id>`, `economy:realestate:<structureId>`). No cross-coupling.
- **Hashing**: per-day canonical state hash.

---

## 6. Environment & Devices (Well-Mixed Baseline)

- **Light:** devices contribute to a zone-level PPFD profile capped by device coverage and efficiency.
- Zones persist lighting telemetry fields `ppfd_umol_m2s` and `dli_mol_m2d_inc`, both clamped to non-negative finite values and updated via the canonical light emitter stub (`createLightEmitterStub`) each tick (ADR-0010).
- **Air/Climate:** HVAC devices contribute sensible/latent heat removal/addition and airflow. Well-mixed bucket as baseline (**upgrade path:** alternative psychrometric models like Magnus/Penman–Monteith may be slotted under the same interface later).
- **CO₂:** injection rate limited by device spec and safety; leaks/venting modeled at zone level.

- **Dehumidification:** water removal from air, respecting device capacity and psychrometric constraints.

- **Coverage & Airflow diagnostics:** Phase 1 aggregates device `coverage_m2` per zone; if effective coverage < zone floor area the stage clamps device effectiveness to the coverage ratio and emits `zone.capacity.coverage.warn`. Airflow totals produce **ACH** (air changes/hour); if ACH < 1, emit `zone.capacity.airflow.warn` and surface totals for downstream modelling.

### 6.1 Device Heat & Power Coupling (SHALL)

- **Power → Heat:** Non-useful electrical power becomes **sensible heat** in the hosting zone unless explicitly exported.
- **Efficiency:** Device blueprint defines **useful-work efficiency** in [0,1]; **waste-heat fraction** = `1 − efficiency`.
- **Capacity & Duty:** Power draw respects **rated capacity** and **duty cycle**.
- **HVAC Interaction:** Climate devices can reduce zone heat/moisture within rated limits; energy still accrues.

### 6.2 Device Quality vs. Condition (SHALL) — **Option A adopted**

**Definitions:**

- **quality01 ∈ [0,1] (immutable at acquisition):** Intrinsic build quality of a device instance.
- **condition01 ∈ [0,1] (dynamic):** Current health/wear state.

**UI/Economy Mapping (SHALL):**

- **Canonical engine scale:** `quality01`, `condition01` in **[0,1]**.
- **Presentation/economy scale:** `qualityPercent = round(100 * quality01)`; where external formulas expect 0–100, this mapping **SHALL** be applied at the façade/read-model layer.

**Acquisition (SHALL):**

- New device instances receive **quality01** deterministically from the **device RNG stream** (`device:<uuid>`) using the blueprint’s quality policy.

**Effects (SHALL):**

- **Degradation:** Per-tick wear scales by monotonic non-increasing `m_degrade(quality01)`.
- **Maintenance demand:** Scales by non-increasing `m_maint(quality01)`.
- **Repairability:** When `condition01 ≥ repairMinThreshold01`, repair cost/time/success scale via `m_repair(quality01)` / `p_success(quality01)` using the device stream for draws if probabilistic.
- **MTBF:** MAY be extended by a quality factor.

**Separation (SHALL):** Quality affects **rates/thresholds**, not the purchase price (price maps handle costs).
**Observability (SHOULD):** Telemetry MAY expose both quality01 (static) and condition01 (dynamic).

## 6.3 Interface-Stacking & Stub Specifications (Phase 1)

**Interface-Stacking (SHALL):**

- Devices **MAY** implement multiple effect interfaces (thermal, humidity, lighting, airflow, filtration, sensors).
- Effects **SHALL** be computed in deterministic pipeline order (§4.2) and aggregated per zone.
- Stubs **SHALL** be pure functions with predefined test vectors for validation.
- Runtime evaluation **SHALL** prioritise declared `device.effects`/`device.effectConfigs`; heuristics are fallback-only for legacy blueprints to maintain determinism across multi-interface devices (ADR-0011).

**Stub Conventions (SHALL):**

- **Determinism:** Same inputs → same outputs (with fixed seed). No `Math.random` in stubs.
- **Units:** W, Wh, m², m³/h, mg/h, µmol·m⁻²·s⁻¹ (PPFD), K, %.
- **Clamps:** All 0..1 scales hard-clamped; negative flows/stocks avoided.
- **Caps:** Stubs respect `capacity`/`max_*` from blueprint parameters.
- **Telemetry:** Each stub returns primary outputs + auxiliary values (e.g., `energy_Wh`).

**Composition Patterns (SHOULD):**

- **Pattern A:** Multi-Interface in one device (e.g., Split-AC: thermal + humidity + airflow).
- **Pattern B:** Combined device with coupled effects (e.g., dehumidifier with reheat).
- **Pattern C:** Composition via chain (e.g., fan → filter).
- **Pattern D:** Sensor + actuator in one housing.
- **Pattern E:** Substrate buffer + irrigation (service + domain).

**Reference:** `/docs/proposals/20251002-interface_stubs.md` (consolidated specification)

---

## 7. Irrigation, Nutrients & Cultivation

**Intent:** Describe _what_ the simulation must achieve regarding water, nutrients, and cultivation setup—without prescribing device microdetails.

### 7.1 Outcomes (SHALL)

- Zones **SHALL** receive water and nutrients according to a chosen irrigation method that is consistent and deterministic per tick.
- Structure-level resources (water meter, nutrient stock) **SHALL** be the single sources of truth for accounting.
- Manual delivery **SHALL** surface as tasks; automated delivery **SHALL** execute on schedule deterministically.

### 7.2 Responsibilities (SHOULD)

- Engine **SHOULD** compute demand from plant state/environment, then fulfill via selected method.
- Engine **SHOULD** track delivery, runoff, shortages; emit telemetry.
- Façade **SHOULD** expose intents to change methods and maintain stocks.

### 7.3 Interfaces (MAY)

- Intents to select/adjust method and update stocks **MAY** be offered.
- Telemetry **MAY** include last delivery, pending manual work, upcoming maintenance windows.

### 7.4 Non-Goals

- No enforced JSON shapes for methods or devices here; those belong to data design.

### 7.5 **Cultivation Methods (Zone Requirement) (STRICT)**

- **Zone Requirement (SHALL):** Every **Zone** **SHALL** reference exactly one **`cultivationMethod`** (blueprint id), selected from `/data/blueprints/cultivation-method/*.json`.
- **Method Contents (SHALL):** A cultivation method blueprint **SHALL** specify at minimum:
  - **Planting density model:** e.g., `areaPerPlant_m2` and/or `maxPlantsPerZone` rule.
  - **Plant containers:** one or more **container options** (e.g., pots by nominal liters) with **acquisition cost** and **service life** policy (degradation/replace rules).
  - **Substrate:** one or more **substrate options** with **`purchaseUnit`** (`"liter"|"kilogram"`), **`unitPrice_per_*`** aligned to that unit, **`densityFactor_L_per_kg`** for deterministic L↔kg conversion, and **`reusePolicy`** (sterilisation task required when `maxCycles > 1`). Cultivation and irrigation subsystems use the density factor to translate container volumes into substrate mass and moisture targets.
  - **Irrigation compatibility:** determined indirectly through substrate options. Irrigation method blueprints **SHALL** declare the substrate slugs they support under `compatibility.substrates`; cultivation methods inherit compatibility from the irrigation methods that list their chosen substrate (ADR-0003).
- **Costs (SHALL):**
  - **Containers** incur **CapEx** (acquisition) and **maintenance/replacement** per service-life model.
  - **Substrates** incur **OPEX/CapEx** depending on policy (e.g., single-use vs re-use with sterilization task cost).
  - All **rates** are normalized per §3.6 (per hour for recurring, per item/unit for acquisitions).
- **Capacity (SHALL):**
  - Max plants derived by method: `maxPlants = floor(zone.area_m2 / areaPerPlant_m2)` unless the method declares a stricter rule.
- **Tasks Integration (SHOULD):**
  - Re-potting, substrate replacement, sterilization, and disposal **SHOULD** be represented as tasks from the task catalog and billed accordingly.
- **Determinism (SHALL):** Given the same method + stocks + schedules, outcomes are reproducible.

---

## 8. Plant Model (Lifecycle & Growth)

**Intent:** Define how plants progress through stages and how light cycles influence growth—at a conceptual level.

### 8.1 Outcomes (SHALL)

- Plants **SHALL** maintain a lifecycle with at least: Seed/Start, Vegetative, Flowering, Harvest-ready.
- A **photoperiod light cycle** **SHALL** govern stage behavior: defaults **18/6** (veg) and **12/12** (flower). Changing the cycle **SHALL** cause deterministic transitions per strain rules.
- Per-tick growth, stress, and quality **SHALL** derive from environment × strain tolerance windows.
  - Stress curves are resolved via a **piecewise quadratic ramp** anchored on the strain's `envBands` (green/yellow ranges) and
    the numeric tolerances declared under `stressTolerance`. Each contribution (temperature, VPD, PPFD) produces a value in
    **[0,1]**; the engine averages the available contributions per tick and clamps to **[0,1]**.
  - VPD **SHALL** be computed with the Magnus formula (`A = 17.27`, `B = 237.3`, base `0.6108` kPa) using relative humidity
    in **[0,1]**. Dew point calculations **SHALL** clamp humidity to `(1e-6, 1-1e-6)` to avoid singularities. When a strain lacks a
    VPD band the engine **SHALL** fall back to the humidity fraction band for the third contribution.

#### 8.1.1 Growth Fractions (SHALL)

- Strain blueprints **SHALL** expose `growthModel.dryMatterFraction` as either a scalar fraction **∈ [0,1]** or an object with optional `vegetation` and `flowering` keys (each **∈ [0,1]**).
  - When an object is provided, the engine **SHALL** use the `vegetation` value for both `seedling` and `vegetative` lifecycle stages.
  - `flowering` values **SHALL** apply to `flowering` and `harvest-ready` stages; if missing the engine **SHALL** fall back to the `vegetation` value and finally to the documented default of **0.2**.
- `growthModel.harvestIndex` **SHALL** accept either a scalar fraction **∈ [0,1]** or an object `{ targetFlowering }` **∈ [0,1]** that represents the target harvest index for flowering/harvest stages.
  - When only `targetFlowering` is present, the same value **SHALL** be reused for vegetative stages; if absent the engine **SHALL** fall back to the default of **0.7**.
- Growth calculations (e.g., `calculateBiomassIncrement`) **SHALL** resolve these unions before use so phase-aware data remains deterministic.

### 8.2 Light Cycle & DLI (SHOULD)

- **Light schedule** (on/off hours per 24h) is first-class per zone.
- Integrate incident light over photoperiod into a conceptual **DLI** signal for growth heuristics.
- Strains **SHOULD** provide tolerance windows and photoperiod sensitivity.

### 8.3 Responsibilities (SHOULD)

- **Engine:** apply cycle to compute exposure signals; ensure deterministic transitions.
- **Façade:** intents to switch/schedule cycle changes at tick boundaries.
- **UI/Monitor:** display current/next cycle, exposure indicators.

### 8.4 Boundaries (MAY/NOT)

- Exact photometrics/spatial distribution and formulas may live in data/design docs; not mandated here.

### 8.5 Pests & Diseases (Health & Biosecurity)

**Policy (SHALL/SHOULD):**

- **Risk accumulation:** Pests/diseases accumulate deterministic **risk scores** from environment and hygiene signals; no random outbreaks without RNG stream use.
- **Inspections & treatments:** Represented as tasks with deterministic effects and cooldowns; successful treatments reduce risk and may impose quarantine intervals.
- **Biosecurity hooks:** Room purposes and workflows may reduce cross-contamination via scheduled sanitation tasks. Telemetry surfaces warnings when risk exceeds thresholds.
- **MVP implementation:** Zones track risk tiers (`low`/`moderate`/`high`) derived from environment + hygiene inputs. Moderate risk emits inspection tasks; high risk emits treatment tasks and applies a 72 h quarantine suppressing conflicting work. Telemetry publishes `telemetry.health.pest_disease.risk.v1` and `telemetry.health.pest_disease.task_emitted.v1` events so read-models/UI surface warnings.

---

## 9. Harvest & Inventory (Core Hooks)

- **Triggers:** phenology-based and quality guardrails.
- **Actions:** create harvest lots with weight, moisture, quality; move to inventory.
- **Post-harvest:** curing/aging is separate from the core tick.

---

## 10. Economy Integration (Non-intrusive)

- **Consumption:** energy (kWh), water (m³ or L), nutrients (kg) aggregated per tick.
- **Energy pricing:** costs computed using **effective `price_electricity`** per §3.6.1.
- **Maintenance:** time-dependent maintenance curves per device; replacement suggestions to planning.
- **Separation:** costs use consumption + price maps; **devices remain price-agnostic**.
- **Cultivation costs:** containers/substrates from §7.5 accounted via price maps (acquisition/recurring), and method-specific tasks (sterilization, repotting) accrue labor/material costs.

---

## 10. Workforce & HR (Employees, Job Market, Agents)

**Scope (SHALL):**

- Company-scoped employees with deterministic identities and trait assignments. Employees are **assigned to exactly one structure** at a time; they perform tasks only within that structure.
- Deterministic hiring market with manual scans, candidate pools, and onboarding intents. Telemetry exposes KPIs, warnings, payroll snapshots, and hiring events.
- `SimulationWorld` embeds a deterministic workforce branch capturing roles, employees (with UUID v7 RNG seeds), task definitions, task queues, KPI snapshots, warnings, and payroll accumulators so façade/read-model layers consume a single authoritative structure (ADR-0013).

**Outcomes (SHALL):**

- Reproducible scheduling, morale/fatigue updates, overtime accruals, and payroll calculations given the same seed and inputs.

**Responsibilities (SHOULD):**

- Façade provides intents for hiring, scheduling, raises/termination, and manual tasks.
- Engine enforces working-hour caps and deterministic cooldowns for raises; emits telemetry post-commit.

### 10.0 Employment Model (SHALL)

- Company-scoped employees; assigned to a single structure; tasks only within that structure.

### 10.1 Outcomes (SHALL)

- Deterministic directory/market; reproducible task selections.

### 10.2 Responsibilities (SHOULD)

- Façade intents for provisioning and manual work; telemetry for queues/assignments.

### 10.3 Boundaries (MAY/NOT)

- Detailed HR rules later; not required for core conformance.

### 10.4 Employee Identity & RNG Streams (SHALL)

- Identity generation **SHALL** first query `randomuser.me` with a deterministic seed and a hard **500 ms** timeout; failures fall back to curated pseudodata under `/data/personnel/**`, sampled via `createRng(rngSeedUuid, "employee:<rngSeedUuid>")`. Only pseudonymous identity data persists or emits externally, maintaining the SEC privacy stance (ADR-0014).

#### 10.4.1 Gender Distribution Configuration (SHALL)

- **`worldSettings.pDiverse ∈ [0, 0.05]`**; default **0.02**; remainder split evenly between `m` and `f`.
- Deterministic via job-market RNG stream; values outside range invalid.

### 10.5 Work Hours & Overtime Policies

**Working-time contract (SHALL):**

- Base working hours per in-game day **5–16 h**;
- Overtime **≤ 5 h** per day, applied after base hours;
- Working days per week **1..7**; optional shift start hour **0..23**;
- Overtime billed at **1.25×**; daily payrolls close with **Banker’s rounding**.

### 10.6 Traits, Morale & Skills

**Deterministic effects (SHOULD):**

- Employees carry **traits** with strengths in **[0,1]** affecting task duration, error rate, fatigue/morale deltas, device wear, XP, and salary expectations. Conflicts are resolved deterministically.
- **Skills** live on the **[0,1]** scale; task definitions specify structured `requiredSkills`. Learning-by-doing **MAY** raise skills via deterministic increments.

### 10.7 Real-Estate Pricing & Lease Terms (SHALL)

**Deterministic pricing:**

- Structures classify into **A–F** classes with deterministic **variance `v ∈ [−0.5, 1.75]`** applied to baseline lease rates to produce site-specific lease expectations. Upfront lease payment rules are scenario-defined and deterministic.

**Live façade contract:** `workforceView` emits roster rows with `{ employeeId, displayName, structureId, roleSlug, morale01, fatigue01, currentTaskId?, nextShiftStartTick, baseHoursPerDay, daysPerWeek, shiftStartHour }` plus deterministic assignment summaries `{ structureId, structureName, headcount, employeeIds[] }`. Warning envelopes now always include structure/employee identifiers when resolvable. The economy read model exposes `balance_per_h`, `delta_per_h`, `dailyDelta_per_h`, `labourCost_per_h`, `maintenanceCost_per_h`, `utilitiesCost_per_h`, resource usage (`energy_kwh_per_h`, `water_m3_per_h`), cost breakdowns, and the per-structure tariff join mandated by §3.6 so dashboards consume live data without fixtures.

---

## 11. System Facade & Integration (Backend ↔ Facade ↔ UI)

**Intent:** Keep the engine deterministic and headless, the UI dumb, and all control flowing through a single façade.

### 11.1 Roles & Boundaries

- **Engine (Backend)** — deterministic tick progression, pure domain logic; **no network endpoints**.
- **System Facade** — single ingress; validates & queues intents; exposes read models; provides **Transport Adapter**.
- **UI** — renders read models; emits user intents via the façade only.

### 11.2 Contracts (High-Level)

- **Intents (Commands):** declarative, idempotent via `intentId`; validated/authorized at the façade; applied at tick boundaries.
- **Queries (Read Models):** versioned snapshots for caching/diffing.
- **Telemetry (Events):** immutable post-commit facts with `simTick` and unique `eventId`.

**Example topics (informative):**

- Intents: `engine.intent.zone.set-irrigation-method.v1`, `engine.intent.device.move.v1`
- Telemetry: `telemetry.tick.completed.v1`, `telemetry.zone.snapshot.v1`, `telemetry.harvest.created.v1`

### 11.3 Transport Policy

- Transport adapter with **Socket.IO default**; SSE acceptable.
- Separate channels: **intents (client→server)** and **telemetry (server→client)**; **no multiplexing**.
- Telemetry channel is **receive-only** for clients; inbound emits are rejected with deterministic
  `WB_TEL_READONLY` errors surfaced via `TransportAck` and mirrored on a `telemetry:error` event.
- Intents namespace accepts only `intent:submit` events with an acknowledgement callback. Payloads must
  include a string `type`; invalid submissions return `WB_INTENT_INVALID`, unexpected event names yield
  `WB_INTENT_CHANNEL_INVALID`, and handler failures respond with `WB_INTENT_HANDLER_ERROR` while preserving determinism.
- All acknowledgements follow `{ ok: boolean, error?: { code, message } }` so façade consumers can assert
  SEC §11.3 compliance in contract tests.

> **Sim-control contract checklist (Tasks 0130, 3100–3130, 4140):** Follow the intent, acknowledgement, and telemetry guardrails enumerated in [TDD §6a](./TDD.md#6a-simulation-control-contract-checklist-tasks-0130-3100-3130-4140). The façade **MUST** expose playback commands (`engine.intent.sim.play.v1`, `.pause.v1`, `.step.v1`, `.set-speed.v1`) plus environment adjustors (`engine.intent.zone.set-light-schedule.v1`, `.set-environment-setpoint.v1`) that acknowledge with `{ intentId, correlationId, queuedTick, appliedTick, stateAfter }`. The consolidated sim-control snapshot `{ simTime, tick, isPaused, speedMultiplier, pendingIntentCount, lastIntentId }` and the paired `telemetry.tick.completed.v1` / `telemetry.sim.state.v1` events keep the UI deterministic while reconciling acknowledgements with tick progression.

### 11.4 Versioning & Observability

- Versioned public contracts; deprecations with window.
- Expose metrics: queue depth, apply latency, rejects, disconnects.

---

## 12. Telemetry, Events & APIs

- **Events:** emitted after commit; immutable, append-only.
- **No commands on the bus:** control enters through façade/engine API only.
- **Snapshots:** stable schema; avoid transient/unit-formatted fields.
- **Audit minima (SHOULD):** daily rollups include energy/water/nutrient totals, biomass deltas, task throughput, device maintenance deltas, inventory in/out.

---

## 13. Migration Notes (from Legacy to Re-Reboot)

- Replace ad-hoc randomness with seeded RNG streams.
- Remove device-embedded pricing. Introduce/align `/data/prices/**`.
- Validate all `/data/**` against DD before engine start; fail fast.
- Ensure `/docs/task/**` proposals are reflected—either inlined here or referenced in Appendix B.
- **Naming alignment:** `roomPurpose` replaces prior `roomArchetype` terminology across data/docs.
- **Device schema update:** add required `placementScope` in `devices/*.json`.
- **Quality scale:** adopt **[0,1]** engine scale; façade/read-model maps to 0–100 where needed.
- **Save schema:** save files carry `schemaVersion`; the engine ships a migration registry (`packages/engine/src/backend/src/saveLoad/migrations`) with deterministic fixtures validating legacy upgrades (current: v0 → v1 normalises `simTime`).

- Water + **Electricity tariff:** ensure backend config exposes `price_electricity` for electricity in kWh and `price_water` for water per m^3; difficulty layer provides `energyPriceFactor` and/or `energyPriceOverride` as well as `waterPriceFactor` and/or `waterPriceOverride`.

---

## 14. Open Questions (to be resolved iteratively)

All previously listed questions now have binding ADRs. New questions MUST cite a `docs/tasks/**` proposal before landing here.

- ✅ Minimum viable irrigation methods for v1 are locked in [ADR-0017](./ADR/ADR-0017-irrigation-baseline-methods.md).
- ✅ Stress→growth curve shape is formalised in [ADR-0018](./ADR/ADR-0018-stress-growth-curve-model.md).
- ✅ Economy reporting cadence (hourly accrual + daily rollups) is governed by [ADR-0019](./ADR/ADR-0019-economy-reporting-cadence.md).
- ✅ Zone height defaults and cultivation method presets are defined in [ADR-0020](./ADR/ADR-0020-zone-height-and-cultivation-presets.md).

---

## 15. Acceptance Criteria for Engine Conformance

- Given seed **S** and identical `/data/**`, a 7-day run yields identical state hashes across platforms.
- All events are reproducible and stable (no wall-clock leakage, only sim time).
- Unit tests cover each phase with golden vectors; integration test covers a reference 30-day scenario.
- Numeric tolerances (§1.5) and canonical hashing are respected in all golden checks.
- Telemetry topic contracts align with [engine/telemetry](./engine/telemetry.md).

---

## Appendix A — Terminology (Canonical)

- **Tick**: smallest simulation time step (project standard: 1h).
- **Zone**: smallest controllable environment unit; **requires a `cultivationMethod`**.
- **Blueprint**: JSON template stored in `/data/**`, never mutated at runtime.
- **Telemetry bus**: read-only event stream for observers.
- **Well-mixed model**: single-bucket approximation for air and light in a zone.
- **Read Model**: versioned, stable snapshot for queries.
- **Intent**: idempotent command (queued, validated) applied at tick boundaries.

---

## Appendix B — Task Proposals Crosswalk (Preservation of `/docs/task/**`)

> This appendix **preserves every proposal** from `/docs/task/**` with a pointer to where it landed in the core or why it is deferred.

**Table schema:** `task_path | title | summary | core_target_section | status (merged/deferred/contradiction) | notes`

| task_path | title | summary | core_target_section | status | notes |
| --- | --- | --- | --- | --- | --- |
| [tasks/0001-appendix-b-crosswalk-fill.md](./tasks/0001-appendix-b-crosswalk-fill.md) | Appendix B Crosswalk Fill | Backfills Appendix B with mappings for legacy proposals and documents follow-up bookkeeping. | [Appendix B](#appendix-b--task-proposals-crosswalk-preservation-of-docstask) | merged | Completed in this revision; see [CHANGELOG](./CHANGELOG.md#unreleased--blueprint-taxonomy-v2) entry. |
| [tasks/0002-co2-actuator-and-environment-coupling.md](./tasks/0002-co2-actuator-and-environment-coupling.md) | CO₂ Actuator and Environment Coupling | Define injector interface, couple zone CO₂ dynamics, and wire energy costs with deterministic tests. | [§6](#6-environment--devices-well-mixed-baseline); [§10](#10-economy-integration-non-intrusive) | merged | Stub, runtime coupling, and steady-state/ramp tests shipped in `Co2InjectorStub` + `co2Coupling.integration.test.ts`. |
| [tasks/0003-golden-master-conformance-suite.md](./tasks/0003-golden-master-conformance-suite.md) | Golden Master & Conformance Suite | Refresh 30-day/200-day deterministic runs with hash fixtures and CI gating. | [§0.2](#02-reference-test-simulation-golden-master); [§15](#15-acceptance-criteria-for-engine-conformance) | deferred | Align with [TDD §12](./TDD.md#12-golden-master-sec-15) for artifact layout and tolerances. |
| [tasks/0004-pest-disease-system-mvp.md](./tasks/0004-pest-disease-system-mvp.md) | Pest & Disease System MVP | Build deterministic risk scores, inspection/treatment tasks, and telemetry hooks. | [§3.3](#33-task--treatment-catalogs-data-driven); [§8.5](#85-pests--diseases-health--biosecurity) | deferred | Leans on task catalog rules plus [VISION_SCOPE §1](./VISION_SCOPE.md#1-vision) risk pillar. |
| [tasks/0005-save-load-and-migrations.md](./tasks/0005-save-load-and-migrations.md) | Save/Load and Migrations | Deliver crash-safe saves, schema versioning, and migration scaffolding with regression fixtures. | [§0.2](#02-reference-test-simulation-golden-master); [§13](#13-migration-notes-from-legacy-to-re-reboot) | merged | Atomic save/load pipeline and migration registry shipped with fixtures + tests (Task 0005). |
| [tasks/0006-sensors-stage-content-and-noise-model.md](./tasks/0006-sensors-stage-content-and-noise-model.md) | Sensors Stage Content and Noise Model | Formalise sensor payload schema, deterministic noise, and tick ordering checks. | [§Tick Pipeline](#tick-pipeline-canonical-9-phases) | deferred | Mirrors stub guidance from [proposals/20251002-interface_stubs.md](./proposals/20251002-interface_stubs.md#pattern-d--sensor--aktuator-in-einem-geh%C3%A4use). |
| [tasks/0007-determinism-helper-scaffolds.md](./tasks/0007-determinism-helper-scaffolds.md) | Determinism Helper Scaffolds | Provide shared hashing and UUID v7 helpers for tests without touching runtime flows. | [§5](#5-determinism--rng) | deferred | Constrained to test scaffolds per [AGENTS §2](../AGENTS.md#2-core-invariants-mirror-sec-1). |
| [tasks/0008-package-audit-reporting-matrix.md](./tasks/0008-package-audit-reporting-matrix.md) | Package Audit & Reporting Matrix | Capture dependency review matrix and CLI for tooling governance. | [§0.1](#01-platform--monorepo-baseline-technology-choices) | deferred | Outputs feed `docs/reports/PACKAGE_AUDIT.md` and [DD §1](./DD.md#1-goals--non-goals) tooling bullets. |
| [tasks/0009-psychrometric-wiring-plan.md](./tasks/0009-psychrometric-wiring-plan.md) | Psychrometric Wiring Plan | Add test-only VPD helper backed by psychrolib with property coverage. | [§6](#6-environment--devices-well-mixed-baseline); [§8](#8-plant-model-lifecycle--growth) | deferred | Helper slated for physiology integration per [TDD §9a](./TDD.md#9a-stub-tests--test-vectors-phase-1). |
| [tasks/0010-cultivation-method-tasks-runtime.md](./tasks/0010-cultivation-method-tasks-runtime.md) | Cultivation Method Tasks Runtime | Translate cultivation method policies into deterministic maintenance task schedules. | [§7.5](#423-zone-requirement-shall); [§3.3](#33-task--treatment-catalogs-data-driven); [§10](#10-economy-integration-non-intrusive) | deferred | Scheduler must respect [AGENTS §5.1](../AGENTS.md#51-cultivation-methods-are-required-on-zones-sec-75). |
| [tasks/0011-device-degradation-and-maintenance-flows.md](./tasks/0011-device-degradation-and-maintenance-flows.md) | Device Degradation and Maintenance Flows | Model condition decay, maintenance planning, and replacement economics. | [§6.2](#62-device-quality-vs-condition-shall--option-a-adopted); [§10](#10-economy-integration-non-intrusive) | deferred | Long-run coverage ties into [TDD §8](./TDD.md#8-economy--tariffs-sec-36) maintenance checks. |
| [tasks/0012-economy-accrual-consolidation.md](./tasks/0012-economy-accrual-consolidation.md) | Economy Accrual Consolidation | Consolidate all resource costs under per-hour tariffs with CI drift guards. | [§10](#10-economy-integration-non-intrusive); [§7.5](#423-zone-requirement-shall) | deferred | Builds on price-map policy in [AGENTS §5](../AGENTS.md#5-data-contracts--price-separation-sec-3). |
| [tasks/0013-transport-adapter-hardening.md](./tasks/0013-transport-adapter-hardening.md) | Transport Adapter Hardening | Enforce telemetry read-only channels and add negative transport tests. | [§11.3](#113-transport-policy) | deferred | Contract coverage complements [TDD §11](./TDD.md#11-telemetry-read-only-transport-separation-sec-11). |
| [tasks/0014-vpd-and-stress-signals-finalization.md](./tasks/0014-vpd-and-stress-signals-finalization.md) | VPD and Stress Signals Finalization | Finalise VPD-derived stress curves and integrate them into plant physiology. | [§8](#8-plant-model-lifecycle--growth); [§14](#14-open-questions-to-be-resolved-iteratively) | merged | Stress curves resolved via piecewise quadratic ramp; VPD Magnus integration and dew point clamps codified. |
| [tasks/0015-blueprint-taxonomy-v2-loader-tests.md](./tasks/0015-blueprint-taxonomy-v2-loader-tests.md) | Blueprint Taxonomy v2 Loader Tests | Harden loader with depth/class enforcement and failure fixtures. | [§3.0.1](#301-blueprint-taxonomy-strict-adr-0015) | deferred | Matches enforcement rules from [AGENTS §5](../AGENTS.md#5-data-contracts--price-separation-sec-3). |
| [tasks/0016-open-questions-to-adrs.md](./tasks/0016-open-questions-to-adrs.md) | Open Questions to ADRs | Convert SEC open questions into ADRs and update dependent docs. | [§14](#14-open-questions-to-be-resolved-iteratively) | deferred | ADR workflow governed by [AGENTS §1.4](../AGENTS.md#14-documentation--governance-strict). |
| [tasks/0017-performance-budget-in-ci.md](./tasks/0017-performance-budget-in-ci.md) | Performance Budget in CI | Wire perf harness CI gate enforcing throughput and heap thresholds. | [§0.2](#02-reference-test-simulation-golden-master) | deferred | CI policy should mirror [TDD §0](./TDD.md#0-principles) perf guidance and [`simulation-reporting`](./engine/simulation-reporting.md). |
| [tasks/0018-terminal-monitor-mvp.md](./tasks/0018-terminal-monitor-mvp.md) | Terminal Monitor MVP | Ship neo-blessed telemetry dashboard with read-only enforcement. | [§0.1](#01-platform--monorepo-baseline-technology-choices); [§11.3](#113-transport-policy) | deferred | Read-model focus aligns with [VISION_SCOPE §1](./VISION_SCOPE.md#1-vision) experience pillar. |
| [proposals/20251002-interface_stubs.md](./proposals/20251002-interface_stubs.md) | Interfaces & Stubs — Consolidated | Consolidates interface stacking patterns and deterministic stub expectations. | [§6](#6-environment--devices-well-mixed-baseline); [§Tick Pipeline](#tick-pipeline-canonical-9-phases) | merged | Serves as source-of-truth for stub conventions; see [TDD §9a](./TDD.md#9a-stub-tests--test-vectors-phase-1). |
| [proposals/20251005-HR_part2.md](./proposals/20251005-HR_part2.md) | Workforce 1.1 Market Scan | Details on-demand hiring market scans, traits, and raise cadence extensions. | [§10](#10-economy-integration-non-intrusive) | deferred | Awaiting ADR to extend workforce market specifics beyond current SEC scope. |
| [proposals/20251005-HR_workforce.md](./proposals/20251005-HR_workforce.md) | HR & Workforce — MVP | Outlines workforce MVP (roles, scheduling, payroll KPIs) adopted into SEC §10. | [§10](#10-economy-integration-non-intrusive) | merged | Content integrated when SEC §10 was drafted; remains canonical reference. |

- Contradictions are tracked in [docs/re-reboot/contradictions.md](./re-reboot/contradictions.md) with exact refs.

### ADR Crosswalk (Binding Outcomes)

| ADR      | Outcome                                                                                                                | SEC Section(s) |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | -------------- |
| ADR-0016 | UI component stack locked to shadcn/ui on Radix with Tailwind, lucide, Framer Motion, and Recharts/Tremor              | §0.1           |
| ADR-0015 | Blueprint taxonomy flattened to domain-level folders with explicit subtype metadata                                    | §3.0.1         |
| ADR-0014 | Workforce identities sourced via deterministic randomuser.me call with pseudodata fallback                             | §10.4          |
| ADR-0013 | Workforce branch embedded in `SimulationWorld` with structured roles, employees, tasks, KPIs, warnings, payroll        | §3.3, §10      |
| ADR-0012 | `.nvmrc`/`.node-version` pin Node.js 22 (LTS) locally and CI uses Node.js 22 (LTS)                                           | §0.1           |
| ADR-0011 | Device blueprints declare `effects`/config blocks copied to instances before pipeline evaluation                       | §3.0.1, §6.3   |
| ADR-0010 | Zones persist PPFD/DLI telemetry updated by the canonical light emitter stub                                           | §6             |
| ADR-0008 | Company metadata mandates location object with Hamburg defaults and coordinate clamps                                  | §1.2, §2       |
| ADR-0007 | `createRng(seed, streamId)` established as the sole deterministic RNG entry point                                      | §5             |
| ADR-0005 | Validation schemas colocated with engine domain types to keep engine authoritative                                     | §3             |
| ADR-0004 | Tariff and maintenance price maps normalized to per-hour electricity/water fields only                                 | §3.6           |
| ADR-0003 | Irrigation compatibility anchored on irrigation method blueprints via substrate slugs                                  | §7.5           |
| ADR-0001 | Canonical constants (geometry, thermodynamics, calendar, HQ defaults) fixed in `simConstants.ts` with precedence order | §1.2           |

---

## Appendix C — Contradictions (Pointer)

All hard conflicts (with minimal quotes and exact line refs) are tracked in `docs/re-reboot/contradictions.md`.

---

## Next Steps (Iterative Plan)

1. **Populate Appendix B** by scanning `/docs/task/**` and drafting the crosswalk table.
2. **Confirm invariants** against `AGENTS.md` and add missing guardrails here + propose edits in `AGENTS.md`.
3. **Backfill precise units** per DD into §3 and §6–§8 (now including §1.5 numerics).
4. **Add test vectors**: provide one reference scenario with per-phase expected outputs for 3 ticks.
5. **DD patches:** add `placementScope` (required) and align `allowedRoomPurposes`; add cultivation method schema fields (containers, substrate, density, costs, service life).

---

# TDD — Weed Breed (Aligned to **Simulation Engine Contract v0.2.1**)

> **Scope**: End‑to‑end TDD strategy and concrete checklists for the simulation engine, façade, transports, UI read‑models, and data blueprints.
> **Source of truth**: When this file and the **Simulation Engine Contract (SEC)** disagree, **SEC wins**.

---

## 0) Principles

1. **Contract‑first**: Tests encode SEC semantics; failing tests mean contract drift.
2. **Determinism**: No non‑determinism in tests; all RNG via `createRng(seed, streamId)`.
3. **Small to system**: Start with pure functions, move to module/pipe, then world/system.
4. **Golden Master**: Canonical savegame & daily state hashes validate long‑runs (SEC §15).
5. **Single units**: Economy asserts use **per‑hour** units; `*_per_tick` is forbidden (derive via tick hours).
6. **Readable failures**: Tests explain “what SEC rule is violated”.
7. **No Magic Numbers**: All constants come from `simConstants.ts`.

### Diagnostics assertions

- Prefer matching on diagnostic codes (e.g. `arrayContaining` + `objectContaining`) instead of strict array lengths when
  running multi-stage or full pipeline tests. This keeps specs resilient to additional diagnostics while still verifying the
  contractually required codes.

---

## 1) Canonical Constants (mirroring SEC §1.2)

- `AREA_QUANTUM_M2 = 0.25`
- `ROOM_DEFAULT_HEIGHT_M = 3`
- `HOURS_PER_TICK = 1` (1 tick = 1 in‑game hour)
- Calendar: `HOURS_PER_DAY = 24`, `DAYS_PER_MONTH = 30`, `MONTHS_PER_YEAR = 12`
- Thermodynamics: `CP_AIR_J_PER_KG_K = 1 005`, `AIR_DENSITY_KG_PER_M3 = 1.2041`.
- Headquarters defaults: `DEFAULT_COMPANY_LOCATION_LAT = 53.5511`, `DEFAULT_COMPANY_LOCATION_LON = 9.9937`, `DEFAULT_COMPANY_LOCATION_CITY = "Hamburg"`, `DEFAULT_COMPANY_LOCATION_COUNTRY = "Deutschland"`.
- Default zone height scenarios use `ROOM_DEFAULT_HEIGHT_M` (ADR-0020) whenever fixtures omit `height_m`.

**Test rule:** Any module using these must import from `simConstants.ts`. A lint rule bans hard‑coded duplicates.

---

## 2) Test Taxonomy & Folder Layout

```
src/
  backend/
    src/
      engine/              # core, headless
      facade/              # validation, intents, read-models, transport adapter
      constants/           # simConstants.ts
      util/                # rng, math, tariffs
    tests/
      unit/                # pure functions, schema guards
      module/              # device models, physiology sub-systems
      integration/         # tick pipeline, zone/plant lifecycle
      conformance/         # golden master runs (N days)
      fixtures/            # deterministic seeds, blueprints snapshots
```

- **Runner:** `vitest` (node).
- **Coverage threshold:** 90% lines/branches in `engine/` and `facade/`; 80% overall.
- **Snapshot location:** `__snapshots__` next to specs (only for low‑volatility payloads; prefer golden JSON files for world states).
- **Blueprint fixtures:** Repository fixtures **MUST** live inside the domain folders that mirror their `class` (`device/climate/*.json`, `cultivation-method/*.json`, `room/purpose/*.json`, etc.). Specs walk `/data/blueprints/**` (see `packages/engine/tests/unit/domain/blueprintTaxonomyLayout.test.ts`) to assert the folder-derived taxonomy matches the JSON declaration, validate depth guardrails, and fail fast when contributors park files elsewhere.
- **Manual package audit:** regenerate `docs/reports/PACKAGE_AUDIT.md` with `pnpm report:packages` whenever dependency metadata changes; the automated markdown sync test was removed after repeated encoding instability in CI.

Blueprint directory rule: All blueprints are auto-discovered under /data/blueprints/<domain>/<file>.json with a maximum depth of two segments (domain + file). Devices are /data/blueprints/device/<category>.json or /data/blueprints/device/<category>/<file>.json limited to two levels; no deeper subfolders are allowed.
- **Save/load fixtures:** Legacy/current save snapshots live under `packages/engine/tests/fixtures/save/v*/`. Unit specs in `tests/unit/save/` exercise schema guards and crash-safe writes; integration specs in `tests/integration/saveLoad/` load fixtures, apply migrations, and assert canonical hashes stay stable across versions.

> ✅ **Live data — Read-model contract coverage (Tasks 1110, 1120, 1130, 4100):**
> Contract, integration, and unit tests now assert `companyTree` structure nodes
> expose location/capacity/coverage/tariff rollups, rooms surface purpose and
> climate telemetry, and zones project cultivation, lighting, irrigation,
> device coverage, telemetry, and task queues. Workforce and economy suites pin
> roster rows, KPI utilization, warning envelopes, tariff joins, and the
> economy `_per_h` balance/cost/resource fields so Phase 4 UI wiring uses
> deterministic live data. SEC gap 0110-RM is closed.

---

## 3) Data Validation & Fixtures

- **Blueprints** (`/data/blueprints/**`) are **read‑only** fixtures in tests.
- **Schema:** Validate with **Zod** at façade boundaries and as test helpers.
- **Company schema:** `companySchema` asserts `location.longitude`/`latitude` stay within [-180, 180]/[-90, 90] and accepts the Hamburg defaults until UI capture overrides them.
- **Device blueprint schema:** Tests require `effects` arrays with matching config blocks when multiple interfaces are declared; `createDeviceInstance` copy tests assert the structures are deep-frozen.
- **Prices** live under `/data/prices/**`; ensure no prices leak into device blueprints.
- **Tariff maps:** Schema specs assert `/data/prices/devicePrices.json` exposes `capitalExpenditure`, `baseMaintenanceCostPerHour`, `costIncreasePer1000Hours`, `maintenanceServiceCost` and `/data/prices/utilityPrices.json` exposes only `price_electricity`/`price_water`.
- **Irrigation fixtures (ADR-0017):** Tests assert `/data/blueprints/irrigation/` contains `manual-watering-can`, `drip-inline-fertigation-basic`, `top-feed-pump-timer`, and `ebb-flow-table-small` blueprints to guarantee baseline coverage.
- **Cultivation presets (ADR-0020):** Fixture guards keep `basic-soil-pot`, `sea-of-green`, and `screen-of-green` available with their canonical container/substrate defaults (pot-10l + soil-single-cycle, pot-11l + coco-coir, pot-25l + soil-multi-cycle).
- Physiological VPD/stress coverage:
  - `packages/engine/tests/unit/physiology/vpd.spec.ts` asserts Magnus-based saturation, dew point clamps, and VPD determinism at humidity bounds.
  - `packages/engine/tests/unit/physiology/stressCurves.spec.ts` exercises the ADR-0018 quadratic tolerance ramp across temperature, humidity/VPD, and PPFD bands; `tests/unit/shared/psychro/psychro.test.ts` keeps the property-based guard on `computeVpd_kPa`.
  - `packages/engine/tests/integration/pipeline/plantStress.integration.test.ts` runs a seed→flowering scenario confirming VPD excursions degrade health and biomass accumulation as mandated by SEC §8.
- **Taxonomy validation:** Unit tests (`packages/engine/tests/unit/data/blueprintTaxonomy.spec.ts`) assert that any mismatch between a blueprint's directory taxonomy and its JSON `class` raises a `BlueprintTaxonomyMismatchError`. The guard also rejects nested directories beyond the two-level allowance so misplacements fail immediately.

- **Fixture layout check:** Repository-level specs enumerate blueprint folders and ensure no stray directories exist outside the sanctioned taxonomy tree. Tests fail if contributors invent ad-hoc folders.

```ts
// tests/unit/schema/zoneSchema.spec.ts
import { expect, it, describe } from 'vitest';
import { zoneSchema } from '@/backend/src/facade/schemas/zone';

describe('Zone schema — SEC §7.5', () => {
  it('requires cultivationMethod id', () => {
    const invalid = { id: 'u', name: 'Z1' } as any;
    const res = zoneSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });
});
```

## 3a) Economy Unit Guardrails

- ESLint rule `wb-sim/no-economy-per-tick` rejects monetary identifiers that use `*_per_tick` units while permitting `_per_tick` for physical telemetry/process fields.
- `packages/engine/tests/unit/economy/noEconomyPerTickRule.test.ts` exercises positive/negative snippets so contributors see the guardrail fail fast.

---

## 4) RNG & Stream Tests (SEC §5)

- `createRng(seed, streamId)` produces identical sequences across platforms.
- Shared determinism helpers (`hashCanonicalJson`, `newV7`) live under `packages/engine/src/shared/determinism` with dedicated unit specs; production code must keep using the existing deterministic UUID services until [docs/tasks/0007-determinism-helper-scaffolds.md](docs/tasks/0007-determinism-helper-scaffolds.md) clears an ADR.
- **Streams** are stable ids: `plant:<uuid>`, `device:<uuid>`, `economy:<scope>`.

```ts
// tests/unit/util/rng.spec.ts
import { expect, it } from 'vitest';
import { createRng } from '@/backend/src/util/rng';

it('stable sequences per stream', () => {
  const a1 = createRng('seed-1', 'plant:123');
  const a2 = createRng('seed-1', 'plant:123');
  for (let i = 0; i < 1000; i++) {
    expect(a1()).toBeCloseTo(a2(), 12);
  }
});
```

---

## 5) Light Schedule Contract (SEC §8)

- Domains: `onHours ∈ [0,24]`, `offHours ∈ [0,24]`, integer or **0.25h** grid.

- Constraint: `onHours + offHours = 24`.
- Optional: `startHour ∈ [0,24)`.

```ts
// tests/unit/facade/lightSchedule.spec.ts
import { expect, describe, it } from 'vitest';
import { validateLightSchedule } from '@/backend/src/facade/validation/lightSchedule';

describe('Light schedule — SEC §8', () => {
  it('keeps 15‑min grid and on+off==24', () => {
    const ls = validateLightSchedule(17.8, 7.1, 5.6);
    expect(ls.onHours % 0.25).toBe(0);
    expect(ls.offHours % 0.25).toBe(0);
    expect(ls.onHours + ls.offHours).toBe(24);
    expect(ls.startHour).toBeGreaterThanOrEqual(0);
    expect(ls.startHour).toBeLessThan(24);
  });
});
```

## 5a) Workforce Schema Coverage (SEC §10)

- `employeeSchema` enforces UUID v7 seeds, morale/fatigue bounds (`0..1`), and working-hour policy: base hours **5–16**, overtime **≤ 5**, `daysPerWeek ∈ [1,7]`.
- `workforceTaskDefinitionSchema` rejects skill thresholds outside `[0,1]` and mandates structured `requiredSkills` entries.
- `workforceStateSchema` validates the full branch (`roles`, `employees`, `taskDefinitions`, `taskQueue`, `kpis`, `warnings`, `payroll`) embedded in the world snapshot to guard deterministic scheduling inputs. `workforceWarningSchema` clamps severity to `'info' | 'warning' | 'critical'` and requires deterministic codes/messages plus optional structure/employee/task anchors.
- Unit coverage: `tests/unit/domain/workforceSchemas.test.ts` exercises the above constraints (including warnings) and snapshot parsing.
- Façade integration coverage: `packages/facade/tests/integration/workforceView.integration.test.ts` projects a simulated workforce state into directory filters, live queue entries, KPI percentages, and decorated warnings via `createWorkforceView`.
- Payroll scaling, raise cadence, and termination handling are covered by `packages/engine/tests/unit/workforce/payroll.test.ts`,
  `packages/engine/tests/unit/services/workforce/raises.test.ts`, and
  `packages/engine/tests/integration/workforce/workforceScheduling.integration.test.ts`, respectively. These suites assert the
  new rate multipliers, cooldown resets, morale adjustments, task cleanup, and telemetry emission introduced for HR flows.
- Trait coverage: `packages/engine/tests/unit/workforce/traits.test.ts` validates trait sampling conflicts, stacking modifiers, and salary deltas; `packages/engine/tests/integration/pipeline/workforceTraits.integration.test.ts` asserts runtime assignments expose trait-adjusted duration/error/fatigue data for downstream subsystems; `packages/facade/tests/unit/readModels/traitBreakdownView.test.ts` covers the façade aggregation.
- Identity service coverage: `packages/engine/tests/unit/workforce/identitySource.test.ts` seeds `randomuser.me`, enforces the 500 ms timeout, and validates the pseudodata fallback via `createRng(rngSeedUuid, "employee:<rngSeedUuid>")`.

## 5b) Lighting Telemetry & Stubs (SEC §6)

- `zoneSchema` and pipeline integration tests ensure `ppfd_umol_m2s` and `dli_mol_m2d_inc` are present, finite, and non-negative on world snapshots.
- `lightEmitterStub.spec.ts` validates PPFD scaling with dimming, DLI increments derived from tick seconds, and optional power telemetry accounting.
- Integration coverage asserts lighting devices prioritise blueprint `effects.lighting` configs before heuristics.

---

## 6) Device Placement & Room Purpose (SEC §2)

- **Zones only in growrooms**.
- **Devices** carry `placementScope: 'zone' | 'room' | 'structure'` and declare `allowedRoomPurposes`.

```ts
// tests/module/placement/eligibility.spec.ts
import { expect, it } from 'vitest';
import { canInstallDevice } from '@/backend/src/facade/rules/placement';

it('rejects zone device in non-grow room', () => {
  const ctx = { room: { purpose: 'storageroom' }, device: { placementScope: 'zone' } } as any;
  expect(canInstallDevice(ctx).ok).toBe(false);
});
```

> **Checklist — Sim-control acknowledgements (Tasks 0130, 3100, 3110, 3130, 4140):** See §6a for the contract guardrails that façade command specs and UI wiring must satisfy when covering `engine.intent.sim.play|pause|step|set-speed.v1` plus zone climate intents (`engine.intent.zone.set-light-schedule.v1`, `.set-environment-setpoint.v1`).

### 6a) Simulation Control Contract Checklist (Tasks 0130, 3100–3130, 4140)

| Control | Intent topic & payload fields | Acknowledgement timing & shape | Telemetry coupling requirements | Follow-up tasks |
| --- | --- | --- | --- | --- |
| **Play** (resume ticks) | `engine.intent.sim.play.v1` with `{ intentId, correlationId, requestedTick }`. `requestedTick` **MUST** equal the current committed tick when resuming (Task 3100). | Façade acknowledgement **MUST** emit immediately on queue with `{ intentId, correlationId, queuedTick }`, then update `appliedTick` and `stateAfter.isPaused=false` in the same ack envelope once the tick commits (Task 3110). | Every subsequent `telemetry.tick.completed.v1` **MUST** include `{ simTime, tick, isPaused=false, speedMultiplier }` so the Sim Control Bar can reconcile playback state; `telemetry.sim.state.v1` snapshot (Task 3130) mirrors the latest ack for reconnecting clients. | 3100, 3110, 3130 |
| **Pause** (halt ticks) | `engine.intent.sim.pause.v1` with `{ intentId, correlationId, requestedTick }`. Payload tick guards prevent pausing stale worlds (Task 3100). | Queue acknowledgement mirrors Play. On commit, `stateAfter.isPaused=true` and `appliedTick` **MUST** equal the tick when pause took effect (Task 3110). | The tick that honours the pause **MUST** emit a final `telemetry.tick.completed.v1` reflecting `isPaused=true`. `telemetry.sim.state.v1` **MUST** broadcast the paused snapshot before further intents are accepted (Task 3130). | 3100, 3110, 3130 |
| **Step** (advance one tick while paused) | `engine.intent.sim.step.v1` with `{ intentId, correlationId, stepCount=1 }`. When `isPaused=false`, façade **MUST** reject with deterministic `WB_SIM_STEP_WHILE_RUNNING` (Task 3100). | Ack occurs after the queued tick executes: `{ intentId, correlationId, queuedTick, appliedTick = queuedTick + 1, stateAfter.pendingIntentCount }`. `stateAfter.isPaused` **MUST** remain `true` so the UI knows playback is still halted (Task 3110). | UI expects exactly one `telemetry.tick.completed.v1` with monotonic tick and unchanged `speedMultiplier`. `telemetry.sim.state.v1` snapshot **MUST** include `pendingIntentCount` so the step button can disable until the ack arrives (Task 3130). | 3100, 3110, 3130 |
| **Set speed** (adjust multiplier) | `engine.intent.sim.set-speed.v1` with `{ intentId, correlationId, speedMultiplier }`. Multiplier **MUST** be validated against SEC §11 bounds and persisted in sim state (Task 3100). | Queue acknowledgement returns `{ intentId, correlationId, queuedTick }`; commit appends `appliedTick` and `stateAfter.speedMultiplier`. The façade **MUST** guarantee monotonic multiplier history for audit (Task 3120). | The tick that applies the change **MUST** emit `telemetry.tick.completed.v1` carrying the new `speedMultiplier`. `telemetry.sim.state.v1` snapshot and read-model `simControl` view **MUST** match the ack so the speed selector stays in sync (Tasks 3120, 3130). | 3100, 3120, 3130 |

**Verification hooks:**

- Contract tests **MUST** correlate intent acknowledgements with the `telemetry.tick.completed.v1` events emitted for the same `appliedTick`, ensuring deterministic reconciliation in the Sim Control Bar (Task 3110).
- Read-model tests **MUST** expose a `simControl` snapshot `{ simTime, tick, isPaused, speedMultiplier, pendingIntentCount, lastIntentId }` mirroring the latest ack/telemetry pair so UI wiring can diff state without relying on transport order (Task 3130).
- UI integration tests for the Sim Control Bar (Task 4140) **MUST** assert that intent buttons debounce while `pendingIntentCount > 0`, resume rendering on ack, and reconcile the displayed tick with `telemetry.tick.completed.v1` sequences provided by the façade test harness.

---

## 7) Tick trace instrumentation & perf harness (Engine)

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

- Canonical order: `applyDeviceEffects → applySensors → updateEnvironment → applyIrrigationAndNutrients → applyWorkforce → advancePhysiology → applyHarvestAndInventory → applyEconomyAccrual → commitAndTelemetry` (mirrors SEC §4.2).

**Checklist (order trace):**

- [ ] runTick(..., { trace: true }) yields exactly 9 phases
- [ ] Second item is "applySensors" (before environment integration)
- [ ] No extra or missing phases; names match public stage symbols
- `runTick(world, ctx, { trace: true })` returns `{ world, trace }` where `world` is the immutable post-tick snapshot and `trace` is an optional {@link TickTrace} with monotonic `startedAtNs`, `durationNs`, `endedAtNs`, and heap metrics for every stage without feeding wall-clock time into simulation logic.
- `runOneTickWithTrace()` (engine test harness) clones the deterministic demo world and returns `{ world, context, trace }` for integration/unit assertions.
- `withPerfHarness({ ticks })` executes repeated traced ticks and reports `{ traces, totalDurationNs, averageDurationNs, maxHeapUsedBytes }` so perf tests and CI guard throughput (≥ 5 k ticks/min ≈ ≤ 12 ms avg/tick) and heap (< 64 MiB).
- `generateSeedToHarvestReport({ ticks, scenario })` wraps the orchestrator and perf harness to emit JSON artifacts documenting lifecycle transitions + telemetry; see `docs/engine/simulation-reporting.md` for CLI usage and schema.
- `createRecordingContext(buffer)` attaches the instrumentation hook so specs can assert that stage completions mirror the trace order.
- `pnpm --filter @wb/engine perf:ci` runs the CI performance budget harness (10 k traced ticks, deterministic demo world) and fails when throughput falls below 5 k ticks/min or heap exceeds 64 MiB; a 5 % guard band emits warnings for near-regressions requiring manual review.
- Perf CI enforces ms/tick budgets for determinism checkpoints: baseline demo (`createBaselinePerfWorld`) ≤ 0.20 ms/tick and target scenario (`createTargetPerfWorld`, 1 room + 5 zones fully equipped) ≤ 0.40 ms/tick. Thresholds live in `PERF_SCENARIO_THRESHOLDS`.
- `packages/engine/tests/unit/engine/pipeline/applyDeviceEffects.invariants.test.ts` clamps humidity to [0,100] %, CO₂ to `SAFETY_MAX_CO2_PPM`, and keeps enthalpy non-negative using deterministic `fast-check` seeds to stress the stage.

---

## 8) Economy & Tariffs (SEC §3.6)

- **Per‑hour units only** in all recurring costs.

- **Tariffs (hotfix):** backend config exposes **`price_electricity`** (per kWh) and **`price_water`** (per m³).
- **Decision:** Monetary identifiers are currency-neutral — tests reject fields or literals that bake `EUR`, `USD`, `GBP`, or symbol suffixes into names/strings.

- **Source of truth:** `/data/prices/utilityPrices.json` is the canonical tariff map and **only** carries electricity and water prices; nutrient costs are covered by irrigation/substrate consumption flows.

- **Device maintenance:** `/data/prices/devicePrices.json` provides `capitalExpenditure`, `baseMaintenanceCostPerHour`, `costIncreasePer1000Hours`, and `maintenanceServiceCost`. Schema tests must guard these identifiers.

- Difficulty layer may set **`energyPriceFactor`/`energyPriceOverride`** and **`waterPriceFactor`/`waterPriceOverride`**; **override wins**.

- Effective tariffs computed **once at sim start**.

- **Reporting cadence (ADR-0019):** Economy read-model specs assert hourly (per tick) ledger rows exist and that daily totals equal deterministic 24-hour sums; alternate cadences should fail tests.
- `packages/engine/tests/unit/readmodels/structureTariffs.test.ts` covers per-structure tariff overrides, field-level precedence, and ensures daily roll-ups retain baseline invariants for read-model consumers.
- `packages/engine/tests/integration/pipeline/economyAccrual.integration.test.ts` audits workforce payroll so hourly slices summed with banker’s rounding match finalized day totals and reset the current-day accumulator.

```ts
// tests/unit/util/tariffs.spec.ts
import { expect, it } from 'vitest';
import { resolveTariffs } from '@/backend/src/util/tariffs';

it('override beats factor (electricity & water)', () => {
  const cfg = { price_electricity: 0.32, price_water: 4.0 }; // neutral costs
  const diff = { energyPriceFactor: 1.5, energyPriceOverride: 0.5, waterPriceFactor: 2.0 };
  const t = resolveTariffs(cfg, diff);
  expect(t.kWh).toBe(0.5); // override
  expect(t.m3).toBe(8.0); // factor (no override)
});

it('hourly cost derives from power draw (W) and tariff (kWh)', () => {
  const powerW = 480; // device draw
  const tariff = { kWh: 0.4 };
  const hours = 3;
  const kWh = (powerW / 1000) * hours;
  expect(kWh * tariff.kWh).toBeCloseTo(0.576, 6);
});
```

---

## 9) Cultivation Methods on Zones (SEC §7.5)

- Zone **must** reference a `cultivationMethod` defining **containers**, **substrates** (incl. `densityFactor_L_per_kg` and `purchaseUnit`), **irrigation** compatibility, and **planting density**.
  - Irrigation compatibility is derived from irrigation method blueprints that list the substrate slug under `compatibility.substrates`; zones selecting a substrate without matching irrigation support should fail validation.
- Canonical irrigation method coverage is validated by fixture tests to keep `manual-watering-can`, `drip-inline-fertigation-basic`, `top-feed-pump-timer`, and `ebb-flow-table-small` available (ADR-0017).
- Zone presets default to `basic-soil-pot`, `sea-of-green`, or `screen-of-green` bundles; schema/read-model specs surface these as the initial options and fail if the canonical container/substrate pairs disappear (ADR-0020).
- Substrate blueprints SHALL include `reusePolicy.maxCycles` (matching the top-level `maxCycles`), `densityFactor_L_per_kg`, and unit price metadata bound to `purchaseUnit`. Validation rejects reuse profiles missing sterilisation tasks when `maxCycles > 1`.

```ts
// tests/integration/zone/cultivationMethod.spec.ts
import { expect, it } from 'vitest';
import { createWorld } from '@/backend/src/engine/testHarness';

it('zone without cultivationMethod fails validation', async () => {
  const world = await createWorld({ zone: { cultivationMethodId: undefined } });
  expect(world.errors).toContainEqual(expect.stringContaining('cultivationMethod'));
});
```

---

## 9a) Stub Tests & Test Vectors (Phase 1)

**Reference Test Vectors (from `/docs/proposals/20251002-interface_stubs.md` §8):**

- **Thermal:** 1000 W, eff=0.9, 50 m³ room (≈60 kg air) ⇒ ΔT ≈ **+0.6 K/h** (sanity)
  - Test: `packages/engine/tests/unit/stubs/ThermalActuatorStub.test.ts:30-41`
- **Humidity:** 500 g/h dehumidify, 60 kg air, k_rh(25°C) ≈ 0.15 ⇒ ΔrH ≈ **-1.25 %/h**
  - Test: `packages/engine/tests/unit/stubs/HumidityActuatorStub.test.ts:32-39`
- **Lighting:** 600 µmol·m⁻²·s⁻¹, 0.25 h ⇒ **DLI_inc ≈ 0.54 mol·m⁻²**
  - Test: `packages/engine/tests/unit/stubs/LightEmitterStub.test.ts:23-29`
- **NutrientBuffer:** capacity_N=10000 mg, buffer_N=1000 mg, flow_N=500 mg, demand_N=300 mg, leach=10% ⇒ uptake=**300**, leached=**50**, new_buffer=**1150**
  - Test: `packages/engine/tests/unit/stubs/NutrientBufferStub.test.ts:27-34`
- **CO₂ Injector:** pulse=200 ppm/tick, duty=1, baseline 420 ppm ⇒ Δppm=**200** with target/safety clamps
  - Test: `packages/engine/tests/unit/stubs/Co2InjectorStub.test.ts`

**Stacking-Pattern Tests (Integration):**

- **Pattern A (Split-AC):** Multi-Interface in one device (Thermal + Humidity + Airflow)
  - Test: `packages/engine/tests/integration/pipeline/multiEffectDevice.integration.test.ts:226-276`
- **Pattern B (Dehumidifier+Reheat):** Combined device with coupled effects
  - Test: `packages/engine/tests/integration/pipeline/multiEffectDevice.integration.test.ts:278-327`
- **Pattern C (Fan→Filter):** Composition via chain (Airflow + Filtration)
  - Test: `packages/engine/tests/integration/pipeline/fanFilterChain.integration.test.ts`
- **Pattern D (Sensor+Actuator):** Test: `packages/engine/tests/integration/pipeline/sensorActuatorPattern.integration.test.ts`
- **Pattern E (Substrate+Irrigation):** Test: `packages/engine/tests/integration/pipeline/irrigationNutrientPattern.integration.test.ts`
- **Pattern F (CO₂ Enrichment):** Test: `packages/engine/tests/integration/pipeline/co2Coupling.integration.test.ts`

**Acceptance Criteria (Stubs):**

- ✅ Pure functions, deterministic, units validated
- ✅ Caps/Clamps enforced; no negative stocks/flows
- ✅ Tests for all stubs including the above vectors
- ✅ Telemetry fields available (energy_Wh, dli_inc, uptake/leached, …)

---

## 10) Power→Heat Coupling (SEC §6.1)

- Non‑useful electrical power becomes **sensible heat** in hosting zone unless exported. Assert temperature delta is positive given power draw and insufficient removal capacity.

```ts
// packages/engine/tests/unit/thermo/heat.spec.ts
import { expect, it } from 'vitest';
import { applyDeviceHeat } from '@/backend/src/engine/thermo/heat';

it('adds sensible heat proportional to power draw and duty', () => {
  const zone = { floorArea_m2: 60, height_m: 3, airMass_kg: 60 * 3 * 1.2041 } as const;
  const delta = applyDeviceHeat(zone, {
    powerDraw_W: 600,
    dutyCycle01: 0.5,
    efficiency01: 0.9,
  });

  expect(delta).toBeGreaterThan(0);
});
```

---

## 10.1) Zone capacity diagnostics (SEC §6)

- Phase 1 clamps device impact to `coverage_m2 / zoneArea` when < 1. Warn via `zone.capacity.coverage.warn` and surface totals.
- Airflow totals compute ACH; emit `zone.capacity.airflow.warn` when ACH < 1.

```
// packages/engine/tests/integration/pipeline/zoneCapacity.integration.test.ts
import { describe, expect, it } from 'vitest';

describe('Phase 1 zone capacity diagnostics', () => {
  it('clamps device effectiveness when coverage undershoots demand', () => {
    // assert coverage ratio scales heat delta and warning triggers
  });

  it('warns when airflow-derived ACH drops below 1', () => {
    // expect ACH warning + totals in runtime snapshot
  });
});
```

---

## 11) Telemetry Read‑only; Transport Separation (SEC §11)

- No writes on telemetry channel. Intents and telemetry must not be multiplexed.
- Telemetry emits must surface `WB_TEL_READONLY` via both the acknowledgement payload and a
  `telemetry:error` mirror event.
- Intents namespace accepts only `intent:submit` with `{ type: string }`; invalid payloads →
  `WB_INTENT_INVALID`, unexpected events → `WB_INTENT_CHANNEL_INVALID`, handler failures →
  `WB_INTENT_HANDLER_ERROR`.
- Contract coverage: `packages/facade/tests/integration/transport/telemetryReadonly.integration.test.ts`
  and `packages/facade/tests/integration/transport/intentRouting.integration.test.ts`.

```ts
// packages/facade/tests/integration/transport/telemetryReadonly.integration.test.ts
import { expect, it } from 'vitest';
import { SOCKET_ERROR_CODES } from '@wb/facade/transport/adapter';

it('rejects inbound messages on telemetry channel', async () => {
  const ack = await emitTelemetryInbound();
  expect(ack.ok).toBe(false);
  expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
});
```

---

## 12) Golden Master (SEC §15)

- **Fixtures:** `packages/engine/tests/fixtures/golden/30d/{daily.jsonl,summary.json}` and `packages/engine/tests/fixtures/golden/200d/{daily.jsonl,summary.json}`.
- **Run:** 30 in-game days (720 ticks) and 200 in-game days (4,800 ticks) with seed `WB_SEED=gm-001`, replayed via `runDeterministic({ days, seed })` and optionally `outDir` to persist artifacts.
- **Outputs:** Deterministic JSON artifacts mirrored under `./reporting/<days>d/` when `outDir` is provided; CI uploads these directories.
- **Assertion:**
  - `goldenMaster.30d.spec.ts` verifies fixture equality plus topology rules (growroom geometry, lighting coverage ≥ 1, ACH ≥ 1, storage-only harvest lots, breakroom-only breaks, janitorial cadence) and exercises artifact emission into `reporting/30d`.
  - `goldenMaster.200d.spec.ts` enforces 200-day soak determinism, harvest → storage → replant sequencing (next-day replants with new plant UUIDs), and artifact emission into `reporting/200d`.
  - Numeric tolerances: `EPS_REL = 1e-6`, `EPS_ABS = 1e-9`.

Run selectively via `pnpm --filter @wb/engine test:conf:30d` (PR gate) and `pnpm --filter @wb/engine test:conf:200d` (nightly/on-demand).

---

## 13) Performance Budget

- **Tick throughput (headless)**: ≥ 5k ticks/min on dev laptop baseline with demo world.
- **GC budget**: no steadily growing retained sets after 10k ticks.
- Perf tests run in CI on minimal world and assert upper bounds for time/memory.

---

## 14) CI Pipeline

- **Jobs:** lint → unit → module → integration → conformance (golden).
- **Artifacts:** `daily.jsonl`, `summary.json`, coverage reports.
- **Failure policy:** conformance failures block merge unless ADR approves contract change and golden is updated in the same PR.

---

## 15) Mocks & Fakes

- Prefer **fakes** over mocks for RNG, time, and transports.
- **No clock mocking** inside engine: tick time is simulated, not wall‑clock.
- Transport tests use an in‑memory adapter; never open real sockets in unit/module tests.

---

## 16) Developer UX

- `pnpm test:unit`, `test:module`, `test:integration`, `test:conf` scripts; `test:watch` for fast feedback.
- VS Code task maps for common runs; problem matchers surface SEC section in failure message.

Note (UI components): While TDD remains UI-agnostic, downstream UI snapshot/visual tests will assume Tailwind styling with shadcn/ui components (Radix primitives) as per ADR-0016.

---

## 17) Update Procedure (when SEC changes)

1. Update `simConstants.ts` and related schemas.
2. Update failing tests **first** to reflect new contract.
3. Implement minimal changes to pass.
4. Update **Golden Master**: re‑record only after ADR approval.
5. Update docs: AGENTS.md, CHANGELOG, and SEC references in test descriptions.

---

## 18) Acceptance Checklist for PRs

- ✅ Imports constants from `simConstants.ts`.
- ✅ Uses per‑hour units; derives per‑tick by hours.
- ✅ Validates light schedule per §8 with 0.25h grid.
- ✅ Enforces device placement & room purpose.
- ✅ Applies tariff policy (price_electricity/price_water; override > factor).
- ✅ Ensures power→heat coupling where relevant.
- ✅ Provides/updates golden fixtures & conformance spec.
- ✅ Coverage thresholds met; no `Math.random` in logic.
- ✅ Telemetry channel is read‑only; transport separation proven by tests.

---

**End of TDD (SEC‑aligned).**

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
- Test-only determinism scaffolds (`hashCanonicalJson`, `newV7`) live under `packages/engine/src/shared/determinism` until an ADR approves runtime adoption (see [docs/tasks/0007-determinism-helper-scaffolds.md](docs/tasks/0007-determinism-helper-scaffolds.md)).
- Tooling CLI (`pnpm report:packages`) produces a deterministic package audit matrix stored in `docs/reports/PACKAGE_AUDIT.md` without introducing runtime imports.
- Strict conformance to **per‑hour** economic units; tick derives from hours.
- Clean separation of **engine** (no I/O) and **façade/transport**.
- Enforce **roomPurpose**, **device placement**, and **zone cultivationMethod** rules.
- Realistic device capacity and **power→heat** coupling.

**Non‑Goals**

- No dynamic energy/water market modelling (tariffs fixed at sim start unless a scenario explicitly overrides policy).
- No 3D geometry or CFD; we use lumped‑parameter environment models.
- Psychrometric helpers (`computeSaturationVapourPressure_kPa`, `computeDewPoint_C`, `computeVpd_kPa`) live under
  `packages/engine/src/backend/src/physiology/vpd.ts` using the Magnus formulation (A=17.27, B=237.3, base 0.6108 kPa) with
  humidity clamps `(1e-6, 1-1e-6)` to avoid singularities. Shared consumers import the same helpers; no runtime dependency on
  `psychrolib` remains.

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
- **Default zone height:** assume **3 m** when room/zone omit explicit values (ADR-0020); room overrides propagate.
- **Plant** belongs to a zone; physiology depends on schedule & environment.
- **Device** attaches by `placementScope: 'zone'|'room'|'structure'` with `allowedRoomPurposes` eligible set.

Implementation note: Engine code codifies the hierarchy in
`packages/engine/src/backend/src/domain/world.ts`. The validation module pairs
`validateCompanyWorld` with a dedicated `validateRoom` helper so structure-level
and room-level guardrails remain focused while still enforcing SEC contracts
(room purposes, cultivation methods, photoperiod schedule, device placement,
geometry bounds) before the tick pipeline consumes a scenario payload.

> ✅ **Live data — Structure/Room/Zone read models (Tasks 1110, 1120, 1130, 4100):**
> `companyTree` now emits structure nodes with location, capacity, coverage, and
> tariff joins; room nodes with purpose, climate aggregates, ACH diagnostics, and
> telemetry samples; and zone nodes with hydrated cultivation/lighting/irrigation
> blueprints, device coverage warnings, climate telemetry, and outstanding task
> queues so UI selectors replace fixtures. SEC §0.3 entry 0110-RM is closed.

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

- **Canonical irrigation methods (ADR-0017):** `manual-watering-can`, `drip-inline-fertigation-basic`, `top-feed-pump-timer`, and `ebb-flow-table-small` must stay present in `/data/blueprints/irrigation/` and supported by cultivation defaults.
- **Launch cultivation presets (ADR-0020):** `basic-soil-pot` (pot-10l + soil-single-cycle), `sea-of-green` (pot-11l + coco-coir), and `screen-of-green` (pot-25l + soil-multi-cycle) ship as the default bundles surfaced in UX and fixtures; hydroponic presets require a future ADR.

**Runtime enforcement:** The engine monitors harvest cycles per zone and enqueues
repotting, substrate sterilisation, and disposal tasks based on the active
cultivation method's container service life and substrate reuse policy. These
tasks land in the workforce queue with deterministic identifiers so labour
costing and scheduling remain aligned with SEC §7.5 and §10.

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

- **Reporting cadence (ADR-0019):** Engine persists hourly (per tick) ledger rows; façade/read-models expose those hourly slices plus deterministic daily rollups computed as 24-hour sums. Other cadences require a new ADR.
- Read-model `structureTariffs` (`packages/engine/src/backend/src/readmodels/economy/structureTariffs.ts`) merges the baseline tariff map with optional per-structure overrides, clamps override fields to non-negative values, and keeps the company-wide rollup anchored to the baseline so reporting remains comparable across structures.

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
    stage consumes the snapshot. `packages/engine/tests/integration/pipeline/economyAccrual.integration.test.ts` audits the
    economy stage to ensure hourly slices summed with banker’s rounding exactly match the finalized daily payroll rollups.
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
  - `workforceView` now surfaces roster rows with schedule descriptors, deterministic assignment summaries, and warning envelopes that always reference the affected structure/employee when determinable. Economy joins expose the per-hour balance/delta, cost breakdowns (`labourCost_per_h`, `maintenanceCost_per_h`, `utilitiesCost_per_h`), resource usage (`energy_kwh_per_h`, `water_m3_per_h`), and the resolved tariff map so dashboard cards read live data instead of fixtures.

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

- **Plant Physiology (ADR-0018):** evaluates temperature, VPD/humidity, and PPFD deltas via the piecewise quadratic tolerance ramp, multiplying per-dimension growth multipliers and taking the max stress contribution.
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
 - **Pattern F — Gas Enrichment (CO₂ Injector):**
  - Device implements `ICo2Injector` to enrich the zone bucket after sensors sample.
  - Example: Deterministic injector clamps to target/safety limits.
  - Test: `co2Coupling.integration.test.ts`

**Stub Conventions (Design Decision):**

- All stubs are **pure functions** (no side effects)
- **Deterministic:** Same input set ⇒ same output set (with fixed seed)
- **SI-Units:** W, Wh, m², m³/h, mg/h, µmol·m⁻²·s⁻¹ (PPFD), K, %
- **Clamps/Caps:** Respect blueprint parameters (`capacity`, `max_*`)
- **Telemetry:** Each stub returns primary outputs + auxiliary values (e.g., `energy_Wh`)
- **Coverage:** Library includes `Co2InjectorStub` alongside thermal, humidity, airflow, filtration, lighting, sensor, irrigation, and substrate stubs.

**Reference:** `/docs/proposals/20251002-interface_stubs.md` (consolidated specification)

---

## 9) Engine vs Façade vs Transport (SEC §11)

- **Engine:** pure, deterministic, no network/time syscalls; advances tick and returns state + events.
- **Façade:** validates intents, resolves tariffs, computes read‑models, orchestrates tick, exposes telemetry (read‑only) over adapter.
  - Read-model HTTP surface (`packages/facade/src/server/http.ts`) wraps Fastify routes for `/api/companyTree`, `/api/structureTariffs`, and `/api/workforceView`, validating every payload with the shared Zod schemas before replying and logging schema mismatches as 500s.
- **Transport Adapter:** Socket.IO default; SSE supported; **never accept inbound writes on telemetry**.

> **Pending live data — Sim-control intents & status (Tasks 0130, 3100, 3110, 3130, 4140):** Façade documentation still needs to spell out playback command payloads and acknowledgements. Phase 4 UI relies on a sim-control snapshot `{ simTime, tick, isPaused, speedMultiplier, pendingIntentCount }` and intents `engine.intent.sim.play|pause|step|set-speed.v1` plus environment adjustors (`engine.intent.zone.set-light-schedule.v1`, `engine.intent.zone.set-environment-setpoint.v1`) returning `{ intentId, correlationId, queuedTick, appliedTick, stateAfter }`. Aligning these payloads lets the Sim Control Bar reconcile acknowledgements with telemetry ticks without fixtures.

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

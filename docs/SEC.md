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

- **Node.js (v23+, ESM)** — Backend and façade **SHALL** use modern ECMAScript modules.
    
- **TypeScript** — The codebase **SHOULD** use TypeScript for type safety and clearer contracts.
    
- **Monorepo with pnpm workspaces** — The repository **SHALL** be a pnpm monorepo (engine, façade, UI, tools).
    
- **React + Vite** — The UI **SHALL** be a React app built with Vite; the UI remains **dumb** (read models in, intents out).
    
- **Tailwind CSS** — The UI **SHOULD** use Tailwind for styling.
    
- **Terminal Monitor (neo-blessed)** — A read-only terminal monitor **SHOULD** provide live telemetry dashboards; it **MUST NOT** send commands over telemetry.
    
- **Transport Adapter** — A transport abstraction **SHALL** exist. **Socket.IO SHOULD** be the default transport initially. Alternative transports (e.g., SSE) **MAY** be swapped under the same contract.
    

---

## 0.2 Reference Test Simulation (Golden Master)

**Intent:** Define a single, canonical test simulation as a **JSON savegame** that the engine **SHALL** reproduce deterministically across platforms and releases.

### 0.2.1 What it is (SHALL)

- A **self-contained JSON** describing a minimal but complete world state (metadata, world tree, schedules, inventory, workforce) at **sim time T0**.
    
- Contains **no derived fields** (only inputs). The engine computes outputs from it.
    
- Carries `schemaVersion`, `seed`, `simTime` and a **content hash** over canonical ordering.
    

### 0.2.2 Scope & Contents (SHOULD)

- **Metadata:** `schemaVersion`, `seed`, `simTime`, `notes`.
    
- **World:** company → structures → rooms → zones → plants (ids, sizes, starting states).
    
- **Schedules:** per-zone light cycle (e.g., 18/6 or 12/12), irrigation method reference, any planned switches.
    
- **Workforce:** a minimal personnel directory; an empty or sample task queue.
    
- **Inventory:** water meter reading (baseline), nutrient stock items with amounts.
    

### 0.2.3 Conformance Checks (SHALL)

- Running **N days** from T0 yields **identical daily state hashes** (and identical event counts per topic) on supported platforms.
    
- Engine publishes a **reference summary** (energy/water/nutrient totals, biomass/harvest KPIs). Values **SHALL** match within strict tolerances (exact where deterministic, fixed rounding elsewhere).
    

### 0.2.4 Evolution (MAY)

- Minor, backward-compatible schema changes **MAY** bump `schemaVersion` with a migration note. The canonical JSON is updated together with new expected hashes.
    
- A new Golden Master **MAY** be introduced for major releases; previous masters remain for regression.
    

> This section sets intention and acceptance; exact field names and file paths are not mandated here.

---

## 1. Core Invariants (Guardrails)

These rules **always hold**. Violations are bugs.

1. **Determinism:** Given the same seed and inputs, outputs are identical. All stochasticity flows through a single RNG interface (createRng(seed, stream)). No direct Math.random.
    
2. **Blueprints are templates, not instances:** All runtime instances are created as **copies** of blueprints. Blueprints live under /data/** and are never mutated at runtime.
    
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
    

> **Project standard:** **1 tick = 1 hour in-game (SHALL)**, backend-configurable for advanced scenarios. Game speed only scales wall-clock processing, **not** in-game duration per tick.

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

- **Company**: top-level owner of all structures (metadata, workforce, policies).
    
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

### 2.3 Entity Lifecycle — Clone / Rename / Delete / Move (Normative)

**Lifecycle rules (SHALL):**

- Clone: Creates a new entity with a new UUID and deep-copied configuration; references are rewired deterministically. Cloning MUST NOT duplicate derived state.

- Rename: Changes human-readable labels only; IDs remain stable; rename events are audit-only and do not affect hashes.

- Delete: Disallowed when it would violate invariants (e.g., deleting a growroom with zones). Deletion occurs through intents at tick boundaries and is reversible only via scenario/restore, not in-run undo.

- Move: Devices may move within the same structure only and must pass placement validation (allowedRoomPurposes, placementScope). Zones cannot be moved outside growrooms. Plants may be reassigned within the same zone family when a method explicitly permits (e.g., re-pot tasks).

- Auditability: All lifecycle changes emit post-commit telemetry and are reflected in read-models with prior↔next references.

---

## 3. Data Contracts (from DD + /data/**)

Validation occurs at load time; on failure, the engine must not start. Validation schemas live with the engine domain types so the engine remains the single source of truth; see [ADR-0005](ADR/ADR-0005-validation-schema-centralization.md) for implementation details.

### 3.0.1 Blueprint Taxonomy (STRICT)

- Every blueprint under `/data/blueprints/**` **MUST** publish a `class` field with a
  domain-level value plus a kebab-case `slug` that remains unique per class. Valid
  domains are:
  - `strain`, `structure`, `cultivation-method`, `substrate`, `container`, `irrigation`,
    `disease`, `pest`
  - `device.climate`, `device.airflow`, `device.lighting`, `device.filtration`
  - `room.purpose.<slug>` for room purposes (slug preserved in the class)
  - `personnel.role.<slug>` / `personnel.skill.<slug>` when workforce blueprints are in
    play
- Directory layout is **two levels maximum**: `data/blueprints/<domain>/<file>.json`.
  Devices use `data/blueprints/device/<category>/<file>.json`; room purposes use
  `data/blueprints/room/purpose/<file>.json`. Nested folders beyond this structure are
  forbidden.
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
- Legacy `kind`/`type` identifiers are **removed**; integrations **MUST** read the
  `class` discriminator and the explicit subtype fields noted above.

### 3.1 Device Placement & Eligibility (STRICT)

**Policy (SHALL):**

* Device blueprints declare **`placementScope ∈ { 'zone' | 'room' | 'structure' }`** and an **`allowedRoomPurposes`** whitelist.
* At **install/move** time, placement is validated against the current room purpose + scope. Zone-scoped devices are valid **only** in growrooms. Violations fail fast.
* Capacity metadata (`coverage_m2`, `airflow_m3_per_h`, `max_*`) is part of the blueprint contract and used for effectiveness scaling and diagnostics.

### 3.2 Room–Device Policy Matrix (Orientation)

**Orientation (SHOULD):**

* Provide a reference matrix mapping **roomPurpose → eligible device classes** (e.g., growroom: lighting, climate, airflow; storageroom: none affecting biology; laboratory: lab-only devices).
* The matrix is **informative**; enforcement derives from blueprint `allowedRoomPurposes` and scope rules.

### 3.3 Task & Treatment Catalogs (Data-Driven)

**Catalogs (SHALL):**

* Task definitions live under `/data/configs/task_definitions.json` with deterministic **codes**, **requiredRoleSlug**, **requiredSkills** (`{ skillKey, minSkill01 }`), **base durations**, and **cost hooks**.
* Treatments (e.g., pest control, substrate sterilization) are modelled as **tasks** with materials/equipment references.
* Schedulers consume catalog entries deterministically; façade validation rejects unknown codes or malformed thresholds.

### 3.4 Namespaces & Naming Conventions (STRICT)

* **Blueprint taxonomy:** JSON `class` values use domain identifiers (`strain`, `cultivation-method`, `device.climate`, `room.purpose.<slug>`, …). Slugs are **kebab-case**, unique **per class**.
* **Filesystem alignment:** Blueprint files reside under `/data/blueprints/<domain>/<file>.json` (or sanctioned subfolders) and **MUST** mirror the JSON `class`. Mismatches are loader errors.
* **Identifiers:** Entity IDs are UUIDs. Human-facing names are free text but **not** used for referential integrity.

### 3.5 Identity & UUID Policy (Traceability)

* **Entities:** UUID v4 for world entities (company/structure/room/zone/plant/device).
* **RNG seeds:** Where RNG streams require persisted seeds (e.g., workforce identities), **UUID v7** is used to brand deterministic seeds without leaking wall-clock into logic.
* **Stability:** IDs are immutable; renames do not affect IDs; move/clone produce new IDs where required and retain cross-references for audit.

### 3.6 Economy Units & Rates (STRICT)

- **Base Unit (SHALL):** All recurring monetary rates **per hour** (e.g., `cost_per_hour`, `maintenance_per_hour`, `lease_per_hour`).
    
- **No *_per_tick (SHALL NOT)**; engine derives tick costs via **in-game tick hours**.
    
- **Aggregation (SHOULD):** Reports integrate to day/week/month.
    
- **Consistency (SHALL):** Resource prices use unit pricing (e.g., `price_electricity` per kWh, `price_water` per m³, `price_per_kg`).
- **Neutral terminology (SHALL):** Monetary fields **MUST NOT** embed currency symbols or codes (e.g., `*_EUR`, `*_USD`, `€`); values are interpreted as neutral costs that scenarios contextualize.
- **Price maps (SHALL):** `/data/prices/devicePrices.json` enumerates device **CapEx** (`capitalExpenditure`), **recurring maintenance curves** (`baseMaintenanceCostPerHour`, `costIncreasePer1000Hours`), and **scheduled service visit costs** (`maintenanceServiceCost`). `/data/prices/utilityPrices.json` is the canonical tariff source exposing **`price_electricity` per kWh** and **`price_water` per m³**. Nutrient inputs are costed via irrigation/substrate consumption — there is **no nutrient tariff entry** in the utility map.
    
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
    

---

## 4. Simulation Tick (Phase Order)

### 4.1 Tick Semantics (SHALL)

- **Fixed in-game quantum** (project standard: 1h).
    
- Game speed scales wall-clock only.
    
- Pause/Resume/Step affect processing, not in-game time.
    
- All physics/biology/economy use tick’s in-game duration.
    
- Golden-master hashes are invariant to game-speed.
    

### 4.2 Phase Order

1. **Device Effects** — compute device outputs (light, heat, airflow, CO₂, dehumidification) subject to capacity & efficiency.

2. **Sensor Sampling** — record zone state before environmental integration so co-housed actuators observe pre-actuation values.

3. **Environment Update** — integrate device outputs into zone state (well-mixed model baseline).

4. **Irrigation & Nutrients** — fulfill zone method (manual enqueues tasks; automated fulfills on schedule).

5. **Plant Physiology** — update age/phase, biomass, stress, disease risk using strain curves and environment.

6. **Harvest & Inventory** — create lots when criteria met; move yield to inventory.

7. **Economy & Cost Accrual** — aggregate consumption/costs; maintenance curves progress.

8. **Commit & Telemetry** — snapshot state and publish read-only events.
    

---

## 5. Determinism & RNG

- **RNG creation**: `createRng(seed, streamId)` returns a pure, reproducible generator.
    
- **Streams**: stable `streamId`s (e.g., `plant:<id>`, `device:<id>`, `economy:realestate:<structureId>`). No cross-coupling.
    
- **Hashing**: per-day canonical state hash.
    

---

## 6. Environment & Devices (Well-Mixed Baseline)

- **Light:** devices contribute to a zone-level PPFD profile capped by device coverage and efficiency.
    
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
        
    - **Irrigation compatibility:** determined indirectly through substrate options. Irrigation method blueprints **SHALL** declare the substrate slugs they support under `compatibility.substrates`; cultivation methods inherit compatibility from the irrigation methods that list their chosen substrate.
        
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

* **Risk accumulation:** Pests/diseases accumulate deterministic **risk scores** from environment and hygiene signals; no random outbreaks without RNG stream use.
* **Inspections & treatments:** Represented as tasks with deterministic effects and cooldowns; successful treatments reduce risk and may impose quarantine intervals.
* **Biosecurity hooks:** Room purposes and workflows may reduce cross-contamination via scheduled sanitation tasks. Telemetry surfaces warnings when risk exceeds thresholds.

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

* Company-scoped employees with deterministic identities and trait assignments. Employees are **assigned to exactly one structure** at a time; they perform tasks only within that structure.
* Deterministic hiring market with manual scans, candidate pools, and onboarding intents. Telemetry exposes KPIs, warnings, payroll snapshots, and hiring events.

**Outcomes (SHALL):**

* Reproducible scheduling, morale/fatigue updates, overtime accruals, and payroll calculations given the same seed and inputs.

**Responsibilities (SHOULD):**

* Façade provides intents for hiring, scheduling, raises/termination, and manual tasks.
* Engine enforces working-hour caps and deterministic cooldowns for raises; emits telemetry post-commit.

### 10.0 Employment Model (SHALL)

- Company-scoped employees; assigned to a single structure; tasks only within that structure.
    

### 10.1 Outcomes (SHALL)

- Deterministic directory/market; reproducible task selections.
    

### 10.2 Responsibilities (SHOULD)

- Façade intents for provisioning and manual work; telemetry for queues/assignments.
    

### 10.3 Boundaries (MAY/NOT)

- Detailed HR rules later; not required for core conformance.
    

### 10.4 Employee Identity & RNG Streams (SHALL)

#### 10.4.1 Gender Distribution Configuration (SHALL)

- **`worldSettings.pDiverse ∈ [0, 0.05]`**; default **0.02**; remainder split evenly between `m` and `f`.
    
- Deterministic via job-market RNG stream; values outside range invalid.
    

### 10.5 Work Hours & Overtime Policies

**Working-time contract (SHALL):**

* Base working hours per in-game day **5–16 h**;
* Overtime **≤ 5 h** per day, applied after base hours;
* Working days per week **1..7**; optional shift start hour **0..23**;
* Overtime billed at **1.25×**; daily payrolls close with **Banker’s rounding**.

### 10.6 Traits, Morale & Skills

**Deterministic effects (SHOULD):**

* Employees carry **traits** with strengths in **[0,1]** affecting task duration, error rate, fatigue/morale deltas, device wear, XP, and salary expectations. Conflicts are resolved deterministically.
* **Skills** live on the **[0,1]** scale; task definitions specify structured `requiredSkills`. Learning-by-doing **MAY** raise skills via deterministic increments.

### 10.7 Real-Estate Pricing & Lease Terms (SHALL)

**Deterministic pricing:**

* Structures classify into **A–F** classes with deterministic **variance `v ∈ [−0.5, 1.75]`** applied to baseline lease rates to produce site-specific lease expectations. Upfront lease payment rules are scenario-defined and deterministic.

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
    
- Telemetry channel is **receive-only** for clients; writes rejected at transport level.
    

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

- Water + **Electricity tariff:** ensure backend config exposes `price_electricity` for electricity in  kWh and `price_water` for water per m^3; difficulty layer provides `energyPriceFactor` and/or `energyPriceOverride`aswell as `waterPriceFactor` and/or `waterPriceOverride`.
    

---

## 14. Open Questions (to be resolved iteratively)

- Minimum viable set of irrigation methods for v1?
    
- Exact stress→growth reduction curves per strain (piecewise vs parametric)?
    
- Daily vs tick-level economic accrual granularity for reports?
    
- Standard zone height vs variable height support in baseline formulas?
    
- Cultivation method presets (SoG/ScRoG/DWC/etc.) and their default container/substrate bundles?
    

---

## 15. Acceptance Criteria for Engine Conformance

- Given seed **S** and identical `/data/**`, a 7-day run yields identical state hashes across platforms.
    
- All events are reproducible and stable (no wall-clock leakage, only sim time).
    
- Unit tests cover each phase with golden vectors; integration test covers a reference 30-day scenario.
    
- Numeric tolerances (§1.5) and canonical hashing are respected in all golden checks.
    

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

- _[TO BE FILLED iteratively]_ For each item in `/docs/task/**`, add a row.
    
- Contradictions are tracked in `docs/re-reboot/contradictions.md` with exact refs.
    

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
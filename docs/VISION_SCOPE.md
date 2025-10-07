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

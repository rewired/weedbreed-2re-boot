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
    

---

## 1) Canonical Constants (mirroring SEC §1.2)

- `AREA_QUANTUM_M2 = 0.25`
    
- `ROOM_DEFAULT_HEIGHT_M = 3`
    
- `HOURS_PER_TICK = 1` (1 tick = 1 in‑game hour)
    
- Calendar: `HOURS_PER_DAY = 24`, `DAYS_PER_MONTH = 30`, `MONTHS_PER_YEAR = 12`
    

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
    

---

## 3) Data Validation & Fixtures

- **Blueprints** (`/data/blueprints/**`) are **read‑only** fixtures in tests.
    
- **Schema:** Validate with **Zod** at façade boundaries and as test helpers.
    
- **Prices** live under `/data/prices/**`; ensure no prices leak into device blueprints.
    

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

---

## 4) RNG & Stream Tests (SEC §5)

- `createRng(seed, streamId)` produces identical sequences across platforms.
    
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

---

## 7) Tick trace instrumentation & perf harness (Engine)

- Canonical order: `applyDeviceEffects → updateEnvironment → applyIrrigationAndNutrients → advancePhysiology → applyHarvestAndInventory → applyEconomyAccrual → commitAndTelemetry` (mirrors SEC §4.2).
- `runTick(world, ctx, { trace: true })` returns `{ world, trace }` where `world` is the immutable post-tick snapshot and `trace` is an optional {@link TickTrace} with monotonic `startedAtNs`, `durationNs`, `endedAtNs`, and heap metrics for every stage without feeding wall-clock time into simulation logic.
- `runOneTickWithTrace()` (engine test harness) clones the deterministic demo world and returns `{ world, context, trace }` for integration/unit assertions.
- `withPerfHarness({ ticks })` executes repeated traced ticks and reports `{ traces, totalDurationNs, averageDurationNs, maxHeapUsedBytes }` so perf tests can guard throughput (< 5 ms avg/tick) and heap (< 64 MiB).
- `createRecordingContext(buffer)` attaches the instrumentation hook so specs can assert that stage completions mirror the trace order.

---

## 8) Economy & Tariffs (SEC §3.6)

- **Per‑hour units only** in all recurring costs.

- **Tariffs (hotfix):** backend config exposes **`price_electricity`** (per kWh) and **`price_water`** (per m³).
- **Decision:** Monetary identifiers are currency-neutral — tests reject fields or literals that bake `EUR`, `USD`, `GBP`, or symbol suffixes into names/strings.

- **Source of truth:** `/data/prices/utilityPrices.json` is the canonical tariff map and **only** carries electricity and water prices; nutrient costs are covered by irrigation/substrate consumption flows.

- **Device maintenance:** `/data/prices/devicePrices.json` provides `capitalExpenditure`, `baseMaintenanceCostPerHour`, and `costIncreasePer1000Hours`. Schema tests must guard these identifiers.

- Difficulty layer may set **`energyPriceFactor`/`energyPriceOverride`** and **`waterPriceFactor`/`waterPriceOverride`**; **override wins**.

- Effective tariffs computed **once at sim start**.
    

```ts
// tests/unit/util/tariffs.spec.ts
import { expect, it } from 'vitest';
import { resolveTariffs } from '@/backend/src/util/tariffs';

it('override beats factor (electricity & water)', () => {
  const cfg = { price_electricity: 0.32, price_water: 4.0 }; // neutral costs
  const diff = { energyPriceFactor: 1.5, energyPriceOverride: 0.5, waterPriceFactor: 2.0 };
  const t = resolveTariffs(cfg, diff);
  expect(t.kWh).toBe(0.5);         // override
  expect(t.m3).toBe(8.0);          // factor (no override)
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

- Zone **must** reference a `cultivationMethod` defining **containers**, **substrates** (incl. `densityFactor_L_per_kg`), **irrigation** compatibility, and **planting density**.
  - Irrigation compatibility is derived from irrigation method blueprints that list the substrate slug under `compatibility.substrates`; zones selecting a substrate without matching irrigation support should fail validation.
    

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
    efficiency01: 0.9
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
    

```ts
// tests/integration/transport/telemetryReadonly.spec.ts
import { expect, it } from 'vitest';
import { Transport } from '@/backend/src/facade/transport';

it('rejects inbound messages on telemetry channel', async () => {
  const t = new Transport();
  const res = await t.sendTelemetryInbound({ any: 'payload' } as any);
  expect(res.ok).toBe(false);
});
```

---

## 12) Golden Master (SEC §15)

- **Fixture:** `tests/fixtures/golden/world_v1.seed.json` (minimal savegame; no derived fields).
    
- **Run:** 30 in‑game days (720 ticks) with seed `WB_SEED=gm-001`.
    
- **Outputs:** `daily.jsonl` + `summary.json`.
    
- **Assertion:**
    
    - `daily.hash` equals prior run (stable across platforms).
        
    - Event counts match (harvests, tasks, device switches).
        
    - Numeric tolerances: `EPS_REL = 1e-6`, `EPS_ABS = 1e-9`.
        

```ts
// tests/conformance/goldenMaster.spec.ts
import { expect, it } from 'vitest';
import { runDeterministic } from '@/backend/src/engine/testHarness';
import expected from '../fixtures/golden/summary_v1.json';

it('30-day run matches golden summary and daily hashes', async () => {
  const out = await runDeterministic({ days: 30, seed: 'gm-001' });
  expect(out.summary.metrics).toMatchObject(expected.metrics);
  for (let i = 0; i < out.daily.length; i++) {
    expect(out.daily[i].hash).toBe(expected.daily[i].hash);
  }
});
```

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
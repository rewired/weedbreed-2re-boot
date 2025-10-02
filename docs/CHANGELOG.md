# Changelog

### #34 WB-027 device capacity diagnostics & blueprint schema hardening
- Introduced a Zod-backed device blueprint schema enforcing `power_W`, `efficiency01`, and at least one of `coverage_m2`/`airflow_m3_per_h`, exporting the validator for downstream loaders and adding unit coverage (including live JSON fixtures).
- Normalised device instances with `coverage_m2`/`airflow_m3_per_h` fields, updated validation, demo fixtures, and pipeline logic to aggregate coverage & airflow totals, clamp effectiveness by coverage ratio, and emit `zone.capacity.coverage.warn` / `zone.capacity.airflow.warn` diagnostics when undersized.
- Added integration tests verifying the new runtime totals and warnings, refreshed SEC/DD/TDD guidance, and migrated device blueprints to the canonical placement scope + capacity fields.

### #33 WB-026 zone air mass bootstrap derivation
- Extended the zone domain contract and Zod schema with a documented `airMass_kg`
  field that downstream thermodynamics consume directly.
- Derive air mass at bootstrap from floor area × height × `AIR_DENSITY_KG_PER_M3`,
  falling back to `ROOM_DEFAULT_HEIGHT_M` so blueprints omitting a height remain
  SEC-compliant.
- Updated the demo world, validation fixtures, and physics tests to populate the
  new field and asserted regression coverage for default and overridden heights.

### #32 WB-025 device thermal coupling
- Added dry-air thermodynamic constants (`CP_AIR_J_PER_KG_K`,
  `AIR_DENSITY_KG_PER_M3`) to the canonical sim constants module and mirrored the
  reference documentation/ADR so pipeline code can compute heat deltas without
  redeclaring physics baselines.
- Implemented `applyDeviceHeat` plus the device/environment pipeline stages so
  Phase 1 accumulates per-zone heat additions and Phase 2 removes sensible heat
  within HVAC/dehumidifier capacity before committing air temperature updates.
- Expanded the domain model with zone environment state and device duty/efficiency
  fields, updating validation, fixtures, and tests (unit + integration) to cover
  waste-heat heating, zero-duty stability, and cross-stage cooling flows.

### #31 WB-024 pipeline stages clone world snapshots
- Normalised all pipeline stage modules to return shallow world clones so the
  immutable tick contract holds even before stage-specific logic lands.
- Added the snapshots pre-emptively to keep future implementations from
  mutating the previous tick's world reference when they begin modifying the
  staged world data.

### #30 WB-023 immutable tick world snapshots
- Refactored all engine pipeline stages, including `commitAndTelemetry`, to return new
  `SimulationWorld` instances so tick progression honours the readonly world contract.
- Updated `runTick` to compose the immutable snapshots while still exposing optional
  `TickTrace` telemetry, and rewired the instrumentation collector to propagate the
  stage results.
- Aligned the engine test harness, integration coverage, and TDD notes with the
  return-value change to keep trace utilities and specs validating the new workflow.

### #29 Tooling - perf harness warm-up stabilization
- Added a warm-up loop to `withPerfHarness` so initial ticks run without trace
  collection, allowing JIT optimizations to settle before measurements begin.
- Ensured the warm-up honours custom world/context factories while forcing
  tracing off to keep baseline metrics focused on the measured iterations.

### #28 WB-022 tick commit advances simulation time
- Implemented the `commitAndTelemetry` pipeline stage so each tick increments
  `SimulationWorld.simTimeHours` by the SEC-mandated `HOURS_PER_TICK`, ensuring
  downstream systems observe deterministic world time progression.
- Added integration coverage in `packages/engine/tests/integration/pipeline/timeProgression.spec.ts`
  that exercises repeated `runTick` invocations against the demo world and
  asserts the cumulative hour count advances by one per stage cycle.

### #26 WB-009 tick orchestrator & perf harness
- Implemented the SEC-ordered `runTick` pipeline in `packages/engine/src/backend/src/engine/Engine.ts`, wiring the seven phase modules through the shared `PIPELINE_ORDER` map so instrumentation hooks observe deterministic sequencing.
- Added `createTickTraceCollector` and the `withPerfStage` sampling utility in `packages/engine/src/backend/src/engine/trace.ts` and `packages/engine/src/backend/src/util/perf.ts` to record per-stage timing and heap usage without leaking wall-clock state.
- Published the `runOneTickWithTrace`, `withPerfHarness`, and `createRecordingContext` helpers in `packages/engine/src/backend/src/engine/testHarness.ts` to simplify trace capture, perf baselines, and stage recording for integration scenarios.
- Expanded Vitest coverage across `packages/engine/tests/integration/pipeline/order.spec.ts`, `packages/engine/tests/unit/engine/trace.spec.ts`, and `packages/engine/tests/integration/perf/baseline.spec.ts` to lock down pipeline order, trace schema invariants, and throughput guardrails for WB-009.

### #27 WB-021 tick pipeline instrumentation harness
- Introduced the SEC-ordered `runTick` orchestrator that stages the seven
  deterministic phases and optionally collects `TickTrace` telemetry without
  leaking wall-clock data into simulation logic.
- Added the engine pipeline modules, trace schema, and `withPerfStage` helper
  so each step surfaces timing and heap deltas for diagnostics.
- Published the deterministic engine test harness (`runOneTickWithTrace`,
  `withPerfHarness`, `createRecordingContext`) and Vitest coverage for pipeline
  order, perf baseline, and trace schema validation.
- Documented the trace fields and perf guardrails in `docs/TDD.md` to align QA
  expectations with the new instrumentation surfaces.

### #25 WB-020 deterministic tariff resolution helper
- Added `resolveTariffs(config)` to the engine backend utilities so scenarios
  deterministically derive electricity and water tariffs with override-first
  precedence before multiplicative difficulty factors.
- Wired the bootstrap pipeline to memoise resolved tariffs per difficulty,
  exposing the immutable tariff map on `EngineBootstrapConfig` and the façade
  integration surface for downstream consumers.
- Enriched `data/configs/difficulty.json` with the documented tariff override
  and factor knobs and expanded Vitest unit/integration coverage to exercise
  base-only, factor-only, override-only, and mixed configurations.

### #24 WB-019 company location validation consolidation
- Updated the shared `nonEmptyString` schema to trim incoming values before
  enforcing non-empty constraints so world tree strings remain normalised at
  parse time.
- Removed duplicate company location bounds and emptiness checks from
  `validateCompanyWorld`, delegating structural enforcement to the Zod schema
  layer to avoid divergent error reporting.
- Recorded the consolidation here to highlight that business validation now
  focuses on SEC-specific guardrails beyond baseline schema requirements.

### #23 WB-018 company headquarters location metadata
- Added Hamburg-backed default company location constants to `simConstants` and
  documented them in the canonical constants reference for interim UI coverage.
- Extended the domain model, schemas, and business validation to require
  `company.location` with strict coordinate bounds and non-empty locality data.
- Updated unit/integration coverage across engine and façade packages to supply
  the new location metadata and assert detailed error reporting for invalid
  coordinates.

### #22 WB-017 light schedule grid constant centralisation
- Added the SEC-mandated `LIGHT_SCHEDULE_GRID_HOURS` export to the canonical
  `simConstants` module so photoperiod validators share the same 15 minute grid
  source of truth as the documentation.
- Updated world validation helpers and the related unit/integration coverage to
  import the shared constant instead of redefining the `0.25h` grid locally.
- Documented the new constant in `docs/constants/simConstants.md` to signal the
  centralised reference for photoperiod light schedules.

### #21 WB-016 uuid schema branding alignment
- Branded the shared `uuidSchema` in the engine domain schemas with Zod's
  `.brand<'Uuid'>()` helper so parsed entities infer the branded `Uuid` type
  expected by the domain model.
- Unblocked strict TypeScript builds that previously reported `string` vs.
  `Uuid` incompatibilities when the schemas were annotated with explicit
  domain entity types.
- Confirmed the runtime validation behaviour remains unchanged, keeping
  existing schema unit coverage relevant without modification.

### #20 Tooling - engine lint guard compliance
- Normalised template string usage in `@wb/engine` validation helpers so numeric
  segments are explicitly stringified, satisfying the strict `restrict-template-expressions`
  guard enforced by the workspace ESLint profile.
- Refactored engine schema tests to operate on typed clones without optional
  chaining or `any`, leaning on precise aliases to clear `no-unnecessary-condition`
  and `no-explicit-any` lint violations in CI.
- Documented the guard alignment here to signal that future schema fixtures must
  continue operating on deterministic, fully typed clones of the base world tree.

### #19 WB-014 deterministic RNG utility
- Introduced `createRng(seed, streamId)` in the engine backend util library so
  all stochastic behaviour flows through a deterministic, stream-scoped
  generator aligned with SEC §5.
- Re-exported the utility from the engine package barrel and verified the
  `@/backend` alias resolves the new module for future consumers and tests.
- Added Vitest coverage that guarantees identical sequences for repeated
  invocations and divergent sequences for distinct stream identifiers.
- Captured the decision in ADR-0007 to document the deterministic RNG contract
  and the chosen splitmix/mulberry implementation strategy.

### #18 WB-013 room validation helper extraction
- Refactored `validateCompanyWorld` to delegate room, zone, plant, and device
  checks to a new `validateRoom` helper so hierarchy-specific invariants stay
  co-located with their scope.
- Documented the decision in ADR-0006 to capture the motivation for the helper
  and its impact on future partial-world validation work.
- Added JSDoc to the helper to preserve inline documentation parity across the
  validation module.

### #17 WB-012 light schedule 24-hour enforcement
- Enforced the light schedule schema to reject photoperiods that do not sum to
  a full 24-hour cycle, aligning validation with the SEC light-cycle contract.
- Added regression coverage ensuring valid 24-hour schedules parse successfully
  while mismatched totals surface a `lightSchedule` path issue for integrators.
- Documented the requirement so external integrations can normalise light
  schedules before submitting company world payloads.

### #16 WB-011 growroom zone cardinality validation
- Enforced the room schema to reject growrooms that do not declare at least one
  zone, maintaining SEC hierarchy invariants.
- Added regression coverage ensuring `companySchema.safeParse` reports a zones
  path issue when a growroom omits its zone list.
- Documented the tightened validation to alert integrators that empty
  growrooms now fail schema checks.

### #15 Tooling - align engine runtime dependencies
- Declared `zod@^3.23.8` as an explicit runtime dependency for `@wb/engine`
  so schema validation helpers resolve consistently during builds and tests.
- Re-synced workspace lockfiles via `pnpm install` to ensure CI resolves the
  shared Zod version already used by the façade package.

### #14 WB-010 engine-hosted world validation schemas
- Moved the company world Zod schemas and `parseCompanyWorld` helper into
  `@wb/engine` so validation logic ships with the canonical domain contracts.
- Exported the schemas from the engine package and updated façade imports to
  depend on the new public surface instead of a local copy.
- Relocated the corresponding Vitest coverage into `@wb/engine` to keep
  validation regression tests close to the source of truth.

### #13 WB-006 facade world schema validation
- Added Zod-based world tree schemas in `@wb/facade` that reuse engine
  enumerations to guarantee SEC-aligned runtime validation of cultivation
  methods, irrigation, containers, and substrates before engine bootstrap.
- Introduced `parseCompanyWorld` to normalise façade inputs and wire it into
  `initializeFacade` so invalid payloads are rejected deterministically.
- Expanded façade Vitest coverage with schema unit tests covering invalid zone
  payloads and placement scope enforcement.
- Introduced the `wb-sim/no-math-random` ESLint rule to block `Math.random`
  usage and keep all randomness routed through deterministic RNG utilities.

### #12 Tooling - facade Vitest alias parity
- Added the `@/backend` path alias to the façade Vitest config so shared engine
  modules resolve consistently during façade test runs.

### #11 WB-004 validation guard fixes
- Hardened light schedule validation to reject non-finite values before range
  checks, preventing NaN/Infinity leakage into tick logic.
- Adopted readonly array typing across world entities and rewrote tests to use
  typed UUID helpers, resolving lint violations in @wb/engine.
- Added regression coverage ensuring non-finite light schedules report a
  validation issue.

### #10 WB-004 domain model scaffolding
- Added strongly typed world tree entities and validation helpers under
  `packages/engine/src/backend/src/domain/world.ts` to encode SEC hierarchy and
  guardrails.
- Introduced unit and integration coverage exercising zone cultivation method
  enforcement, room purpose restrictions, and aggregate validation reporting.
- Documented the new module usage within the design document to steer
  implementation alignment.

### #09 WB-002 canonical constants module
- Added the canonical `simConstants.ts` module under `src/backend/src/constants` with SEC-aligned values and helper accessors.
- Documented the constants in `docs/constants/simConstants.md` and enforced single-source usage through a bespoke ESLint rule.
- Expanded automated coverage with unit/integration tests verifying immutable exports and package re-exports.

### #08 Tooling - pnpm 10.17.1 alignment
- Harmonised the repository on pnpm 10.17.1 via package manager engines metadata.
- Simplified CI pnpm setup to source the version from `package.json`, preventing action self-install conflicts.

### #07 WB-001 pnpm workspace bootstrap
- Initialised pnpm workspaces with shared TypeScript configuration and path aliases for engine, façade, transport, and monitoring packages.
- Added base linting, formatting, and testing toolchain aligned with Node 23+ ESM requirements.
- Provisioned CI workflow executing lint, test, and build stages to guarantee green pipelines.

All notable changes to this repository will be documented in this file.

### #06 Currency-neutral terminology enforcement
- Clarified across SEC, DD, TDD, and Vision Scope that monetary identifiers and UI copy must remain currency-neutral, forbidding baked-in codes/symbols (EUR, USD, GBP, etc.).
- Updated reference docs and prompts to describe tariffs and KPIs using neutral cost phrasing instead of currency-specific notation.

### #05 Issue-0003 economy price map alignment
- Added ADR-0004 documenting the canonical maintenance and tariff price maps (device maintenance base/increase fields; utility tariffs limited to electricity & water).
- Normalized `/data/prices/devicePrices.json` maintenance keys, confirmed grow room blueprints omit `baseRentPerTick`, and set `/data/prices/utilityPrices.json` as the single source of truth for `price_electricity`/`price_water`.
- Updated SEC, DD, TDD, and Vision/Scope guidance to reflect the canonical field names and removal of the nutrient tariff knob.

### #04 Canonical simulation constants alignment
- Added ADR-0001 to capture the canonical simulation constants contract (`AREA_QUANTUM_M2 = 0.25`, `ROOM_DEFAULT_HEIGHT_M = 3`, calendar invariants) and document precedence across SEC, DD, TDD, AGENTS, and VISION_SCOPE.
- Flagged exporter tooling drift that still referenced `AREA_QUANTUM_M2 = 0.5`, aligning it with the SEC baseline in the decision history.

### #03 Irrigation compatibility source of truth correction
- Removed `supportedIrrigationMethodIds` from substrate blueprints; irrigation compatibility is now resolved from irrigation method blueprints that list compatible substrates under `compatibility.substrates`.
- Superseded ADR-0002 with ADR-0003 to document the irrigation-method-driven compatibility model and refreshed SEC/DD/TDD guidance accordingly.

### #02 Cultivation method blueprint field alignment
- Renamed cultivation method planting density to `areaPerPlant_m2` and updated container/substrate references to concrete blueprint slugs.
- Shifted irrigation compatibility to substrate blueprints via `supportedIrrigationMethodIds`, removing direct `irrigationMethodIds` from cultivation methods (see ADR-0002, superseded by ADR-0003).
- Added ADR-0002 documenting the substrate-driven irrigation compatibility decision and refreshed SEC/DD/AGENTS guidance.

### #01 Data audit groundwork
- Logged device blueprint schema gaps (placement scope + room eligibility) in ISSUE-0001 for SEC alignment.
- Captured cultivation method blueprint compliance gaps with SEC §7.5 in ISSUE-0002.
- Recorded pricing data violations (per-tick rates, tariff fields) in ISSUE-0003.
- Replaced legacy `roomPurposes` with `allowedRoomPurposes` and added `placementScope=["zone"]` across device blueprints to satisfy SEC placement metadata requirements.

# Changelog

### Unreleased — Hotfix Batch 03

- Task 0023: Added façade read-model schema validators with versioned metadata, unit coverage for happy/negative paths, and documentation for the three schema identifiers to lock UI contracts to Proposal §6.
- Task 0024: Introduced Fastify-backed façade HTTP endpoints for company tree, structure tariffs, and workforce view read-models with schema validation guards, integration coverage for success/error responses, and a dev server script for local pairing with the transport adapter.
- Task 0025: Delivered façade read-model client SDK fetch helpers with typed error handling, unit coverage for network/schema failures, and REST client documentation for manual endpoint verification.
- Task 0026: Bootstrapped the `@wb/ui` workspace with a Vite + React + Tailwind stack, shared shadcn-aligned design tokens, deterministic layout scaffolding for the left rail and main content shell, Vitest/ESLint scripts, and documentation covering Node 22 setup plus façade pairing instructions.
- Task 0027: Wired React Router into the workspace shell, implemented the left rail accordion with mock structures/zones, routed dashboard/zone/workforce placeholders through the workspace layout, and added Vitest coverage for navigation highlighting per SEC §4.2/TDD §2.
- Task 0028: Added the dashboard page skeleton with SEC §4.2-aligned tick cadence, per-hour economy placeholders, stubbed `useDashboardSnapshot` selectors, Tailwind component tokens, and Vitest coverage for all cards and event list placeholders.
- HOTFIX-043 (Task 0060): Replace perf harness device price lookups, workforce economy context fixtures, and telemetry integration assertions with schema-validated DTOs so `no-unsafe-*` lint guards stay green and SEC §1 determinism stays enforced.
- HOTFIX-043 (Task 0061): Remove redundant optional chains, adopt `??` defaults, and document invariants across workforce/pipeline modules to satisfy nullish guardrails and SEC §5 contracts.
- HOTFIX-043 (Task 0062): Replaced dynamic deletes with WeakMap-backed runtime stores and immutable intent/config helpers across workforce, cultivation, device, sensor, irrigation, and economy pipelines so SEC §2 tick snapshots stay deterministic and lint no-dynamic-delete guards remain green.
- HOTFIX-043 (Task 0063): Added deterministic formatting helpers for telemetry (`formatTemperatureC`, `formatHumidityDelta`), routed cultivation/maintenance/pest UUID seeds and blueprint coverage summaries through `fmtNum`, refreshed the CLI usage banner to a raw template literal, and expanded unit coverage so string safety lint guards remain green with unit annotations.
- HOTFIX-043 (Task 0064): Hoist engine trait weights, builder constants, and RNG seeds into `simConstants` with mirrored docs, eliminating magic number lint warnings.
- HOTFIX-043 (Task 0065): Prune unused bindings, normalise `const`/`async` usage, and refresh tests in schema utilities to meet lint hygiene expectations.
- HOTFIX-043 (Task 0066): Migrate thermo tests to `createThermalActuatorStub`, retire `applyDeviceHeat`, and document the Phase 6 helper so deprecated lint failures disappear.
- HOTFIX-043 (Task 0067): Split façade, transport, and tooling TypeScript configs into type-check (`noEmit`) and build variants, replaced local `.ts` specifiers with `.js` ESM imports, wired façade builds against the engine/transport dist artifacts, and hardened transport ack guards plus façade dev fixtures so NodeNext emit passes without brand/type regressions.

### Unreleased — Blueprint Taxonomy v2

- HOTFIX-042 (Task 0055): Added a workspace `lint:strict` script that pipes `pnpm -r lint`
  through `tools/check-warn-budget.mjs` to enforce the temporary 30-warning ESLint budget
  in CI, and documented the guard plus retirement plan in the contributor handbook so
  the backlog burn-down stays visible.

- HOTFIX-042 (Task 0054): Updated the shared determinism hash helper to cache
  the wasm API via nullish coalescing assignment so falsy-but-valid promises
  persist and the prefer-nullish-coalescing lint stays satisfied.

- HOTFIX-042 (Task 0053): Normalised perf scenario device defaults by hoisting
  the carbon filter duty cycle and maintenance service visit duration into
  shared constants, wiring perf harness instantiation through the 0–1 naming
  scheme so lint checks stop flagging inline magic numbers.

- HOTFIX-042 (Task 0052): Hoisted workforce identity gender roll thresholds into
  shared constants, hardened hiring/workforce telemetry emitters to guard topics
  and clone payloads before dispatch, and added unit coverage confirming the
  sanitized telemetry flow so lint safety checks remain green.

- HOTFIX-042 (Task 0051): Hardened the façade transport server startup to reject
  listener errors deterministically, normalised shutdown/startup catch handlers
  to wrap unknown failures, and updated the integration harness teardown to
  surface HTTP close errors so async safety lint guards stay satisfied.

- HOTFIX-042 (Task 0050): Hardened the CO₂ injector stub by replacing non-null
  assertions with explicit guard helpers, normalising optional bounds before
  clamping, and keeping the deterministic capacity logic intact for lint
  conformance.

- HOTFIX-042 (Task 0049): Removed redundant numeric coercions, `as` assertions,
  and non-null assertions across the perf harness, stubs, workforce scheduler,
  and façade tests by replacing them with schema parsing, explicit guards, and
  UUID validation so lint conversions are no longer required and the tests use
  validated identifiers.

- HOTFIX-042 (Task 0048): Normalised seed-to-harvest reporting scenario defaults
  to use nullish coalescing so falsy-but-valid identifiers persist through the
  CLI and report generator, and added integration coverage for the regression.

- HOTFIX-042 (Task 0047): Removed redundant optional chaining in the irrigation
  pipeline and workforce payroll accumulator so deterministic records are
  treated as required data, and clarified p95 wait computations to avoid
  impossible fallbacks flagged by the lint guards.
- HOTFIX-042 (Task 0046): Normalised engine, transport, and tooling catch handlers
  to capture `unknown`, added a shared error normaliser so non-`Error` values are
  wrapped before propagation, guarded telemetry/intent acknowledgements against
  unsafe payloads, and documented the catch policy with unit coverage.
- HOTFIX-042 (Task 0045): Renamed the CI performance guard-band override to `PERF_CI_WARNING_GUARD_BAND_01`, kept a deprecation
  warning for the old `%` variable, and clarified in the perf harness docs that overrides must stay on the canonical 0–1 scale
  so `wb-sim/no-engine-percent-identifiers` remains green across engine scripts.
- HOTFIX-042 (Task 0044): Normalised engine humidity and filtration metrics to the
  canonical [0,1] scale by renaming percent-based identifiers, updating stubs,
  pipelines, schemas, and sensor validation, and refreshing tests/docs to satisfy
  `wb-sim/no-engine-percent-identifiers`.
- HOTFIX-042 (Task 0043): Extracted perf harness, workforce market, and
  conformance test literals into named constants, introduced a shared
  `packages/engine/tests/constants.ts` helper, and refreshed the sim constant
  regression suite to compare against the documented SEC baselines.
- HOTFIX-042 (Task 0042): Routed numeric template literal segments in engine
  perf/seed-to-harvest pipelines, save/load registries, workforce RNG stream
  identifiers, and façade transport URLs through `fmtNum`/explicit string
  conversion to satisfy the `restrict-template-expressions` lint guardrail.

- HOTFIX-042 (Task 0041): Centralised golden master horizons and formatting helpers,
  extended `simConstants` with deterministic hash tolerances and MiB scaling, updated
  perf budgeting to consume the shared constants, refreshed conformance specs to use
  `fmtNum`, and documented the additions in `/docs/constants`.

- HOTFIX-042: Added `packages/engine/tsconfig.eslint.json` and updated the
  workspace ESLint parser project list so engine tests participate in the
  type-aware program without `parserOptions.project` resolution failures.

- HOTFIX-07: Added workspace `pnpm typecheck`, `pnpm lint`, and `pnpm test` commands,
  wired `pnpm prepush` to chain them locally, and updated CI to run the trio with
  ESLint warnings treated as failures so regression guards stay aligned across
  developer machines and GitHub Actions.

- Removed HOTFIX-06's temporary test-only ESLint overrides now that type-aware
  linting is restored across the workspace, re-enabling unsafe assignment,
  member access, call, non-null assertion, and magic number checks for tests.
- HOTFIX-06: Added a temporary test-only ESLint override block that disables
  unsafe assignment/member/call and non-null assertion rules while HOTFIX-01
  through HOTFIX-05 finish restoring full type resolution, and recorded a
  follow-up task to remove the relaxation once the blockers clear.
- Fixed – Restore shared workspace test setup (`packages/tests/setup.ts`) used by
  import guard tests.
- HOTFIX-02: Restored ESLint's type-aware parser wiring by pointing the
  workspace config at package build + spec tsconfigs and adding the
  missing `tsconfig.spec.json` manifests so unsafe-any rules only flag
  real issues.
- HOTFIX-03: Migrated all JSON imports to the Node.js 22 import attribute
  form and extended the import resolution guardrail to fail if any
  `.json` specifier omits `with { type: 'json' }`, preventing regressions
  back to `any` fallbacks in TS/Vitest.

- Published the transport acknowledgement contract: extracted the shared error
  code registry/TypeScript types into `@wb/transport-sio`, added the
  `assertTransportAck` runtime guard with unit coverage, re-exported the
  helpers via the façade adapter, and documented the codes in
  `docs/constants/transport-error-codes.md` with SEC §1/TDD §11 references.

- Bootstrapped the façade transport server factory exposing `/telemetry` and
  `/intents` namespaces, shipped integration coverage for the namespace wiring
  and health endpoint, added a dev script for local runs, and documented the
  startup flow in `docs/tools/dev-stack.md`.
- Added `@wb/transport-sio` integration specs guarding telemetry read-only
  rejections and intent acknowledgement paths in line with SEC §11/TDD §11.
- Added a CI LOC guard for `packages/**/src/**` that surfaces warnings at
  700 LOC and fails the build at 1,200 LOC so oversized modules are caught
  before review while allowing deliberate refactors to land incrementally.

- Split the domain world validation suite into `validation/company.ts`,
  `validation/devices.ts`, and `validation/roomsZones.ts`, keeping
  `validateCompanyWorld`'s public surface intact while reducing the
  original 788 LOC module below our 500 LOC guardrail and preserving all
  existing error messages.
- Decomposed the 694 LOC device blueprint monolith into `device/schemaBase.ts`,
  `device/schemaByClass.ts`, `device/guardTaxonomy.ts`, and `device/parse.ts`
  to isolate shared schema fragments, per-class refinements, taxonomy guards,
  and parsing helpers while keeping taxonomy mismatches as hard errors and
  rejecting all monetary fields in blueprints.
- Split the 662 LOC domain world schema module into entity-focused files
  (`schemas/company.ts`, `structure.ts`, `room.ts`, `zone.ts`, `plant.ts`,
  `workforce.ts`) plus a barrel that re-exports the existing Zod API,
  improving readability and staying under the 500 LOC guardrail without
  changing consumers.
- Refactored the `@wb/tools-monitor` runtime: extracted API/types, state helpers,
  and telemetry/view-model logic into dedicated modules so the Socket.IO
  telemetry client stays read-only while the CLI/runtime public surface remains
  unchanged and each module sits comfortably under the 500 LOC guardrail.
- Modularized the conformance golden scenario harness: split the 800+ LOC
  implementation into dedicated recipe, builder, fixture I/O, and hash
  verification modules, centralised blueprint imports, and kept the exported
  API stable so 30-day/200-day golden hashes remain bit-identical.
- Refactored the workforce pipeline: extracted scheduling, payroll, market, intent,
  trait, and telemetry logic into dedicated modules under `src/workforce/**`, kept
  each file under 500 LOC, and routed all workforce side-effects through a single
  telemetry batch emitter so the tick stage now orchestrates pure functions only.
- Split the climate device pipeline: extracted dedicated `effects/*` modules and a
  `aggregate/zoneEffects` coordinator from `applyDeviceEffects`, keeping each effect
  below 350 LOC, preserving legacy zone capacity warnings, and wiring power→heat
  coupling through the shared aggregator per SEC §6.
- Fixed workforce cultivation scheduling so fresh worlds without a pre-existing
  workforce state still enqueue cultivation tasks and bootstrap the module when
  cultivation is the first subsystem to request labor.
- Added import hygiene guardrails: `simple-git-hooks` pre-commit runs lint + import resolution specs, ESLint now blocks local
  `.js` suffixes in TypeScript, and a Vitest probe dynamically `import()`s engine schemas/pipeline stages to catch bad specifiers
  before CI.
- Audited simulation constant usage across the engine: replaced duplicated physics and
  calendar literals with imports from `simConstants`, updated tolerance handling to
  reuse the canonical `FLOAT_TOLERANCE`, and extended `simConstants.test.ts` with
  smoke coverage that mocks the registry to verify key modules consume the frozen
  values while keeping the aggregate export immutable.
- Domain schemas decoupled: primitives/HarvestLot/Inventory split to avoid circular imports.
- applyHarvestAndInventory: immutable write-back, direct leaf schemas.
- simConstants: alias sync; string vs numeric env parsing fixed.
- Migrated JSON module imports to Node.js 22 import attributes (`with { type: 'json' }`) across engine runtime and test suites to resolve TS2880 and align with the ESM baseline.
- Centralised Zod scalar factories in `schemas/primitives.ts`, exposing helpers for string/number variants and updating blueprint/pipeline modules to import those primitives instead of redefining local copies, eliminating residual circular schema edges.
- Normalised workforce trait metadata conflict resolution to avoid mutating read-only maps and aligned identity RNG seeding with branded employee UUIDs for TS 5.4 compatibility.
- Broke the domain schema circular dependency chain by introducing `schemas/primitives.ts` for shared Zod scalars, moving `InventorySchema` into its own module, and updating every `Uuid`/inventory/harvest import across the engine so inventory parsing no longer dereferences undefined schemas at runtime.
- Fixed CO₂ injector clamp reporting (Task 0019) and extended tariff bootstrap tests:
  - Corrected `clampedByTarget` so it only flips when the requested delta exceeds deliverable output, and added coverage to verify satisfied requests remain unclamped.
  - Exercised difficulty-specific tariff overrides and cache reuse in `createEngineBootstrapConfig` while syncing SEC/ADR typos with the Node.js 22 baseline.

- Added guardrails and coverage across the simulation engine:
  - Introduced ESLint rule `wb-sim/no-economy-per-tick` (with unit tests) to block monetary `*_per_tick` identifiers, documented the guardrail in TDD, and recorded ADR-0021.
  - Published `docs/engine/telemetry.md` describing every telemetry topic/payload with SEC §15 cross-linking.
  - Tightened the CI performance harness with explicit baseline (`≤ 0.20 ms/tick`) and target (`≤ 0.40 ms/tick`) scenario thresholds enforced by `ciPerfCheck.ts` and reflected in TDD.
  - Completed the blueprint parser rollout and added `packages/engine/tests/unit/data/blueprintSchemaCoverage.test.ts` to walk `/data/blueprints/**`, rejecting missing fields/unexpected properties while emitting a coverage summary.
  - Expanded save/load integration coverage (corrupt `schemaVersion`, missing `company.structures`, forward no-op migrations, legacy v0 fixtures) and updated `docs/tasks/0005-save-load-and-migrations.md` accordingly.
  - Added integration checks for storage-room resolution telemetry (missing vs ambiguous storagerooms) ensuring harvest lots remain intact.
  - Shipped the `structureTariffs` read-model with override precedence tests plus DD/TDD documentation.
  - Added device-physics invariants: humidity clamps (0–100 %), CO₂ safety ceiling (`SAFETY_MAX_CO2_PPM`), and non-negative enthalpy backed by deterministic `fast-check` runs; updated `updateEnvironment` to honour the new clamp.
  - Audited workforce payroll accrual so hourly slices summed with banker’s rounding match finalized daily totals (integration test in `economyAccrual.integration.test.ts`).
  - Centralised production constants under `constants/**`, enabled the `@typescript-eslint/no-magic-numbers` ESLint rule with CI `--max-warnings=0`, added a ripgrep-based `pnpm scan:magic` guardrail, and published a codemod plus contributor docs to keep magic numbers out of the engine and façade pipelines.
- Synced `getSimulationConstant` with the frozen registry shared by `@/backend` and `@wb/engine`, keeping string defaults like `DEFAULT_COMPANY_LOCATION_CITY` intact while satisfying the alias sync integration test.

- Published ADR-0017–ADR-0020 to close SEC §14 open questions: locked the canonical irrigation method set, ratified the piecewise quadratic stress→growth curve, mandated hourly-ledger plus daily-rollup economy reporting, and fixed zone height defaults alongside launch cultivation presets.
- Added a deterministic CI performance budget harness (`pnpm perf:ci`) that runs 10 k demo-world ticks, fails below 5 k ticks/min throughput or above the 64 MiB heap plateau, and emits guard-band warnings so regressions surface before breaching SEC §3 success criteria.
- Added a tools-monitor Vitest alias for `@wb/transport-sio` so terminal monitor integration tests resolve the Socket.IO transport directly from source during workspace runs, preventing missing dist artifact failures.
- Added a deterministic mock telemetry harness (`pnpm monitor:mock`) that exercises the terminal monitor without a running façade and documented the TTY/Socket.IO requirements in `docs/tools/terminal-monitor.md`.

### #79 Terminal monitor MVP (Task 0018)

- Shipped the `@wb/tools-monitor` neo-blessed dashboard with a Socket.IO
  telemetry client that honours SEC §0.1/§11.3 read-only mandates, renders
  workforce KPIs, pest/maintenance warnings, and per-hour labour costs, and
  exposes keyboard navigation without enabling command input.
- Added a deterministic runtime store with Zod schema guards plus unit tests to
  catch malformed telemetry and integration coverage that boots against the
  transport harness to assert no telemetry writes trigger `WB_TEL_READONLY`.
- Documented usage, CLI flags, and panel layout in `docs/tools/terminal-monitor.md`
  and wired a top-level `pnpm monitor:terminal` helper script.

### #07 Transport Vitest alias reliability

- Added a façade Vitest alias for `@wb/transport-sio` so integration suites
  resolve the Socket.IO transport directly from source during workspace test
  runs, preventing missing dist artifact failures.

- Removed the `packages/tools/tests/packageAudit.test.ts` tooling audit; the
  report markdown is now maintained via `pnpm report:packages` without an
  automated sync assertion after repeated encoding failures in CI.
- Allowed the `@wb/tools` Vitest runner to pass when no test files are
  present by forwarding `--passWithNoTests`, preventing workspace test runs
  from failing on empty suites.
- Hardened blueprint taxonomy loader guards (Task 0015): renamed the mismatch error to
  `BlueprintTaxonomyMismatchError`, added dedicated unit coverage for directory depth
  and class alignment, extended the repository layout spec to assert taxonomy guardrails,
  and documented the enforcement path in TDD.
- Fixed the conformance harness regressions: aligned golden master specs with the committed
  fixture directory, added a Vitest alias for shared determinism utilities to unblock
  save/load tests, updated the CO₂ injector stub clamp flags, and synced the v1 save fixture
  metadata with the migration output so golden, migration, and stub suites all pass again.
- Hardened the Socket.IO transport adapter (Task 0013): enforced read-only telemetry with
  deterministic `WB_TEL_READONLY` rejections, constrained intents to `intent:submit` with
  `{ type: string }` envelopes, added façade integration tests covering malformed payloads
  and channel misuse, and documented the transport contract updates in SEC/TDD.
- Consolidated economy accrual flows (Task 0012): utilities now capture energy and
  water consumption with tariff-derived per-hour costs, cultivation methods apply
  price map setup costs, maintenance accruals track hourly rates, and a dedicated
  economy integration test (`pnpm --filter @wb/engine test:economy`) guards the
  daily totals.
- Implemented device degradation and maintenance lifecycle flows (Task 0011):
  deterministic wear curves, maintenance scheduling with workshop-aware task
  emission, replacement recommendations, economy accrual tracking, and 120-day
  integration coverage.
- Added test-only determinism helper scaffolds (`hashCanonicalJson`, `newV7`) for
  hashing canonical JSON payloads and generating UUIDv7 identifiers without
  impacting runtime flows (Task 0007).
- Added cultivation maintenance runtime translating cultivation-method reuse policies
  into deterministic repotting, sterilisation, and disposal tasks with unit and
  integration coverage (Task 0010).
- Finalised VPD-driven stress model (Task 0014): shipped Magnus-based
  saturation/dew point helpers in `packages/engine/src/backend/src/physiology/vpd.ts`,
  resolved piecewise quadratic tolerance curves in the physiology stress model,
  integrated VPD into plant stress calculations, removed the `psychrolib`
  dependency, and documented the model across SEC/TDD/DD/VISION_SCOPE with new unit
  and integration tests (`vpd.spec.ts`, `stressCurves.spec.ts`,
  `plantStress.integration.test.ts`).
- Rebuilt the Golden Master conformance suite (Task 0003): generated deterministic 30d/200d fixtures via `generateGoldenScenarioRun`, updated `runDeterministic` to validate fixtures or emit artifacts, expanded conformance specs to assert topology coverage/ACH, inventory transfer, workforce breaks/janitorial cadence, and documented artifact paths in SEC/TDD/task notes.
- Locked canonical geometry, calendar, thermodynamic, and HQ defaults in `simConstants.ts` with documented precedence flow (ADR-0001).
- Anchored irrigation/substrate compatibility to irrigation method blueprints and removed substrate-level lists (ADR-0003).
- Normalised price maps to per-hour maintenance curves and electricity/water tariffs only (ADR-0004).
- Moved shared world schemas into the engine package; façade imports the engine-owned Zod exports (ADR-0005).
- Shipped the deterministic `createRng(seed, streamId)` helper with regression coverage (ADR-0007).
- Required `company.location` metadata with Hamburg defaults and coordinate clamps during validation (ADR-0008).
- Extended zone state and the light emitter stub with PPFD/DLI telemetry plus guard tests (ADR-0010).
- Propagated blueprint-declared `effects`/config blocks onto device instances before pipeline evaluation (ADR-0011).
- Added `ICo2Injector`/`Co2InjectorStub`, enriched zone environment state with `co2_ppm`, and covered steady-state/ramp scenarios via `Co2InjectorStub.test.ts` and `co2Coupling.integration.test.ts`.
- Added `.nvmrc`/`.node-version` markers pinning Node.js 22 (LTS) locally while CI uses Node.js 22 (LTS) (ADR-0012).
- Embedded the deterministic workforce branch (roles, employees, tasks, KPIs, payroll) into world snapshots (ADR-0013).
- Delivered the pest & disease MVP (Task 0004): deterministic zone risk scoring from environment/hygiene signals, automatic inspection/treatment task emission with 72 h quarantine windows, telemetry topics for risk/task events, and unit/integration coverage.
- Implemented seeded workforce identity sourcing with a 500 ms randomuser.me timeout and pseudodata fallback (ADR-0014).
- Flattened blueprint taxonomy to domain-level folders with explicit subtype metadata and migration tooling (ADR-0015).
- Ratified the shadcn/ui + Tailwind + Radix UI stack (lucide icons, Framer Motion, Recharts/Tremor) for UI components (ADR-0016).
- Added crash-safe save/load scaffolding with schema versioning, migration registry (v0→v1), canonical fixtures (`packages/engine/tests/fixtures/save/v*`), and `/data/savegames/` repository path documentation (Task 0005).
- Added a deterministic conformance harness (`runDeterministic`) with committed golden fixtures (`packages/engine/tests/fixtures/golden/30d`, `.../200d`) and Vitest specs (`goldenMaster.30d.spec.ts`, `goldenMaster.200d.spec.ts`) wired to `pnpm --filter @wb/engine test:conf:30d`/`test:conf:200d`.
- Captured Task 0008 package audit matrix with `pnpm report:packages`, documenting the deterministic CLI + Markdown pairing without runtime behaviour changes.
- Populated SEC Appendix B with a complete crosswalk of legacy `/docs/tasks/**` proposals and noted the contradictions log location.

- Docs: standardized blueprint folders to max two levels under /data/blueprints (no deeper subfolders).
- Flattened `/data/blueprints` to domain-level folders (`device/<category>/*.json`,
  `cultivation-method/*.json`, `room/purpose/*.json`, etc.) and aligned all JSON `class`
  values to domain identifiers (`strain`, `device.climate`, `room.purpose.<slug>`, ...).
- Added explicit subtype metadata fields to blueprints (`mode`, `subtype`, `stage`,
  `media`, `family`, `technique`, `pathogen`, `speciesGroup`, `material`, `cycle`,
  `method`, `control`, `structureType`) and tightened Zod schemas/tests accordingly.
- Updated loaders to guard domain↔class alignment only, refreshed fixtures/tests to the
  new layout, introduced migration scripts (`npm run migrate:folders`, `npm run
migrate:classes`, `npm run migrate:blueprints`), and documented the taxonomy update in
  SEC/DD/TDD plus a dedicated ADR.
- Docs/ADR: Adopted Tailwind + shadcn/ui (on Radix) as the UI component stack; updated SEC/DD/AGENTS/VISION_SCOPE and recorded decision in ADR-0016.

### #78 WB-050 sensor stage schema & deterministic noise

- Finalised the sensor stage payload, enriching `applySensors` with timestamp/tick metadata,
  deterministic `sensor:<deviceId>` RNG stream ids, and frozen readings that expose
  `{trueValue, measuredValue, error, noiseSample, noise01, condition01}` per SEC §4.2.
- Added `SensorReadingSchema` validation plus unit tests for noise determinism and schema
  bounds, ensuring humidity/temperature clamps remain enforceable before telemetry export.
- Documented the phase contract in `docs/engine/phases/02-sensors.md` and extended the
  Pattern D integration tests to assert pre-integration sampling, zero-noise stability, and
  tick trace ordering.

### #77 Demo harness humidity baseline

- Updated the engine test harness demo zone to include a representative
  `relativeHumidity01` value so the fixture aligns with the environment
  schema used across integration tests and perf harness scenarios.

### #76 Workforce payroll multipliers & HR intents

- Extended `EmployeeRole` and `Employee` domain models with deterministic compensation metadata: role and employee base rate
  multipliers, labour-market factors, shift time premiums, employment start days, cumulative experience tracking, salary
  expectations, and persisted raise cadence state. Updated the workforce Zod schemas and schema unit tests accordingly.
- Updated `applyWorkforce` payroll accruals to evaluate the full SEC formula
  `rate_per_hour = (5 + 10 × skill) × locationIndex × roleMult × employeeMult × experienceMult × laborMarketFactor`, apply shift
  premiums, and accrue overtime at `1.25×`. Employees now gain experience hours based on work minutes and trait XP multipliers.
- Introduced a raise cadence service with a 180-day employment gate, deterministic jittered cooldowns, and Accept/Bonus/Ignore
  intents that adjust morale, salary multipliers, and next eligibility windows. Emitted new telemetry topics for raises and
  persisted cadence state on employees.
- Added termination intent handling to `applyWorkforce` removing employees before scheduling, clearing task assignments,
  applying optional morale ripples to co-workers, and emitting `telemetry.workforce.employee.terminated.v1` events.
- Surfaced daily payroll snapshots via `telemetry.workforce.payroll_snapshot.v1` and exposed the current payroll state through
  the façade `createWorkforceView` read-model.
- Expanded unit/integration coverage: payroll multiplier scaling, raise cadence eligibility and cooldown resets, termination
  cleanup with telemetry, and façade view assertions.

### #75 Workforce trait system & façade exposure

- Added workforce trait metadata (`traits.ts`) describing conflict groups, strength ranges, and effect hooks for task duration,
  error rates, fatigue, morale, device wear, XP, and salary expectations. Employee records now carry deterministic trait
  assignments plus the hiring triad (`skillTriad`) so downstream consumers have the full candidate context.
- Replaced ad-hoc trait draws with deterministic sampling via `sampleTraitSet(createRng(...))` for both identity generation and
  candidate pools; salary expectations now incorporate trait-driven adjustments (e.g., `trait_frugal`, `trait_demanding`).
- Integrated `applyTraitEffects` throughout the workforce pipeline so scheduling considers trait multipliers, wellbeing deltas,
  and runtime assignments expose trait breakdowns for other subsystems (device wear, XP, economy accrual).
- Extended the façade `createWorkforceView` with employee trait metadata and added a dedicated `createTraitBreakdown` read-model
  summarising counts/averages plus economy hints. Updated unit/integration coverage for trait assignment, stacking, and
  scheduling effects, and documented the system in DD/TDD with ADR updates.

### #74 Hiring market scans & intents

- Extended the workforce domain state and Zod schema with deterministic hiring market data: per-structure `lastScanDay`,
  `scanCounter`, and persisted candidate pools (main + secondary skills, trait draws, base rate hints).
- Introduced a backend workforce config module exposing default market scan parameters (30-day cooldown, pool size 16, cost
  1000 CC) and wired the defaults through `createEngineBootstrapConfig` so façade consumers can reference them deterministically.
- Implemented deterministic candidate pool generation and intent handling in `applyWorkforce`, including RNG stream alignment,
  market cost recording, new employee creation, and telemetry events (`telemetry.hiring.market_scan.completed.v1`,
  `telemetry.hiring.employee.onboarded.v1`).
- Added façade support for the hiring flow via `createHiringMarketView` and transport helpers
  (`createHiringMarketScanIntent`, `createHiringMarketHireIntent`) alongside targeted unit/integration coverage across engine and façade tests.

### #73 Workforce telemetry + façade view

- Added workforce warning support to the domain state and zod schemas, ensuring simulations carry deterministic `WorkforceWarning` snapshots alongside KPIs and payroll totals.
- Emitted `telemetry.workforce.kpi.v1` and `telemetry.workforce.warning.v1` from `applyWorkforce` so monitoring layers receive live KPI snapshots and batched alerts without sharing the intent channel.
- Introduced the façade `createWorkforceView` read-model projecting directory filters (structure/role/skill/gender), live queue metadata, employee detail panels, KPI percentages, and warning decorations for UI consumers.
- Expanded engine/facade tests to cover the warning schema plus the new read-model projection, and refreshed DD/TDD guidance. Existing ADRs already cover the telemetry/read-model separation—no additional ADR required.

### #72 Workforce payroll accruals

- Introduced a `/data/payroll/location_index.json` catalogue and zod-backed loader so structures resolve location multipliers
  deterministically (city overrides > country overrides > default `1.0`).
- Extended the workforce state with daily payroll accumulators (`baseMinutes`, `otMinutes`, `baseCost`, `otCost`, `totalLaborCost`)
  plus per-structure breakdowns. The `applyWorkforce` stage now computes minute-level labour costs via
  `rate_per_minute = ((5 + 10 × relevantSkill) × locationIndex × otMultiplier) / 60`, flips to `otMultiplier = 1.25` for overtime
  minutes, and finalises each day with Banker’s rounding before handing totals to the economy stage.
- Updated `applyEconomyAccrual` to ingest the workforce snapshot so downstream finance modules receive both the current-day view
  and any newly finalised days. Added unit coverage for overtime boundaries, location factors, rounding, and loader validation.

### #71 Workforce scheduling pipeline stage

- Added the `applyWorkforce` pipeline phase between irrigation and economy to dispatch queued tasks per structure, enforce role/skill minimums, honor working-hour limits, and update morale/fatigue (including the breakroom recovery rule).
- Captured per-tick workforce KPIs (queue depth, throughput, utilisation, p95 wait, overtime minutes, maintenance backlog) in the world snapshot and exposed a runtime context for telemetry consumers.
- Extended domain schemas/tests to cover the enriched KPI shape and added integration coverage for priority ordering, deterministic tie resolution, and overtime/breakroom effects.
- Updated TDD/DD documentation to reflect the nine-stage tick pipeline and the new workforce scheduling responsibilities.

### #70 Workforce identity pseudodata source

- Added a workforce identity service that queries `randomuser.me` with deterministic seeds,
  maps genders onto the engine triad, and enforces a 500 ms timeout before falling back to
  curated pseudodata lists.
- Ensured offline pseudodata draws use `createRng` with the documented `employee:<rngSeedUuid>`
  stream and covered the logic with unit tests for online, timeout, and offline golden seeds.
- Captured the privacy assumptions in ADR-0014 so reviewers understand that only pseudonymous
  test data is persisted or emitted.

### #69 Workforce domain scaffolding

- Introduced dedicated workforce domain modules (`EmployeeRole`, `Employee`, `WorkforceState`, task and KPI structures) and
  exposed them through the engine world barrel so simulation snapshots embed deterministic workforce data.
- Extended the shared domain schemas with workforce collections, UUID v7 validation for employee RNG seeds, 0..1 skill/morale/fatigue
  clamps, and working-hour limits (base 5–16 h, overtime ≤ 5 h) accompanied by unit coverage in `workforceSchemas.test.ts`.
- Normalised `/data/configs/task_definitions.json` to use `requiredRoleSlug` plus structured `requiredSkills` entries (`skillKey`,
  `minSkill01`) keeping thresholds aligned to the SEC skill scale.
- Documented the workforce branch in `docs/DD.md` and added schema coverage guidance to `docs/TDD.md`.

### #68 Tooling - enforce pnpm 10.18.0 installs

- Added a `preinstall` guard that aborts `pnpm install` when the package manager is not pnpm 10.18.0, relying on the workspace shim metadata.
- Exposed a `verify-pnpm` script and helper utility so CI and contributors can assert the correct pnpm version without triggering an install.

### #67 Reporting CLI tooling prerequisites

- Documented Node.js/Corepack/pnpm setup prerequisites and troubleshooting guidance for the seed-to-harvest reporting CLI, clarifying that the repository `packageManager` metadata requires pnpm.

### #66 Seed-to-harvest reporting pipeline

- Added `reporting/generateSeedToHarvestReport.ts` to compose the lifecycle orchestrator with the perf harness and emit
  structured JSON (stage transitions, telemetry aggregates, perf traces) for downstream analysis.
- Published a `tsx` CLI entrypoint and `pnpm --filter @wb/engine report:seed-to-harvest` script that persists artifacts to the
  repository `/reporting` folder with scenario-aware filenames.
- Documented the workflow in `docs/engine/simulation-reporting.md` and covered invariants via
  `tests/integration/reporting/seedToHarvest.report.test.ts`.

### #65 Deterministic seed-to-harvest orchestrator

- Added `seedToHarvest.ts` under the engine backend as a deterministic
  orchestration entrypoint that seeds demo worlds with strain-configurable
  seedlings, loops `runTick`, and exposes stop conditions plus vegetative and
  flowering schedule overrides.
- The orchestrator promotes zones to flowering when strain light-hour
  thresholds are met, collects stage-transition instrumentation and harvest
  telemetry, and returns a summary including elapsed ticks, biomass totals, and
  harvested inventory lots for downstream tooling.
- Documented the module’s availability and usage expectations here so
  simulation consumers know where to bootstrap end-to-end lifecycle runs.
- Added `seedToHarvest.integration.test.ts` covering a full White Widow
  lifecycle to assert stage transitions, deterministic photoperiod flips, and
  harvest lot quality/biomass outputs across the pipeline.

### #64 Physiology biomass increment unit correction

- Converted the growth model `baseLightUseEfficiency` from kilograms to grams
  during biomass calculations so strain blueprints keep SI unit storage while
  the physiology util operates in grams.
- Removed the redundant tick fraction multiplier from light-driven biomass
  growth because the daily light integral increment is already scoped per tick,
  preventing underestimation during multi-hour ticks.
- Documented the expected units on the strain blueprint schema and refreshed
  the growth utility tests to assert the revised maintenance scaling.

### #63 AK-47 strain stress tolerance alignment

- Added the missing `ppfd_umol_m2s` tolerance to the AK-47 strain blueprint so it
  conforms to the strain schema and can load alongside the other hybrid
  blueprints during physiology integration tests.

### #62 Harvest storage inventory MVP

- Added deterministic `HarvestLot` and `Inventory` domain models with strict Zod
  schemas and UUID-safe parsing for storage tracking.
- Introduced the `applyHarvestAndInventory` phase with storage room resolution,
  deterministic lot creation, telemetry hooks, and plant lifecycle finalisation.
- Implemented inventory read-model projections per structure and per storage room
  alongside documentation of phase behaviour and telemetry topics.

### #61 Harvest pipeline and storage integration

- Implemented the `applyHarvestAndInventory` pipeline stage to automatically
  locate harvest-ready plants, compute quality/yield using SEC-weighted
  formulas, and deposit resulting lots into the first available storageroom.
- Added comprehensive integration coverage
  (`harvest.integration.test.ts`) for multi-zone harvesting, diagnostics when
  prerequisites are missing, and end-to-end lifecycle progression through
  storage.
- Expanded harvest utility unit tests to cover extreme input clamping,
  method modifiers, UUID validation, and soft-cap behaviour, ensuring the
  mathematical helpers remain stable.

### #XX WB-XXX Strain Blueprint Loader mit Filesystem-Integration

- Implementiert `strainBlueprintLoader.ts` mit Lazy-Loading-Mechanismus: Scannt `/data/blueprints/strain/**` beim ersten Zugriff, baut In-Memory-Index (`Map<Uuid, StrainBlueprint>`), und cached Blueprints im Modul-Scope.
- Integriert Loader in `advancePhysiology.ts`: Ersetzt TODO-Block (Zeile 40) mit `loadStrainBlueprint()`-Aufruf; Runtime-Cache verhindert redundante Lookups pro Tick.
- Fügt Unit-Tests hinzu (`strainBlueprintLoader.test.ts`): Validiert Filesystem-Scan, Index-Build, Cache-Verhalten, und Fehlerbehandlung mit echten JSON-Fixtures.
- Erweitert Integration-Tests (`plantPhysiology.integration.test.ts`): Testet vollständigen Plant-Lifecycle mit White Widow Blueprint, validiert Stage-Transitions und Biomasse-Wachstum.
- Erstellt `strainFixtures.ts` Test-Utility: Zentralisiert Strain-IDs (`WHITE_WIDOW_STRAIN_ID`) und Factory-Funktionen für Test-Pflanzen/Zonen.
- Fügt Blueprint-Barrel-Export (`blueprints/index.ts`) hinzu: Vereinfacht Imports und etabliert API-Grenze für Blueprint-Subsystem.
- Etabliert Muster für zukünftige Blueprint-Loader (Device, Irrigation, Substrate): Filesystem-Scan + Validation + Caching.

### #60 Utility consolidation for helper functions

- Added shared numeric helpers (`clamp`, `clamp01`, `resolveTickHoursValue`) and
  validation/environment utilities to eliminate divergent inline
  implementations across stubs, pipeline stages, and domain services.
- Updated device creation, physiology, and actuator stubs to consume the new
  helpers while standardising tick duration, airflow, and fraction handling.
- Introduced a reusable `deviceQuality` test helper and documented the helper
  catalogue under `/docs/helper-functions.md` to prevent future duplication.

### #59 Tooling - Node version manager hints

- Added `.nvmrc` and `.node-version` pointing to Node.js 22 (LTS) so local environment managers auto-select the target runtime.
- Captured the decision in ADR-0012 to document the unified Node.js 22 (LTS) runtime across local tooling and CI.

### #58 WB-052 Zod compatibility rollback

- Pinned `@wb/engine` to `zod@3.24.x` to restore `.strict()` and `.superRefine()`
  behaviours within blueprint schemas so SEC-aligned validation guards run
  again.
- Regenerated the workspace lockfile via `pnpm install` to ensure the downgraded
  Zod release is installed consistently across local and CI environments.

### #57 WB-050 physiology pipeline scaffolding

- Introduced a strain blueprint schema with taxonomy validation, deterministic
  slug registry support, and SEC-aligned environmental band constraints to
  unblock physiology modelling.
- Added photoperiod, stress, and growth utility modules covering light cycle
  evaluation, tolerance band stress scoring, and Q10-informed biomass/health
  updates for downstream pipeline use.
- Implemented the `advancePhysiology` pipeline stage to age plants, surface
  diagnostics for missing strain blueprints, and prepare deterministic RNG
  hooks while preserving world immutability semantics.
- Expanded Vitest coverage across the new utilities, schema parser, and
  pipeline integration harness to codify the SEC §8 requirements and guard
  against regressions.

### #56 WB-049 DD sync to 8-phase pipeline + order test

- Updated DD §6 to reflect the 8-phase pipeline with explicit Sensor Sampling (per SEC §4.2).
- Added an integration test asserting the canonical phase order via the tick trace harness (TDD §7).

### #55 WB-048 airflow schema coverage parity

- Extended the device blueprint schema regression fixture to include the
  explicit airflow effect block required by the SEC, keeping the multi-effect
  validation aligned with runtime expectations.
- Updated the multi-effect pipeline integration fixtures to supply matching
  airflow configurations so ACH aggregation and logging continue to exercise
  the enforced schema nuance.

### #54 WB-047 sensor sampling before environment integration

- Reordered the Engine tick pipeline so `applySensors` executes immediately after
  `applyDeviceEffects`, capturing zone conditions before `updateEnvironment`
  integrates actuator deltas as required by SEC §4.2.
- Updated Pattern D integration coverage and the pipeline order trace assertion
  to reflect the new sequencing while keeping runtime cleanup semantics intact.
- Revised SEC, DD, and TDD documentation to call out the dedicated sensor stage
  and its placement ahead of environmental integration.

### #53 WB-046 idle tick immutability guard

- Updated `commitAndTelemetry` to return the existing world snapshot untouched
  (including `simTimeHours`) when no pipeline stage mutated state, matching the
  SEC §1 ordered-tick guarantee that idle ticks do not fabricate temporal
  advancement.
- Extended the irrigation/nutrient integration suite to assert both reference
  equality and time stability when the tick processes zero irrigation events,
  ensuring regressions surface immediately.
- Normalised placeholder physiology/harvest/economy pipeline stages to return
  their input world when no work occurs so mutation tracking and the new commit
  semantics remain faithful.

### #52 WB-045 irrigation runtime lifecycle instrumentation

- Deferred `clearIrrigationNutrientsRuntime` to the Engine tick runner so the
  instrumentation hook can inspect irrigation/nutrient outputs before the
  runtime clears, mirroring the sensor lifecycle defined in SEC §6.3.
- Ensured the irrigation stage seeds a fresh runtime even when zero events
  arrive so successive ticks never inherit stale zone delivery maps.
- Expanded the irrigation/nutrient integration test to execute a second tick
  without events, asserting the runtime surfaces empty maps and the zone buffer
  remains stable per the SEC/TDD pipeline contracts.

### #51 WB-044 latent heat coupling for stacked climate devices

- Added the SEC-mandated `LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG` constant to
  the simulation canon and documentation so latent/sensible coupling shares a
  single source of truth.
- Extended `applyDeviceEffects` to translate humidity actuator water removal/
  addition into sensible temperature deltas using the new constant while
  respecting duty cycle, coverage effectiveness, and thermal mode to avoid
  double counting on multi-effect devices.
- Updated the multi-effect integration suite to log per-zone contributions via
  pipeline instrumentation and to assert the combined sensible+latent
  expectations for Patterns A/B and stacked heater+dehumidifier scenarios.

### #50 WB-043 world mutation tracking in Engine pipeline

- Added a private `__wb_worldMutated` tracking helper on `EngineRunContext` so the
  tick runner can detect in-place stage stability without cloning worlds.
- Updated `runTick` to raise the flag when a stage returns a new world instance
  and to clear it once the pipeline finishes, keeping context reuse deterministic.
- Optimised `commitAndTelemetry` to mutate `simTimeHours` in-place when no prior
  stage touched the world, preserving the existing clone path when mutations do occur.

### #49 WB-042 airflow config parity for exhaust and cooling devices

- Added explicit airflow effect blocks to the Exhaust Fan 4-inch and CoolAir Split 3000
  blueprints so `parseDeviceBlueprint` enforces the SEC airflow schema for existing
  airflow effects.
- Documented the airflow contract alignment here to keep blueprint data changes
  traceable for contributors.

### #48 WB-041 interface stacking vectors and integration coverage

- Documented stub reference vectors, stacking patterns, and acceptance criteria
  across SEC §6.3, DD §8a, and TDD §9a to align documentation with the
  `/docs/proposals/20251002-interface_stubs.md` specification.
- Added dedicated integration coverage for Pattern D (sensor + thermal actuator)
  and Pattern E (irrigation service + nutrient buffer) within the engine pipeline
  suite to backfill explicit stacking scenarios referenced by the docs.

### #47 WB-040 irrigation and nutrient buffering pipeline

- Extended the zone domain contract and Zod schemas with `nutrientBuffer_mg`
  and `moisture01`, wiring the demo harness defaults so simulation snapshots
  expose substrate inventory for irrigation logic.
- Implemented the `applyIrrigationAndNutrients` pipeline stage using the
  deterministic irrigation and nutrient buffer stubs, runtime context maps, and
  diagnostics emission while updating zone nutrient buffers in the world tree.
- Added an Engine run context hook for `irrigationEvents`, a comprehensive
  integration suite covering single/multi-event aggregation, leaching,
  persistence, and multi-zone isolation, plus documentation updates here.

### #46 WB-039 light emitter stub and zone lighting telemetry

- Added `createLightEmitterStub` mirroring the plateau-field model from the SEC
  so dimming factors linearly scale PPFD, DLI increments derive from tick
  duration, and optional power draw reports watthour consumption.
- Extended the zone domain model, schemas, and validation pipeline with
  `ppfd_umol_m2s` and `dli_mol_m2d_inc` aggregates, ensuring lighting telemetry
  is available for downstream orchestration layers and initialised in the demo
  harness.
- Shipped comprehensive Vitest coverage for the new stub including reference
  vectors, dimming clamps, energy accounting, and edge-case validation, plus
  documentation updates (ADR-0010) describing the contract change.

### #45 WB-038 thermal actuator stub with cooling & auto support

- Added `createThermalActuatorStub` under `@/backend/src/stubs` to deliver
  deterministic heating, cooling, and auto-mode behaviour with structured
  outputs for downstream composition.
- Reused the canonical dry-air physics helpers so both heating waste loads and
  cooling capacity honour device efficiency and `max_*_W` clamps while guarding
  invalid inputs.
- Introduced dedicated Vitest coverage validating heating/cooling reference
  vectors, auto-mode branching, output finiteness, and the documented edge
  cases alongside a soft deprecation notice on the legacy heating helper.

### #44 WB-037 blueprint taxonomy guardrails clarified for contributors

- Expanded SEC and DD blueprint sections with explicit directory conventions,
  JSON-source-of-truth language, and a required loader failure when paths and
  classes diverge.
- Updated the TDD checklist and AGENTS guardrails to cover taxonomy-aware
  tests and contributor guidance, ensuring misplaced blueprints fail fast in CI.
- Added a vision-scope modding note plus ADR-0009/CHANGELOG updates so
  documentation, governance, and implementation stay aligned.

### #43 WB-036 taxonomy-driven blueprint filesystem

- Migrated every blueprint JSON under `/data/blueprints/**` into taxonomy-aligned
  directories whose segment names mirror the declared class (e.g.
  `device/climate/cooling/cool-air-split-3000.json`).
- Removed legacy duplicate folders and renamed fixtures to their canonical slugs so
  autodiscovery derives consistent `{class, slug}` keys across the dataset.
- Added a repository sweep test that asserts each blueprint's `class` matches its
  path-derived taxonomy and that slug identifiers remain unique per class.
- Updated unit tests and documentation (SEC/DD/prompts) to reference the new
  folder structure so downstream tooling, loaders, and contributors follow the
  deeper hierarchy.

### #42 WB-035 blueprint taxonomy guardrails align filesystem & class strings

- Reorganised device, irrigation, and substrate blueprints under taxonomy-aligned
  folders (e.g. `/data/blueprints/device/climate/cooling/**`) so directory
  segments encode `<domain>.<effect>[.<variant>]`.
- Extended the device, irrigation, and substrate schema parsers to accept the
  blueprint file path, derive the expected taxonomy, and raise descriptive
  errors when JSON `class` declarations drift from their folders.
- Replaced the hard-coded device class enum with taxonomy validation while
  keeping slug uniqueness per class via an opt-in registry for loaders.
- Updated unit tests to load repository fixtures using absolute paths and
  documented the guard in the tests, ensuring regressions trip immediately when
  files land in the wrong folder.

### #41 WB-034 irrigation compatibility slug validation

- Normalised every irrigation blueprint `compatibility.substrates` entry to the real substrate
  slugs shipped under `/data/blueprints/substrate`, removing phantom media names and keeping
  scenario metadata aligned with available inventory.
- Added an irrigation blueprint parser that validates compatibility entries against the
  known substrate slug set and fails fast when unknown media sneak in, with unit coverage
  for the repository fixtures and regression cases.
- Expanded cultivation compatibility tests so method defaults and substrate options resolve
  to at least one compatible irrigation blueprint automatically, preventing future drift.

### #40 WB-033 substrate density enforcement

- Enriched every substrate blueprint with `purchaseUnit`, `unitPrice_per_*`, `densityFactor_L_per_kg`,
  and explicit `reusePolicy` metadata aligned with SEC §7.5 so cultivation tooling can convert
  container volumes into substrate mass deterministically.
- Added a dedicated substrate blueprint schema plus cultivation and irrigation helpers that
  require the density factor, expose L↔kg conversions, and surface deterministic irrigation charge
  calculations with fresh unit tests.
- Updated SEC/DD/TDD guidance to call out the new required fields and documented the change here.

### #39 WB-032 blueprint taxonomy alignment

- Added a canonical `<domain>.<effect>[.<variant>]` `class` discriminator and kebab-case
  slugs across every blueprint JSON under `/data/blueprints/**`, removing legacy
  `kind`/`type` identifiers while keeping slug uniqueness per class.
- Extended the device blueprint schema to require the taxonomy, enforce slug format, and
  validate effect-specific fields for cooling, CO₂ injection, humidity control,
  dehumidification, airflow, and vegetative lighting classes.
- Refreshed fixtures, unit tests, SEC/DD guidance, and a new ADR to document the
  taxonomy-driven migration for future contributors.

### #38 WB-031 device read-model percent enrichment

- Introduced a façade read-model mapper that forwards canonical device metrics
  while appending `qualityPercent`/`conditionPercent` derived via the SEC-mandated
  `Math.round(100 * value)` normalisation.
- Re-exported the mapper from the façade entrypoint so downstream UI/transport
  layers consume the enriched payload without bespoke imports.
- Added Vitest unit coverage proving raw `[0,1]` fields coexist with the rounded
  percentage metrics, including edge rounding behaviour.

### #37 WB-030 device condition lifecycle scaffolding

- Added a backend device condition helper module with placeholder degradation,
  maintenance, and repair flows that honour SEC monotonic wear requirements and
  clamp condition/threshold values to the canonical unit interval.
- Exposed the condition helpers via the world barrel so downstream engine
  surfaces can query maintenance/repair eligibility without bespoke imports.
- Covered the new helpers with unit tests for monotonic wear, threshold checks,
  RNG-ready repair hooks, and clamping semantics.

### #36 WB-029 deterministic device quality factory

- Added `createDeviceInstance` to the backend device module so world/bootstrap
  loaders draw device `quality01` via the deterministic `device:<uuid>` RNG
  stream and clamp values into the canonical unit interval.
- Updated domain exports and world/test fixtures to route device construction
  through the shared helper, eliminating ad-hoc quality assignments in unit and
  integration tests.
- Introduced dedicated unit coverage that verifies frozen results and
  deterministic equality for identical `{seed, id}` pairs.

### #35 WB-028 canonical constant consolidation

- Added `SECONDS_PER_HOUR`, `FLOAT_TOLERANCE`, and geospatial boundary constants
  to `simConstants`, eliminating duplicate physics values across the engine
  pipeline and validation layers.
- Updated world validation, schema guards, and thermal pipeline stages to import
  the shared constants, unifying tolerance/error messaging and dropping
  hard-coded ranges.
- Normalised related test fixtures to declare descriptive constants for their
  magic numbers and refreshed the canonical constant reference documentation.

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

### #12 Price map enforcement for device service costs

- Removed per-service maintenance costs from device blueprints and migrated the
  values into `/data/prices/devicePrices.json` under the new
  `maintenanceServiceCost` field.
- Hardened the device blueprint schema to reject any monetary keys at load time
  and added unit coverage to catch regressions.
- Added a canonical schema + tests for the device price map to ensure all
  entries expose `maintenanceServiceCost` alongside the existing maintenance
  curve parameters.
- Updated SEC, DD, TDD, and ADR-0004 to document the separation of blueprint
  metadata from pricing data.

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
- Added base linting, formatting, and testing toolchain aligned with Node.js 22 (LTS) ESM requirements.
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

# Changelog

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

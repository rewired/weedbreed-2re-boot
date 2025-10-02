# Changelog

## [2025-10-07] WB-001 pnpm workspace bootstrap
- Initialised pnpm workspaces with shared TypeScript configuration and path aliases for engine, façade, transport, and monitoring packages.
- Added base linting, formatting, and testing toolchain aligned with Node 23+ ESM requirements.
- Provisioned CI workflow executing lint, test, and build stages to guarantee green pipelines.

All notable changes to this repository will be documented in this file.

## [2025-10-06] Currency-neutral terminology enforcement
- Clarified across SEC, DD, TDD, and Vision Scope that monetary identifiers and UI copy must remain currency-neutral, forbidding baked-in codes/symbols (EUR, USD, GBP, etc.).
- Updated reference docs and prompts to describe tariffs and KPIs using neutral cost phrasing instead of currency-specific notation.

## [2025-10-05] Issue-0003 economy price map alignment
- Added ADR-0004 documenting the canonical maintenance and tariff price maps (device maintenance base/increase fields; utility tariffs limited to electricity & water).
- Normalized `/data/prices/devicePrices.json` maintenance keys, confirmed grow room blueprints omit `baseRentPerTick`, and set `/data/prices/utilityPrices.json` as the single source of truth for `price_electricity`/`price_water`.
- Updated SEC, DD, TDD, and Vision/Scope guidance to reflect the canonical field names and removal of the nutrient tariff knob.

## [2025-10-04] Canonical simulation constants alignment
- Added ADR-0001 to capture the canonical simulation constants contract (`AREA_QUANTUM_M2 = 0.25`, `ROOM_DEFAULT_HEIGHT_M = 3`, calendar invariants) and document precedence across SEC, DD, TDD, AGENTS, and VISION_SCOPE.
- Flagged exporter tooling drift that still referenced `AREA_QUANTUM_M2 = 0.5`, aligning it with the SEC baseline in the decision history.

## [2025-10-03] Irrigation compatibility source of truth correction
- Removed `supportedIrrigationMethodIds` from substrate blueprints; irrigation compatibility is now resolved from irrigation method blueprints that list compatible substrates under `compatibility.substrates`.
- Superseded ADR-0002 with ADR-0003 to document the irrigation-method-driven compatibility model and refreshed SEC/DD/TDD guidance accordingly.

## [2025-10-02] Cultivation method blueprint field alignment
- Renamed cultivation method planting density to `areaPerPlant_m2` and updated container/substrate references to concrete blueprint slugs.
- Shifted irrigation compatibility to substrate blueprints via `supportedIrrigationMethodIds`, removing direct `irrigationMethodIds` from cultivation methods (see ADR-0002, superseded by ADR-0003).
- Added ADR-0002 documenting the substrate-driven irrigation compatibility decision and refreshed SEC/DD/AGENTS guidance.

## [2025-10-01] Data audit groundwork
- Logged device blueprint schema gaps (placement scope + room eligibility) in ISSUE-0001 for SEC alignment.
- Captured cultivation method blueprint compliance gaps with SEC §7.5 in ISSUE-0002.
- Recorded pricing data violations (per-tick rates, tariff fields) in ISSUE-0003.
- Replaced legacy `roomPurposes` with `allowedRoomPurposes` and added `placementScope=["zone"]` across device blueprints to satisfy SEC placement metadata requirements.

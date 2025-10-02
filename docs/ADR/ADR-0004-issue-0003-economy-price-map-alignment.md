# ADR-0004: Issue-0003 economy price map alignment

## Status
Accepted

## Context
Issue-0003 tracked multiple violations of the SEC §3.6 pricing guidance:

- Device blueprints and price maps were inconsistent about how recurring maintenance was represented, with drift between `maintenanceCostPerHour` fields and the intended base/increase split.
- Grow room blueprints leaked a `baseRentPerTick` field that contradicted the per-hour economy standard and overlapped with facility economics handled elsewhere.
- Utility pricing mixed electricity, water, and a stray `pricePerGramNutrients` knob, leaving ambiguity about which tariffs the engine should honor as the canonical configuration.

These discrepancies made it impossible to resolve tariffs deterministically at simulation start and threatened future automation that depends on predictable maintenance curves.

## Decision
- Normalize `/data/prices/devicePrices.json` so every entry exposes **`capitalExpenditure`**, **`baseMaintenanceCostPerHour`**, and **`costIncreasePer1000Hours`**.
- Remove the nonsensical `baseRentPerTick` field from the grow room blueprint.
- Establish `/data/prices/utilityPrices.json` as the single source of truth for tariff configuration exposing **only** `price_electricity` (cost per kWh, currency-neutral) and `price_water` (cost per m³, currency-neutral); drop the nutrient price entry entirely.
- Update SEC, DD, TDD, and Vision/Scope documentation to call out these canonical field names and the fact that nutrient costs come through irrigation/substrate consumption rather than a utility tariff.

## Consequences
- Maintenance scheduling and cost accrual can rely on the base/increase contract without guessing which field to read.
- Room blueprints stay focused on spatial semantics; rent modelling will live in dedicated economy systems if/when needed.
- Tariff resolution utilities can load `/data/prices/utilityPrices.json` as-is, confident that the map aligns with SEC policy and contains no unrelated knobs.
- Tooling and validation must flag regressions if new tariff fields appear or if device maintenance schemas drift from the base/increase structure.

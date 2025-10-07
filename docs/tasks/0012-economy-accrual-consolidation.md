# Economy Accrual Consolidation

**ID:** 0012  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P1  
**Tags:** backend, economy, tests, ci

## Rationale
Economy rules require all energy, water, and maintenance flows to accrue costs in the economy stage with per-hour units ([SEC §10](../SEC.md#10-economy-integration-non-intrusive); [AGENTS §5 Data Contracts](../../AGENTS.md#5-data-contracts--price-separation-sec-3)). Price maps must be the sole source for tariffs and maintenance curves, and [TDD §8 Economy & Tariffs](../TDD.md#8-economy--tariffs-sec-36) enforces override precedence. We need to consolidate accrual logic so every device flow feeds into the economy stage and CI checks guard daily totals.

## Scope
- Include: audit of all device/resource flows (Wh, m³, maintenance hours) to ensure they feed into economy accrual with correct units and tariffs.
- Include: apply maintenance cost curves based on device price maps and cultivation method costs per SEC §7.5 references.
- Include: CI check validating daily totals against expected baselines for a reference scenario.
- Out of scope: introducing new pricing models or dynamic tariffs beyond SEC definitions; UI reporting changes.

## Deliverables
- Updated economy accrual module aggregating all resource usage and applying tariffs/maintenance costs using price map data.
- Unit/module tests covering tariff resolution, maintenance curve application, and cultivation method cost accrual.
- Integration test verifying daily totals for a reference scenario match expected values.
- CI script/spec ensuring accrual totals remain within tolerance (e.g., ±EPS) and fails on drift.
- Documentation/CHANGELOG updates noting the consolidation and CI guard.

## Implementation Steps
1. Inventory all resource usage outputs (device energy, irrigation water, maintenance hours) and ensure they feed into the economy accrual stage.
2. Refactor economy module to apply tariffs from `/data/prices/utilityPrices.json` and maintenance curves from `/data/prices/devicePrices.json`, respecting override precedence.
3. Integrate cultivation method recurring costs (containers, substrate policies) into accrual per SEC §7.5 requirements.
4. Add tests (unit + integration) verifying hourly → daily aggregation, tariff overrides, and maintenance curve scaling.
5. Create a CI check (Vitest or script) comparing reference scenario daily totals to stored expectations within SEC tolerances; document the workflow.

## Acceptance Criteria / DoD
- All energy/water/maintenance flows appear in economy accrual outputs with per-hour units; tests enforce no `_per_tick` usage.
- Tariff overrides vs factors resolved per TDD example (`override` wins); maintenance curves apply correct cost increases over runtime hours.
- Integration test for reference scenario passes with totals matching expected values within `EPS_REL`/`EPS_ABS` tolerances.
- CI guard runs automatically (pnpm script) and fails on drift; docs/CHANGELOG updated.

## Tests
- Unit tests: tariff resolver, maintenance curve evaluator, cultivation method cost calculator.
- Integration test: `packages/engine/tests/integration/pipeline/economyAccrual.integration.test.ts` verifying daily totals for canonical scenario.
- CI gate: pnpm task executing the integration test plus tolerance check; optionally run in conformance workflow.

## Affected Files (indicative)
- `packages/engine/src/backend/src/economy/accrual.ts`
- `packages/engine/src/backend/src/economy/tariffs.ts`
- `packages/engine/tests/unit/economy/*.spec.ts`
- `packages/engine/tests/integration/pipeline/economyAccrual.integration.test.ts`
- `docs/SEC.md` ([§10](../SEC.md#10-economy-integration-non-intrusive), [§7.5 references](../SEC.md#423-zone-requirement-shall))
- `docs/TDD.md` ([§8](../TDD.md#8-economy--tariffs-sec-36))
- `docs/CHANGELOG.md`
- `AGENTS.md` ([§5](../../AGENTS.md#5-data-contracts--price-separation-sec-3))

## Risks & Mitigations
- **Risk:** Double-counting resource flows. **Mitigation:** Centralize aggregation in one module and add unit tests ensuring single entry per resource.
- **Risk:** CI baseline rot when scenario changes. **Mitigation:** Update stored expectations alongside scenario tweaks and log in CHANGELOG.
- **Risk:** Performance regressions in accrual stage. **Mitigation:** Profile accrual step and cache tariff lookups; ensure perf harness stays within limits.

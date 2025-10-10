# Hotfix Batch 03 — Plan

## Summary
- **Current lint debt:** 314 errors / 223 warnings from `pnpm -r lint --max-warnings=0` (typecheck script missing; tests currently green but rely on deprecated helpers).
- **Primary clusters:**
  - Unsafe dynamic typing in blueprint loaders & integration tests (139 findings across `no-unsafe-*`, `no-explicit-any`, redundant unions).
  - Nullish guardrails & redundant optional chaining (100 findings spanning `no-unnecessary-condition`, `prefer-nullish-coalescing`).
  - Magic numbers embedded in engine/domain modules (223 warnings).
  - Dead-code hygiene noise (`no-unused-vars`, `prefer-const`, `require-await`) (44 findings).
  - String formatting determinism (`restrict-template-expressions`, `no-base-to-string`) (16 findings).
  - Immutable state handling (`no-dynamic-delete`) (10 findings).
  - Thermal actuator stubs still using deprecated helpers (5 findings).

## Prioritised Execution Order
1. **0060 — Unsafe dynamic types hardening (Cluster: unsafe-dynamic-types)**
   - Unblocks subsequent tasks by enforcing typed blueprint/domain helpers.
2. **0061 — Nullish guardrails & optional chain cleanup (Cluster: nullish-guards)**
   - Depends on typed DTOs from 0060 to express correct invariants.
3. **0062 — Immutable state handling (Cluster: immutable-state-handling)**
   - Apply after type tightening to avoid refactoring stale signatures.
4. **0063 — Deterministic string formatting (Cluster: string-format-safety)**
   - Requires previous tasks so helpers can rely on typed values.
5. **0064 — Canonical constant extraction (Cluster: magic-numbers)**
   - Consume updated types/formatters to centralise constants without rework.
6. **0065 — Dead code hygiene & await discipline (Cluster: dead-code-hygiene)**
   - Finish after structural work to avoid churn on files being touched earlier.
7. **0066 — Thermal actuator upgrade (Cluster: thermal-actuator-upgrade)**
   - Final sweep to replace deprecated helper usage once surrounding files stabilise.

## Task ↔ Rule ↔ Package Matrix (excerpt)
| Task | Cluster | Dominant Rules | Key Packages | Representative Files |
| --- | --- | --- | --- | --- |
| 0060 | unsafe-dynamic-types | `no-unsafe-member-access`, `no-unsafe-assignment`, `no-explicit-any`, `no-redundant-type-constituents` | `packages/engine` (backend + tests) | `src/backend/src/domain/blueprints/device/parse.ts`, `tests/integration/pipeline/economyAccrual.integration.test.ts`, `tests/unit/domain/strainBlueprintSchema.test.ts` |
| 0061 | nullish-guards | `no-unnecessary-condition`, `prefer-nullish-coalescing`, `no-non-null-assertion` | `packages/engine` pipeline/workforce | `src/backend/src/workforce/market/candidates.ts`, `tests/integration/pipeline/sensorReadings.integration.test.ts` |
| 0062 | immutable-state-handling | `no-dynamic-delete` | `packages/engine` workforce/pipeline | `src/backend/src/workforce/index.ts`, `src/backend/src/cultivation/methodRuntime.ts` |
| 0063 | string-format-safety | `restrict-template-expressions`, `no-base-to-string`, `no-useless-escape` | `packages/engine` | `src/backend/src/cultivation/methodRuntime.ts`, `src/backend/src/engine/conformance/builder/worldBuilder.ts` |
| 0064 | magic-numbers | `no-magic-numbers` | `packages/engine` constants/util | `src/backend/src/domain/workforce/traits.ts`, `src/backend/src/util/uuid.ts` |
| 0065 | dead-code-hygiene | `no-unused-vars`, `prefer-const`, `require-await` | `packages/engine` loaders/tests | `src/backend/src/domain/blueprints/device/schemaByClass.ts`, `tests/unit/data/blueprintSchemaCoverage.test.ts` |
| 0066 | thermal-actuator-upgrade | `no-deprecated` | `packages/engine` thermo tests | `tests/unit/thermo/heat.spec.ts`, `tests/integration/pipeline/zoneCapacity.integration.test.ts` |

(See `reports/batch-03/supervisor/task-matrix.json` for the full file allocation list — each file is assigned to exactly one task.)

## Residual Debt / Watchlist
- No additional warning budget accepted; target is **zero** lint errors and warnings.
- Typecheck script still missing in several workspaces — align once lint debt is cleared.
- Monitor for new SEC clarifications around blueprint tariff overrides while refactoring.

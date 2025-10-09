# Remove impossible branches and optional-chain misuse

**ID:** 0047
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** engine, pipeline

## Rationale
`no-unnecessary-condition` and redundant optional chaining/tautology warnings clutter pipeline files, hiding real invariants and risking dead code paths.
Cleaning them up clarifies control flow without altering simulation semantics.

## Scope
- In: Pipeline files called out in the proposal (`applyDeviceEffects.ts`, `applyIrrigationAndNutrients.ts`, `applySensors.ts`, `updateEnvironment.ts`, workforce modules) where conditions are always true/false or optional chaining is misapplied.
- Out: Adding new branches, changing algorithm order, or touching unrelated modules without such warnings.

## Deliverables
- Remove tautological comparisons, redundant `??`/`?.`, and replace with explicit guards aligned with TypeScript types.
- Update accompanying tests or type declarations if the removal exposes incorrect typings.
- Note the cleanup in CHANGELOG if it affects developer-facing documentation.

## Acceptance Criteria
- `@typescript-eslint/no-unnecessary-condition` and related optional chaining lint rules pass in the targeted files.
- Pipelines continue to satisfy determinism checks and integration tests.
- No new lint warnings are introduced by the refactor.

## References
- [HOTFIX‑042 §2.4 — Unnecessary Conditions / Optional Chains](../../../proposals/20251009-hotfix-batch-02.md#24-unnecessary-conditions--optional-chains)
- [AGENTS.md §2 — Determinism Everywhere](../../../../AGENTS.md#2-core-invariants-mirror-sec-%C2%A71)

# Replace dynamic delete operations

**ID:** 0045
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** engine, pipeline, lint

## Rationale
`no-dynamic-delete` violations in pipeline modules (`applyDeviceEffects`, `applyIrrigationAndNutrients`, `applySensors`) and workforce logic introduce mutable side effects and serialization risks.
The hotfix requires immutable rest patterns or `Map.delete` usage to satisfy lint and preserve deterministic state updates.

## Scope
- In: Engine pipeline modules and workforce entry points specifically listed in the proposal; adjust related tests to reflect immutable removal patterns.
- Out: Broader refactors of data structures, introducing new persistence formats, or altering behavior beyond replacing delete semantics.

## Deliverables
- Refactor dynamic `delete obj[key]` sites to use immutable spreads, `Map.delete`, or explicit undefined assignments where serialization demands removal.
- Update associated type definitions/tests to reflect the new patterns.
- Document the immutable removal strategy in CHANGELOG if external behavior differs (e.g., undefined vs absent keys).

## Acceptance Criteria
- `@typescript-eslint/no-dynamic-delete` reports zero violations in the targeted files.
- Pipeline operations maintain deterministic outputs (golden hashes unchanged) after the refactor.
- Tests covering device effects, irrigation/nutrients, sensors, and workforce paths remain green.

## References
- [HOTFIX‑042 §2.5 — no-dynamic-delete](../../../proposals/20251009-hotfix-batch-02.md#25-no-dynamic-delete)
- [AGENTS.md §2 — Determinism Everywhere](../../../../AGENTS.md#2-core-invariants-mirror-sec-%C2%A71)

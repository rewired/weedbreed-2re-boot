# Thermal Actuator Upgrade

**ID:** 0066
**Status:** Planned
**Owner:** codex
**Priority:** P0
**Tags:** engine, thermo, lint

## Rationale
Thermo tests still call deprecated `applyDeviceHeat`, producing `@typescript-eslint/no-deprecated` errors and diverging from the Phase 6 actuator pipeline mandated by SEC §6.

## Scope
- In: Files under `packages/engine/tests/unit/thermo` and integration tests listed for `thermal-actuator-upgrade`.
- In: Any remaining stubs referencing deprecated helper exports.
- Out: Core actuator implementation (assumed already Phase 6 compliant).

## Deliverables
- Replace `applyDeviceHeat` usage with `createThermalActuatorStub` or newer helpers.
- Remove deprecated exports if no longer needed; update docs accordingly.
- Adjust tests to assert new stub outputs and maintain golden vectors.

## Acceptance Criteria
- `pnpm -r lint --max-warnings=0` no longer reports `@typescript-eslint/no-deprecated` for thermo tests.
- `pnpm -r test` (thermo + pipeline suites) remains green with updated expectations.
- CHANGELOG documents the helper migration for downstream consumers.

## References
- SEC v0.2.1 §6 (Device power↔heat coupling)
- AGENTS.md §6 (Thermal actuator guidance)
- reports/batch-03/supervisor/task-matrix.json → `thermal-actuator-upgrade`

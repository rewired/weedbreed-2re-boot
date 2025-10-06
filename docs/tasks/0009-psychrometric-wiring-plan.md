ID: 0009
# Psychrometric Wiring Plan

**ID:** 0003A
**Status:** In Progress
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, environment, tests

## Rationale
Psychrometric calculations are required for SEC-aligned environment modelling (VPD, humidity control, stress signals). Establishing a test-only helper with property coverage lets us validate library choices before coupling production stages.

## Scope
- Include: `computeVpd_kPa` helper backed by `psychrolib` with SI units, returning vapour pressure deficit in kPa.
- Include: reference test vectors + property-based sanity checks (finite, ≥0 for RH ∈ [0,100]).
- Out of scope: invoking the helper in the live tick pipeline, humidity control, or telemetry until ADR confirms adoption.

## Deliverables
- `packages/engine/src/shared/psychro/psychro.ts` helper with unit documentation.
- Vitest specs (including `fast-check`) proving baseline behaviour.
- Documentation notes outlining the integration plan and version caveats (`psychrolib` still on v1.x).

## Implementation Steps
1. Initialise `psychrolib` in SI mode at module load, expose `computeVpd_kPa(T_c, RH_pct)`.
2. Add deterministic test vector (e.g., 25 °C, 50 % RH) and property-based guard to ensure finite ≥0 output across expected ranges.
3. Capture follow-up steps in docs/tasks for eventual pipeline integration and version upgrades.

## Acceptance Criteria / DoD
- Helper exists under `packages/engine/src/shared/psychro/` with documentation.
- Tests validate both the reference vector and property constraints using `fast-check`.
- Docs (CHANGELOG, DD, TDD) note that the helper is test-only pending design sign-off.

## Tests
- `pnpm --filter @wb/engine test` (property + unit coverage).

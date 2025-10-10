# Immutable State Handling

**ID:** 0062
**Status:** Planned
**Owner:** codex
**Priority:** P0
**Tags:** engine, state, lint

## Rationale
`@typescript-eslint/no-dynamic-delete` flags show workforce and pipeline modules mutating records via `delete`. This breaks SEC §2 no-hidden-globals policy and risks non-deterministic tick ordering.

## Scope
- In: Files under `packages/engine/src/backend/src/workforce/**` and pipeline stages listed for `immutable-state-handling`.
- Out: Non-engine packages.

## Deliverables
- Replace `delete` operations with immutable helpers (e.g. `omitKeys`, `Object.fromEntries` filtering).
- Ensure helpers return fresh objects without mutating inputs; add them to shared util if missing.
- Update associated tests verifying state snapshots remain pure.

## Acceptance Criteria
- `pnpm -r lint --max-warnings=0` yields zero `no-dynamic-delete` findings for scoped files.
- Integration tests for workforce assignment and pipeline steps remain deterministic.
- Helper utilities include documentation referencing SEC §2 invariants.

## References
- SEC v0.2.1 §2 (Ordered tick pipeline & no hidden globals)
- AGENTS.md §13 (Do/Don’t list – avoid hidden mutation)
- reports/batch-03/supervisor/task-matrix.json → `immutable-state-handling`

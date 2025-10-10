# Canonical Constant Extraction

**ID:** 0064
**Status:** Planned
**Owner:** codex
**Priority:** P1
**Tags:** engine, lint, constants

## Rationale
223 `@typescript-eslint/no-magic-numbers` warnings indicate simulation-critical values are hardcoded across workforce traits, world builder recipes, and utility modules. This violates SEC canonical constants guidance and complicates DD tracking.

## Scope
- In: Files under `packages/engine/src/backend/src/domain/workforce`, `engine/conformance`, `util`, and other entries listed for `magic-numbers`.
- Out: Datasets already storing numeric policy in JSON.

## Deliverables
- Define or extend constants in `simConstants.ts` (with mirrored docs) for repeated values.
- Replace inline literals with named constants imported from canonical modules.
- For blueprint-related numbers, move values into JSON and load via typed schema if appropriate.
- Update relevant docs/CHANGELOG entries for new constants.

## Acceptance Criteria
- `pnpm -r lint --max-warnings=0` has zero remaining `no-magic-numbers` warnings on scoped files.
- Constants documented in `/docs/constants` with SEC references.
- Unit/integration tests updated to assert behaviour uses the named constants (e.g. workforce trait weights, RNG seeds).

## References
- SEC v0.2.1 §3 (Canonical constants & terminology)
- AGENTS.md §3 (Canonical constants enforcement)
- reports/batch-03/supervisor/task-matrix.json → `magic-numbers`

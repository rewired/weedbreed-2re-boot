# Template literal safety cleanup

**ID:** 0042
**Status:** Planned
**Owner:** unassigned
**Priority:** P0
**Tags:** lint, engine, facade

## Rationale
`@typescript-eslint/restrict-template-expressions` fires across engine pipelines, perf, conformance, save/load, workforce, and façade transport/tests due to interpolating non-strings.
Central helpers (`fmtNum`, `toStr`) must be adopted so logging and labels remain safe without suppressing lint rules.

## Scope
- In: Engine modules named in the proposal (conformance, perf scenarios, seed-to-harvest reports, save/load registries, workforce market/raises, façade transport/tests) to replace unsafe interpolations via `fmtNum`/`toStr` or type narrowing.
- Out: Changing business logic, output wording beyond safe formatting, or editing unrelated template literals already compliant.

## Deliverables
- Refactor targeted files to import and use `fmtNum`/`toStr` or narrow unions before interpolation.
- Ensure new helpers live in `packages/engine/src/backend/src/util/format.ts` and are consumed consistently.
- Update documentation/CHANGELOG to mention the lint safety sweep if it impacts observable strings.

## Acceptance Criteria
- `@typescript-eslint/restrict-template-expressions` reports zero violations across the targeted files.
- Any intentional string changes have accompanying test or documentation updates proving stability of hashes and labels.
- Lint and tests remain green (`pnpm -r lint`, `pnpm -r test`).

## References
- [HOTFIX‑042 §2.1 — restrict-template-expressions](../../../proposals/20251009-hotfix-batch-02.md#21-restrict-template-expressions-engine-facade-tests)
- [AGENTS.md §15 — Acceptance Criteria for core lint fixes](../../../../AGENTS.md#15-acceptance-criteria-for-prs-touching-core)

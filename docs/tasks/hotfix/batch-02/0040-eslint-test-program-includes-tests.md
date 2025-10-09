# ESLint test program includes tests

**ID:** 0040
**Status:** Planned
**Owner:** unassigned
**Priority:** P0
**Tags:** lint, tests, config

## Rationale
The proposal highlights pervasive `parserOptions.project` errors because the ESLint TypeScript program excludes engine tests, causing every test file to fail linting.
Restoring a test-aware TS program removes 372+ cascading lint failures that block the hotfix lint budget.

## Scope
- In: `packages/engine/tsconfig.eslint.json`, `packages/engine` ESLint config or root overrides that point to the new config; ensure tests are part of the analyzed program.
- Out: Changes to runtime simulation code, lint rules unrelated to TypeScript program resolution, or restructuring test suites.

## Deliverables
- Add `packages/engine/tsconfig.eslint.json` extending the package TS config with `src` and `tests` includes.
- Update ESLint configuration (package-level or root override) to reference the new config without disabling rules.
- Document the lint configuration touchpoint in CHANGELOG if the proposal requires reporting.

## Acceptance Criteria
- Running ESLint on engine tests reports zero `parserOptions.project` resolution errors.
- `pnpm -r lint` completes with the test files included in the TypeScript program and without introducing new lint warnings beyond the proposal budget.
- CI documentation (CHANGELOG entry) reflects the ESLint program fix.

## References
- [HOTFIX‑042 §3 — ESLint Program for Tests](../../../proposals/20251009-hotfix-batch-02.md#3-eslint-program-for-tests-fix-parseroptionsproject)
- [SEC v0.2.1 Alignment — AGENTS.md Purpose & Tooling](../../../../AGENTS.md)
- [Simulation Engine Contract v0.2.1](../../../SEC.md)

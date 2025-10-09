# Magic numbers extraction and hoisting

**ID:** 0043
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** lint, constants

## Rationale
The proposal flags repeated literals across engine logic and tests that trigger `no-magic-numbers` and complicate tuning.
Hoisting shared values into descriptive constants (global or local) supports the new guardrail modules and keeps tests maintainable.

## Scope
- In: Engine files noted in the hotfix (perf, pipelines, workforce, conformance) and associated tests requiring shared constants or new `tests/constants.ts` helper modules.
- Out: Rebalancing gameplay logic, changing numerical behavior, or touching façade/UI constants unrelated to lint findings.

## Deliverables
- Replace recurring literals with imports from `simConstants.ts`, `goldenMaster.ts`, or newly introduced module-level constants with JSDoc.
- Add `tests/constants.ts` (per package) where tests reuse fixture values.
- Update documentation/CHANGELOG to record the constant extraction where meaningful.

## Acceptance Criteria
- `@typescript-eslint/no-magic-numbers` violations for the targeted literals drop to zero.
- All introduced constants are documented (JSDoc for engine, inline comments for tests) and reused consistently.
- Unit/integration tests remain green, confirming behavior unchanged.

## References
- [HOTFIX‑042 §2.2 — Magic Numbers](../../../proposals/20251009-hotfix-batch-02.md#22-magic-numbers-no-magic-numbers)
- [SEC v0.2.1 §3 — Canonical Constants](../../../SEC.md#3-canonical-constants--terminology-sec-%C2%A71-2)
- [AGENTS.md §3 — Canonical Constants Enforcement](../../../../AGENTS.md#3-canonical-constants--terminology-sec-%C2%A71-2)

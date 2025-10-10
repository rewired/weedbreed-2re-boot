# Nullish Guardrails and Optional Chain Cleanup

**ID:** 0061
**Status:** Planned
**Owner:** codex
**Priority:** P0
**Tags:** engine, lint, typing, workforce, pipeline

## Rationale
100 findings from `@typescript-eslint/no-unnecessary-condition`, `prefer-nullish-coalescing`, and `no-non-null-assertion` indicate optional chains guarding values already validated upstream. This conceals real contract breaches and undermines SEC tick determinism.

## Scope
- In: Workforce market/scheduler modules, pipeline stages, and integration tests assigned to `nullish-guards`.
- In: Blueprint schema helpers where redundant null checks exist.
- Out: Files without nullish lint violations.

## Deliverables
- Promote precise TypeScript interfaces marking required properties after schema validation.
- Replace optional chains with explicit asserts or guard helpers where absence is a bug.
- Adopt `??`/`??=` for defaulting semantics instead of `||` or manual assignments.
- Update associated tests to cover failure paths when required data is missing.

## Acceptance Criteria
- `pnpm -r lint --max-warnings=0` reports zero `no-unnecessary-condition`, `prefer-nullish-coalescing`, `no-non-null-assertion`, or `no-unnecessary-type-assertion` hits on scoped files.
- `pnpm -r test` demonstrates new negative tests for missing mandatory fields across workforce/pipeline scenarios.
- All conditionals referencing optional values document the invariant (comments or guard functions) to satisfy SEC §5 placement rules.

## References
- SEC v0.2.1 §2 (World model invariants) & §5 (data contracts)
- AGENTS.md §§2–5 (ordered tick pipeline, blueprint validation)
- reports/batch-03/supervisor/task-matrix.json → `nullish-guards`

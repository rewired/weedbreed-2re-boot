# Dead Code Hygiene and Await Discipline

**ID:** 0065
**Status:** Planned
**Owner:** codex
**Priority:** P2
**Tags:** engine, lint, cleanup

## Rationale
44 findings from `no-unused-vars`, `prefer-const`, `require-await`, and related rules reveal stale scaffolding in blueprint schema utilities and tests. Cleaning these reduces noise and prevents future regressions.

## Scope
- In: Files assigned to `dead-code-hygiene` including blueprint schema modules, stubs, and associated tests.
- Out: Business logic already addressed by other tasks.

## Deliverables
- Remove or rename unused variables (use `_` prefix when intentionally ignored).
- Convert eligible `let` to `const`; ensure mutated values copy state first.
- Drop unnecessary `async` wrappers or await actual promises.
- Update tests to match refined signatures.

## Acceptance Criteria
- `pnpm -r lint --max-warnings=0` has no remaining `no-unused-vars`, `prefer-const`, `require-await`, or `no-empty-function` violations on scoped files.
- `pnpm -r test` continues to pass with cleaned utilities.
- Document any intentionally empty callbacks with rationale comments referencing TDD expectations.

## References
- AGENTS.md §14 (Tooling conventions) & §15 (Acceptance criteria)
- TDD guardrails — maintain coverage while pruning code
- reports/batch-03/supervisor/task-matrix.json → `dead-code-hygiene`

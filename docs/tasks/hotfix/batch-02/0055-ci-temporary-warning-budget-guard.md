# CI temporary warning budget guard

**ID:** 0055
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** ci, lint

## Rationale
To prevent regression during the hotfix, the proposal suggests a temporary `lint:strict` script and warning budget gate in CI.
This guard enforces the ≤30 warning budget until the backlog is cleared.

## Scope
- In: Root `package.json` scripts, optional helper under `tools/check-warn-budget.mjs`, and CI documentation referencing the new lint guard.
- Out: Modifying unrelated CI jobs, introducing new pipelines, or enforcing budgets for non-lint tooling.

## Deliverables
- Add `lint:strict` script invoking `pnpm -r lint` plus the warning budget helper.
- Implement `tools/check-warn-budget.mjs` (or equivalent) to parse ESLint output and fail when warnings exceed the budget.
- Update documentation (CHANGELOG, possibly ADR/CI notes) to explain the temporary guard and removal plan.

## Acceptance Criteria
- `pnpm run lint:strict` fails when ESLint warnings exceed the configured budget and passes when at or below it.
- CI documentation reflects the guard so contributors understand expectations.
- No disruption to existing lint/test workflows beyond the planned guard.

## References
- [HOTFIX‑042 §10 — CI Hook (temporary)](../../../proposals/20251009-hotfix-batch-02.md#10-ci-hook-temporary)
- [AGENTS.md §14 — Package & Tooling Conventions](../../../../AGENTS.md#14-package--tooling-conventions)

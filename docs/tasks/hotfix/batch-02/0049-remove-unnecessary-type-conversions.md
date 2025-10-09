# Remove unnecessary type conversions

**ID:** 0049
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** lint

## Rationale
The proposal reports redundant `Number(...)`, pointless `as` assertions, and non-null assertions that mask type issues, triggering lint warnings.
Eliminating them simplifies code and enforces explicit guards.

## Scope
- In: Engine, perf scenarios, stubs, façade tests identified in the proposal where conversions/assertions are unnecessary.
- Out: Introducing new casting frameworks, rewriting modules unrelated to the flagged instances, or altering behavior beyond removing redundant conversions.

## Deliverables
- Remove superfluous numeric conversions, `as` casts, and non-null assertions, replacing with explicit runtime checks where needed.
- Adjust TypeScript typings/tests to ensure safety without assertions.
- Update CHANGELOG if developer ergonomics materially improve.

## Acceptance Criteria
- Lint rules covering unnecessary conversions/assertions report zero violations in modified files.
- Tests remain green, demonstrating behavior unchanged.
- No new type errors introduced by the cleanup.

## References
- [HOTFIX‑042 §2.7 — Unnecessary type conversions/assertions](../../../proposals/20251009-hotfix-batch-02.md#27-unnecessary-type-conversionsassertions)

# Prefer nullish coalescing normalization

**ID:** 0048
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** lint

## Rationale
The proposal identifies unsafe `||` usage where falsy-but-valid values (0, "") are clobbered, triggering `prefer-nullish-coalescing` warnings.
Replacing them with `??`/`??=` ensures defaults only apply to `null`/`undefined` as intended.

## Scope
- In: Files enumerated in the proposal (`engine/reporting/cli.ts`, `shared/determinism/hash.ts`, `generateSeedToHarvestReport.ts`, related helpers) where nullish coalescing should replace logical OR.
- Out: Broader refactors to option handling or adding new defaults unrelated to the flagged instances.

## Deliverables
- Swap unsafe `||` and assignment patterns with `??` or `??=` while preserving semantics for falsy-but-valid values.
- Update any dependent types/tests if the change reveals incorrect assumptions about valid zero/empty states.
- Record the lint normalization in CHANGELOG if necessary.

## Acceptance Criteria
- `@typescript-eslint/prefer-nullish-coalescing` and `prefer-nullish-coalescing` (assignment) lint checks pass on targeted files.
- Existing behavior for valid falsy inputs remains unchanged, confirmed through tests.
- No new lint warnings introduced.

## References
- [HOTFIX‑042 §2.8 — prefer-nullish-coalescing](../../../proposals/20251009-hotfix-batch-02.md#28-prefer-nullish-coalescing--prefer-nullish-coalescing-assignment)

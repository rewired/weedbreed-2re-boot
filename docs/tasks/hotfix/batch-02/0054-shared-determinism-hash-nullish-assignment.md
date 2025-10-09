# Shared determinism hash nullish assignment

**ID:** 0054
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** engine, determinism

## Rationale
`shared/determinism/hash.ts` misuses logical OR assignments, risking deterministic hash divergence when falsy values are valid.
Applying `??=` aligns with the lint recommendation and preserves deterministic hashing.

## Scope
- In: `packages/engine/src/backend/src/shared/determinism/hash.ts` (and dependents if required) to replace `||=`/manual defaulting with `??=`.
- Out: Rewriting the hashing algorithm, expanding determinism tooling, or modifying unrelated modules.

## Deliverables
- Update nullish handling to use `??=` semantics where defaults apply only to `null`/`undefined`.
- Verify associated tests cover the adjusted behavior and update documentation/CHANGELOG if relevant.

## Acceptance Criteria
- Lint rule `prefer-nullish-coalescing` (assignment) passes for the hashing module.
- Determinism tests remain green, confirming hashes unchanged.
- No new lint or type errors introduced.

## References
- [HOTFIX‑042 §2.8 — prefer-nullish-coalescing (assignment)](../../../proposals/20251009-hotfix-batch-02.md#28-prefer-nullish-coalescing--prefer-nullish-coalescing-assignment)
- [SEC v0.2.1 §2 — Determinism](../../../SEC.md#2-core-invariants)

# Remove percent identifiers in engine

**ID:** 0046
**Status:** Planned
**Owner:** unassigned
**Priority:** P0
**Tags:** engine, perf, invariants

## Rationale
`wb-sim/no-engine-percent-identifiers` errors show engine internals still model percent values (0–100) instead of SEC-mandated 0–1 scales.
Renaming to `*01` fields and normalizing calculations is required to restore deterministic behavior and align with façade formatting boundaries.

## Scope
- In: Engine modules highlighted by the proposal (e.g., perf budgets, pipelines) that expose percent-based identifiers or state, ensuring calculations operate on 0–1.
- Out: Façade/read-model layers that intentionally present percent strings, gameplay tuning beyond scale normalization, or UI formatting changes.

## Deliverables
- Rename internal percent-bearing identifiers to the `*01` convention and update type definitions/usages accordingly.
- Adjust calculations and constants to operate in 0–1 scale, using centralized constants where applicable.
- Update documentation (CHANGELOG, relevant constants docs) describing the scale normalization and façade expectations.

## Acceptance Criteria
- Lint rule `wb-sim/no-engine-percent-identifiers` passes across engine packages with zero violations.
- All affected modules have accompanying unit/integration tests updated to assert 0–1 scale semantics without changing observable external percent formatting.
- Deterministic outputs (golden hashes) remain unchanged, or intentional adjustments are documented and verified.

## References
- [HOTFIX‑042 §2.3 — Engine Percent Identifiers](../../../proposals/20251009-hotfix-batch-02.md#23-engine-percent-identifiers-wb-simno-engine-percent-identifiers)
- [SEC v0.2.1 §6 — Quality & Condition Scales](../../../SEC.md#6-device-powerheat-coupling--quality-model-sec-%C2%A76-1-%C2%A76-2-option-a)
- [AGENTS.md §6 — Quality & Condition (Mapping for UI/Economy)](../../../../AGENTS.md#17-appendix-b-%E2%80%94-quality--condition-mapping-for-uieconomy)

# Perf scenarios and budget normalization

**ID:** 0053
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** perf, engine

## Rationale
Perf scenario scripts still mix percent semantics, magic numbers, and unsafe template literals, conflicting with the new 0–1 scale and formatting helpers.
Normalizing these values is required to reduce lint errors and keep perf monitoring accurate.

## Scope
- In: Perf-related files named in the proposal (`perfBudget.ts`, `perfScenarios.ts`, associated helpers/tests) to convert thresholds to 0–1, hoist constants, and adopt safe formatting.
- Out: Changing perf measurement algorithms or expanding scenario coverage beyond the lint-driven fixes.

## Deliverables
- Rename percent-based identifiers to `*01`, reuse centralized constants, and hoist scenario thresholds to well-named constants.
- Replace magic numbers and unsafe template literals with imports from the new helper modules.
- Update tests/documentation (CHANGELOG) if scenario outputs or labels change.

## Acceptance Criteria
- Perf modules pass lint checks for percent identifiers, magic numbers, and template literal safety.
- Scenario outputs remain deterministic; any necessary string adjustments are reflected in tests.
- `pnpm -r lint` and perf-focused tests continue to pass.

## References
- [HOTFIX‑042 §2.1/§2.2/§2.3 — Perf guidance](../../../proposals/20251009-hotfix-batch-02.md#4-file-specific-notes-non-exhaustive-prioritized)
- [SEC v0.2.1 §6 — Quality & Condition Scales](../../../SEC.md#6-device-powerheat-coupling--quality-model-sec-%C2%A76-1-%C2%A76-2-option-a)

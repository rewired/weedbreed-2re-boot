# Stubs safety pass

**ID:** 0050
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** stubs, lint

## Rationale
Stub modules (Sensors, Thermals, CO₂, etc.) rely on non-null assertions and unused imports, generating lint noise and risking runtime safety regressions.
Replacing assertions with guards keeps stubs aligned with engine safety standards.

## Scope
- In: Stub files mentioned in the proposal (sensor, thermal, CO₂, light emitters) to remove non-null assertions, unused imports, and unsafe template literals.
- Out: Implementing real device logic, altering stub behavior beyond safety fixes, or touching unrelated engine modules.

## Deliverables
- Introduce explicit guards or default branches instead of `!` assertions.
- Clean up unused imports and align template literals with `fmtNum`/`toStr` where needed.
- Update tests/documentation to reflect safer stub behaviors if they previously assumed non-null.

## Acceptance Criteria
- Lint passes with zero non-null assertion or unused import warnings in stub modules.
- Stub behavior remains deterministic and compatible with existing tests.
- Any required test adjustments remain green after the changes.

## References
- [HOTFIX‑042 §4 — File-Specific Notes (stubs)](../../../proposals/20251009-hotfix-batch-02.md#4-file-specific-notes-non-exhaustive-prioritized)
- [AGENTS.md §2 — Determinism & Safety](../../../../AGENTS.md#2-core-invariants-mirror-sec-%C2%A71)

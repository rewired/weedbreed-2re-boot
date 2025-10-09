# Central constants and formatting helpers

**ID:** 0041
**Status:** Planned
**Owner:** unassigned
**Priority:** P0
**Tags:** engine, constants

## Rationale
Scattered literals (30, 200, 16, 24, 1024, etc.) prevent consistent tuning and violate the hotfix guardrail for canonical constants.
The proposal mandates new shared modules so engine subsystems stop duplicating values and use common formatting helpers for numeric interpolation.

## Scope
- In: Add `packages/engine/src/backend/src/constants/simConstants.ts`, `constants/goldenMaster.ts`, `util/format.ts`; refactor engine imports that currently inline these literals; mirror updates in `docs/constants/**` and CHANGELOG.
- Out: Altering simulation algorithms, changing numerical semantics beyond moving them into constants, or modifying façade/UI formatting logic.

## Deliverables
- Create the new constants and utility modules with documented exports per proposal.
- Update engine modules to import the centralized constants and helpers instead of hardcoded literals.
- Update supporting documentation (e.g., `/docs/constants`, `/docs/CHANGELOG.md`) to reflect the new sources of truth.

## Acceptance Criteria
- Engine and test code reference the new constants/utilities instead of repeating the specified literals.
- `pnpm -r lint` reports zero `no-magic-numbers` violations for the moved literals in engine scope.
- Documentation reflects the canonical constants and helper availability without conflicting definitions.

## References
- [HOTFIX‑042 §1 — Guardrail First: Central Constants + Helpers](../../../proposals/20251009-hotfix-batch-02.md#1-guardrail-first-central-constants--helpers)
- [Simulation Engine Contract v0.2.1 — Canonical Constants & Terminology](../../../SEC.md#3-canonical-constants--terminology-sec-%C2%A71-2)
- [AGENTS.md §3 — Canonical Constants Enforcement](../../../../AGENTS.md#3-canonical-constants--terminology-sec-%C2%A71-2)

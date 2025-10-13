# UI Validation & Test Harness

**ID:** 9000
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, validation, qa

## Rationale
Establish shared validation utilities and automated tests so the UI meets the proposal’s rounding, compatibility, schedule, and intent-surfacing requirements.
This ensures SEC/TDD guardrails (per-hour economy, placement rules, cultivation compatibility, deterministic layouts) remain enforced across modules.

## Scope
- In:
  - Build validators for capacity/eligibility, CM/Irrigation compatibility (ok/warn/block), 24-hour lighting schedules, duplicate constraints, and locale-aware rounding (2 decimals default, max 3 exceptions).
  - Add test suites covering intent error surfacing, HR assignment actions, rounding/i18n formatting, and control card schedule enforcement.
  - Provide shared test utilities/mocks for read-model data to exercise modules deterministically.
  - Ensure documentation/CHANGELOG entries capture validation/test scaffolding.
- Out:
  - Feature-specific UI changes already captured in other tasks (this task supplies shared utilities/tests).
  - Backend validation (focus on frontend enforcement).

## Deliverables
- Introduce validation helpers under `packages/ui/src/lib/validation` (or similar) with unit tests in `packages/ui/tests` or module-specific `__tests__`.
- Expand Vitest configuration if needed to cover new suites and update `packages/ui/tests` harness.
- Document validation behaviors and testing strategy in `docs/CHANGELOG.md` and, if needed, supporting docs.
- Add GitHub-friendly documentation or ADR references if guardrails change (per instructions).

## Acceptance Criteria
- Lighting schedule validator enforces 15-minute grid summing to 24h with ok/warn/block messaging consumed by control cards and zone flows.
- Capacity/eligibility validators cover room/zone/device movements and duplicate flows, surfacing explicit reasons that align with placement scope rules.
- Compatibility validators support CM/Irrigation and Strain combos with ok/warn/block responses consumed by zone wizard and sowing flows.
- Rounding/i18n utilities ensure default 2-decimal formatting (max 3 where required) with tests covering DE/EN locales.
- HR assignment and intent error surfacing tests verify that UI presents deterministic feedback and respects read-only telemetry.

## References
- docs/proposals/20251013-ui-plan.md §7–§10, §11.9
- AGENTS.md (root) — SEC/TDD/telemetry guardrails

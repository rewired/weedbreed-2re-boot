# Control Card Integration & Documentation

**ID:** 5400
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, controls, integration

## Rationale
Wire the lighting and climate control cards into live zone/room views with read-model data, ensuring CTA routing and documentation so operators receive a complete, actionable experience.

## Scope
- In:
  - Extend read-model/state hooks to provide current vs target metrics, device tile data, and capacity advisor metadata consumed by both cards.
  - Mount lighting and climate control cards in the zone and room detail views using the shared foundation.
  - Implement the "Open Capacity Advisor" CTA wiring that navigates to the structure-level advisor entry point.
  - Update documentation to record delivery of the control cards.
- Out:
  - Backend changes to emit new telemetry fields (assume required data already available or stubbed).
  - Future automation or optimization logic beyond card rendering.

## Deliverables
- Update hooks under `packages/ui/src/hooks` (or equivalent read-model accessors) to expose measured vs target values, device tile payloads, and missing-class metadata for lighting and climate.
- Integrate the lighting and climate control cards into the appropriate zone/room view components, ensuring layout alignment with existing modules.
- Implement CTA routing for ghosted device classes via the shared `onGhostAction` callback, connecting to the structure-level capacity advisor route.
- Append a CHANGELOG entry in `docs/CHANGELOG.md` capturing the introduction of the control cards.

## Acceptance Criteria
- Zone and room views render both lighting and climate control cards populated with live hook data, including deviation badges when readings breach thresholds.
- Missing device classes trigger the shared CTA, navigating to the capacity advisor entry point when activated.
- Documentation reflects the addition of the control cards, including any notable integration details.

## Test Requirements
- Vitest: `pnpm --filter ui vitest run --runInBand --config vitest.config.ts` (include React Testing Library integration tests covering hook wiring and CTA routing mocks).

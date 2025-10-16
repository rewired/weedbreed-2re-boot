# Control Card Foundation

**ID:** 5100
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, controls

## Rationale
Establish the reusable control card scaffolding so lighting and climate surfaces share consistent layout, header semantics, and ghost states before feature-specific logic is layered on.

## Scope
- In:
  - Create shared control card layout primitives covering header, body sections, device tile grid, and ghost state placeholders.
  - Provide deviation badge logic that highlights measured vs target variance without binding to specific metrics.
  - Implement ghosted device-class callouts that emit a structured event for later CTA routing.
- Out:
  - Lighting-specific metrics, schedule editors, or DLI logic.
  - Climate-specific metric rendering or throughput math.
  - Final wiring of CTA navigation (handled once hooks are integrated).

## Deliverables
- Add shared card components under `packages/ui/src/components/controls` with props for measured value, target value, deviation badge, and child content slots.
- Introduce ghosted device-class placeholders that can be slotted into lighting or climate cards, emitting an intent payload describing the missing class.
- Create Vitest suites covering header rendering, deviation badge state changes, and ghost placeholder visibility.

## Acceptance Criteria
- Shared control card renders header with measured vs target values and shows a deviation badge when provided thresholds are exceeded.
- Device tile grid supports both populated and empty states, displaying ghost placeholders for missing classes using the shared component.
- Card emits a structured `onGhostAction` callback when a ghost placeholder is activated, enabling downstream CTA wiring.

## Test Requirements
- Vitest: `pnpm --filter ui vitest run --runInBand --config vitest.config.ts`

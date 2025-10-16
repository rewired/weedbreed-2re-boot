# Lighting Control Card & Schedule Validation

**ID:** 5200
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, controls, lighting

## Rationale
Deliver lighting-specific metrics and the schedule editor on top of the shared control card so cultivation teams can manage PPFD targets, review DLI previews, and enforce SEC light cycle constraints.

## Scope
- In:
  - Implement lighting control card composition using the shared control card foundation.
  - Build the 15-minute grid schedule editor with validation enforcing exactly 24 hours of total coverage and start-hour normalization.
  - Calculate and display derived DLI values alongside PPFD targets using provided intensity and schedule data.
- Out:
  - Real-time telemetry sourcing (hooked in integration task).
  - Device move/remove intent wiring beyond enabling/disabling toggles.

## Deliverables
- Add lighting control card component under `packages/ui/src/components/controls` rendering PPFD header, target input, DLI pill, and device tile slots.
- Introduce schedule validation utilities under `packages/ui/src/lib` (or equivalent) covering 15-minute grid normalization, sum=24h enforcement, and error messaging.
- Provide Vitest suites for schedule validation edge cases and component rendering (including DLI preview and disable/enable toggles).

## Acceptance Criteria
- Lighting card displays current PPFD, editable target PPFD, and a DLI preview pill sourced from schedule data.
- Schedule editor prevents submission of schedules whose on/off totals deviate from 24 hours and snaps entries to 15-minute increments.
- Device tiles within the lighting card expose enable/disable affordances and reflect contribution percentages based on provided props.

## Test Requirements
- Vitest: `pnpm --filter ui vitest run --runInBand --config vitest.config.ts`

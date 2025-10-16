# Climate Control Card Device Tiles

**ID:** 5300
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, controls, climate

## Rationale
Provide the climate control presentation so operators can compare current vs target environmental metrics and manage device class throughput without overlapping schedule work already handled in lighting.

## Scope
- In:
  - Compose the climate control card using the shared control foundation.
  - Render temperature, relative humidity, CO₂, and ACH targets alongside measured values and deviation badges.
  - Display device tiles per class (HVAC, fans, heaters, humidifiers/dehumidifiers, CO₂ delivery) showing throughput/capacity percentages and enable/disable/move/remove affordances.
- Out:
  - Capacity advisor routing and data sourcing (handled in integration task).
  - Automation logic for balancing multi-device throughput.

## Deliverables
- Implement climate control card component under `packages/ui/src/components/controls` supporting per-metric sections and class-specific device grids.
- Provide formatting utilities if needed for throughput and capacity percentages under `packages/ui/src/lib`.
- Add Vitest suites covering rendering of all metric sections, device tile affordances, and throughput percentage calculations.

## Acceptance Criteria
- Climate control card surfaces current vs target temperature, RH, CO₂, and ACH values with deviation badges when tolerances are exceeded.
- Device tiles list each climate device class, exposing enable/disable/move/remove affordances and displaying throughput and capacity percentages.
- Empty states for missing classes render using the shared ghost placeholders.

## Test Requirements
- Vitest: `pnpm --filter ui vitest run --runInBand --config vitest.config.ts`

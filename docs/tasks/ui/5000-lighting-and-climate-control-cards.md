# Lighting & Climate Control Cards

**ID:** 5000
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, controls, devices

## Rationale
Deliver the collapsible lighting and climate control cards defined in the UI plan so operators can inspect current vs target values, manage schedules, and access capacity advisor hooks.
These cards enforce the 24-hour light schedule constraint and centralize device class controls per SEC guardrails.

## Scope
- In:
  - Build shared control card pattern with always-visible header showing current (measured) vs target values and deviation badges.
  - Implement lighting card with PPFD/DLI header, target PPFD input, 15-minute grid schedule editor enforcing sum=24h, DLI preview, and device tiles (condition %, contribution, cap %, enable/disable, move/remove).
  - Implement climate card with temp/RH/CO₂/ACH targets, device tiles per class (AC/HVAC, fans, filters, heaters, humidifiers/dehumidifiers, CO₂) with throughput/cap %, enable/disable, move/remove.
  - Ghost missing device classes with “Open Capacity Advisor” call-to-action hooking to structure-level tool.
- Out:
  - Building the capacity advisor internals (structure module handles) or advanced automation logic.
  - Direct intent dispatch (covered by control wiring tasks if any).

## Deliverables
- Create control card components under `packages/ui/src/components/controls` (or similar) and integrate them into the zone/room views.
- Add schedule validation utilities under `packages/ui/src/lib` ensuring 15-minute grid sums to 24h.
- Update state/hooks to supply measured vs target values and device tiles for lighting/climate categories.
- Write unit tests for schedule validation, ghosted class display, and control card rendering.
- Document the cards in `docs/CHANGELOG.md`.

## Acceptance Criteria
- Lighting control card displays current PPFD prominently, target PPFD + DLI pill, enforces 24h schedule grid, and renders installed device tiles with enable/disable/cap controls plus ghosted missing classes.
- Climate control card shows current vs target temp, RH, CO₂, ACH, lists relevant device classes with throughput/cap %, and supports enable/disable/move/remove affordances per device class.
- Both cards surface deviation badges in the header when measured values drift from target thresholds.
- “Open Capacity Advisor” CTA appears for missing device classes and routes to the structure-level advisor entry point.

## References
- docs/proposals/20251013-ui-plan.md §2, §11.6
- AGENTS.md (root) — device placement & heat coupling guidance

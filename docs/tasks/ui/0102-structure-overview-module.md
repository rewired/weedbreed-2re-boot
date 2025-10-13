# Structure Overview Module

**ID:** 0102
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, structures, dashboard

## Rationale
Implement the structure-level overview (header metrics, capacity/coverage diagnostics, rooms grid, workforce snapshot) described in the UI plan so operators can evaluate facilities at a glance.
This view provides entry points for duplicate/move/capacity advisor flows and aligns the UI with SEC placement and tariff invariants.

## Scope
- In:
  - Create a dedicated Structure page/route that renders header metrics (area/volume, free vs used, tariffs) and inline rename affordance.
  - Render capacity & coverage tiles (lighting coverage vs demand, HVAC/ACH vs volume, power draw) using read-model data.
  - Display rooms grid with purpose, area/volume, free capacity, zone count, warning badges, and workforce snapshot panel.
  - Surface buttons/links that launch duplicate room, device move, and capacity advisor flows provided by sibling tasks.
- Out:
  - Implementing the duplicate/move/capacity advisor internals (handled by Tasks 0107 and 0108).
  - Editing tariffs or other global economy configuration (read-only per plan).

## Deliverables
- Add a `StructurePage` (and supporting components) under `packages/ui/src/pages` and `packages/ui/src/components/structures`.
- Update routing (`packages/ui/src/routes/workspaceRoutes.tsx`) to handle `structures/:structureId` entries and ensure left-rail navigation activates correctly.
- Introduce visualization components for capacity/coverage tiles with styling tokens under `packages/ui/src/styles`.
- Wire workforce snapshot cards using read-model hooks and testing fixtures.
- Cover the structure overview with React Testing Library tests under `packages/ui/src/pages/__tests__`.
- Log the module landing in `docs/CHANGELOG.md`.

## Acceptance Criteria
- Navigating to a structure route shows header metrics, inline rename affordance, tariffs (read-only), and aggregate health/pest indicators per the proposal.
- Capacity/coverage tiles visualize lighting coverage vs demand, HVAC/ACH vs room volume, and hourly power draw with warning badges when limits are breached.
- Rooms grid lists each room with purpose, area/volume, free capacity, zone counts, and warning badges while exposing duplicate/move entry points.
- Workforce snapshot highlights latest actions scoped to the structure using read-model data.
- Buttons for duplicate room and device move trigger the flows defined in Tasks 0107/0108 (stubbing while those tasks are pending is acceptable).

## References
- docs/proposals/20251013-ui-plan.md §1.1, §11.3
- AGENTS.md (root) — placement/eligibility guardrails

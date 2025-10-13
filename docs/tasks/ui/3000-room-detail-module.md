# Room Detail Module

**ID:** 3000
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, rooms, climate

## Rationale
Build the room-level view called out in the UI plan so operators can manage zones, climate baselines, and device status within a structure.
Delivering this module ensures room diagnostics, baselines, and movement affordances align with SEC room-purpose and ACH requirements.

## Scope
- In:
  - Introduce a room detail route (`structures/:structureId/rooms/:roomId`) with header showing purpose, area/volume, free capacity, baseline ACH target, and inline rename.
  - Render compact zones list (health/quality %, pest/disease badges, “ready to harvest”, device warnings) fed by read models.
  - Surface room climate/airflow snapshot comparing targets vs measured values (temp, RH, CO₂, ACH).
  - Display device tiles by class with condition %, contribution, eligibility, and workforce timeline entries for the room.
  - Provide UI triggers for create/duplicate zone, move zones, set baselines, and device move/remove/replace flows provided by sibling tasks.
- Out:
  - Implementing the zone creation/duplication and movement internals (handled by Task 7000/8000).
  - Editing device firmware or automation beyond baseline target adjustments.

## Deliverables
- Add `RoomDetailPage` and supporting components under `packages/ui/src/pages` and `packages/ui/src/components/rooms`.
- Extend router (`packages/ui/src/routes/workspaceRoutes.tsx`) and navigation helpers to support room routes and breadcrumbs.
- Implement climate snapshot and zone list components leveraging read-model selectors and styles.
- Write unit/integration tests validating room view rendering and action entry points.
- Update `docs/CHANGELOG.md` summarizing the room module.

## Acceptance Criteria
- Room route renders header with inline rename, purpose, area/volume, free capacity, and baseline ACH target visualization.
- Zones list shows health/quality percentages, pest/disease badges, “ready to harvest” indicators, and device warnings per zone.
- Climate/airflow snapshot compares targets vs measured temp, RH, CO₂, and ACH with status states (ok/warn).
- Device list groups devices by class showing condition %, contribution, and eligibility while linking to move/remove flows.
- Room timeline section surfaces latest tasks scoped to the room, and action buttons open the correct flows (create zone, duplicate zone, set baselines, move devices/zones).

## References
- docs/proposals/20251013-ui-plan.md §1.2, §11.4
- AGENTS.md (root) — room purpose + ACH rules

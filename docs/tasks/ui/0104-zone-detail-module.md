# Zone Detail Module

**ID:** 0104
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, zones, cultivation

## Rationale
Implement the zone detail experience mandated by the proposal so cultivation teams can monitor KPIs, pest/disease status, devices, and climate snapshots for each zone.
Aligning this view with SEC cultivation method requirements keeps harvest/cull/sow actions scoped correctly.

## Scope
- In:
  - Render aggregated plant KPIs (health/stress/quality median/min/max + 24h sparkline) with percentage display.
  - Display pest/disease status (active/due/cooldown counts, last/next inspection/treatment) and zone context (area/volume, free capacity).
  - Show cultivation & irrigation badges plus derived max plants/density hints.
  - Present device tiles per class (condition %, contribution, caps, warnings) and climate snapshot (temp, RH, CO₂, VPD, ACH with status).
  - Provide actions for harvest, cull, sow (zone empty gate), and category-level device controls with hooks into command flows.
- Out:
  - Building the actual harvest/cull/sow command execution logic (wired later).
  - Device-level tuning beyond category targets (per plan minimal toggles only).

## Deliverables
- Upgrade `ZoneDetailPage` and create supporting components under `packages/ui/src/components/zones` to fulfill the UI spec.
- Add sparkline/chart utilities under `packages/ui/src/components` or `packages/ui/src/lib` for KPI visualization.
- Extend read-model hooks to supply pest/disease timelines and device warnings.
- Write tests covering KPI calculations, badge rendering, and action gating.
- Update `docs/CHANGELOG.md` to note the zone module completion.

## Acceptance Criteria
- Zone view shows aggregated KPIs with median/min/max values and a 24h sparkline, with quality/health percentages rendered.
- Pest/disease panel lists active/due/cooldown counts plus last/next inspection/treatment timestamps, and context block shows area/volume + free capacity.
- Cultivation/irrigation badges surface derived max plants/density hints, and device tiles include condition %, contribution, caps, and warnings when coverage/airflow is insufficient.
- Climate snapshot renders temp, RH, CO₂, VPD, and ACH with ok/warn status states.
- Harvest/cull/sow buttons enforce zone-empty/precondition rules and connect to command flows (stubbed until backend wiring) while category-level device controls expose target adjustments.

## References
- docs/proposals/20251013-ui-plan.md §1.3, §11.5
- AGENTS.md (root) — cultivation method + zone invariants

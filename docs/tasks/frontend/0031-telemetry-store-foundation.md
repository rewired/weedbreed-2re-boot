# Telemetry Store Foundation

**ID:** 0031
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, telemetry, state, track-3

## Rationale
Before wiring socket listeners we need a deterministic client store schema to hold telemetry snapshots for dashboard, zones, and workforce KPIs. Defining the store now enables subsequent binder tasks to focus on transport plumbing.

## Scope
- In: design TypeScript interfaces for the four telemetry topics and create a Zustand (or equivalent) store with setter actions.
- In: provide selectors/hooks consumed by dashboard, zone detail, and workforce pages (currently returning defaults).
- Out: real socket subscriptions (handled next).

## Deliverables
- `packages/ui/src/state/telemetry.ts` defining topic interfaces, store initial state, and hooks (`useTelemetryTick`, `useZoneSnapshot`, etc.).
- `packages/ui/src/state/__tests__/telemetryStore.test.ts` covering default state and action reducers.
- Update placeholder selectors in dashboard/zone/workforce pages to use the new hooks.

## Acceptance Criteria
- Store exposes state slices for `telemetry.tick.completed.v1`, `telemetry.zone.snapshot.v1`, `telemetry.workforce.kpi.v1`, and `telemetry.harvest.created.v1` topics.
- Hooks return sensible defaults (e.g., `null` snapshot) before data arrives and TypeScript enforces topic payload shapes per schemas.
- Unit tests validate reducer behaviour for each topic action.

## References
- [Proposal §3](../../proposals/20251009-mini_frontend.md#3-architectural-contracts)
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §6](../../proposals/20251009-mini_frontend.md#6-data-schemas-mvp-minimal-fields)

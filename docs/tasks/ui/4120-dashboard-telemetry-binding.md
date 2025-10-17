# Dashboard Telemetry Binding

**ID:** 4120
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, dashboard, telemetry

## Rationale
Dashboard KPIs must reflect live telemetry and economy read models rather than hard-coded numbers.

## Scope
- In: wire dashboard components to live telemetry streams and read-model selectors, replacing placeholder values.
- In: add derived formatting utilities with deterministic rounding consistent with SEC tolerances.
- Out: workforce/strains panels (other tasks).
- Out: introduction of new chart libraries.
- Rollback: revert dashboard components to placeholder values.

## Deliverables
- Updated dashboard components/hooks consuming live data.
- Component tests verifying KPIs update when telemetry emits tick/zone events.
- CHANGELOG entry referencing dashboard telemetry wiring.

## Acceptance Criteria
- ≤3 component/hook files (plus tests) modified; ≤150 diff lines.
- Dashboard updates within one tick of telemetry event and displays correct economy deltas from read model.
- Tests (1–3) simulate telemetry events via mocked socket client verifying UI updates.
- Tests to add/modify: 3 component tests using testing-library and mocked telemetry provider.

## References
- SEC §4 telemetry, §5 economy
- TDD §5 dashboard binding
- Root AGENTS.md §4 telemetry guidance

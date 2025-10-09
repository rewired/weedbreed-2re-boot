# Workforce KPI Skeleton

**ID:** 0030
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, ui, workforce, track-4

## Rationale
Workforce KPIs must surface headcount, role distribution, and warnings. Providing a dedicated page with structured placeholders ensures telemetry and read-model wiring have a stable target.

## Scope
- In: build workforce KPI page with cards for headcount, role mix, utilization, and warning list.
- In: create hooks/selectors using the read-model client interfaces to supply data once hydration is implemented.
- Out: live data binding or filters beyond static placeholders.

## Deliverables
- `packages/ui/src/pages/WorkforcePage.tsx` with layout components.
- `packages/ui/src/pages/__tests__/WorkforcePage.test.tsx` verifying placeholders and list rendering.
- Shared components (e.g., `packages/ui/src/components/workforce/KpiCard.tsx`) for consistent visuals.

## Acceptance Criteria
- Workforce page renders sections for headcount, roles, utilization, and warnings with placeholder data.
- Hooks/interfaces for workforce data defined under `packages/ui/src/state/workforce.ts` returning stubbed values.
- Tests assert placeholder content and warning list fallback state.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §6](../../proposals/20251009-mini_frontend.md#6-data-schemas-mvp-minimal-fields)

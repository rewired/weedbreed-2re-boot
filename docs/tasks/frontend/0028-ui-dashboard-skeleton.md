# Dashboard Skeleton

**ID:** 0028
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, ui, dashboard, track-4

## Rationale
The dashboard is the primary landing surface summarising simulation tick rate, day/time, and key metrics. Building a skeleton with placeholder widgets lets telemetry wiring drop in later without layout churn.

## Scope
- In: create dashboard page component with cards for tick rate, sim day/time, daily cost rollups, energy/water usage, and an event stream list.
- In: stub selectors/hooks that read from a forthcoming store interface (define TypeScript interfaces to be fulfilled later).
- Out: live data binding or telemetry subscriptions (handled in telemetry track).

## Deliverables
- `packages/ui/src/pages/DashboardPage.tsx` with layout components and placeholder values.
- `packages/ui/src/pages/__tests__/DashboardPage.test.tsx` ensuring sections render and placeholder copy is present.
- Shared style tokens or utility classes in `packages/ui/src/styles/dashboard.css` (or Tailwind config) as needed.

## Acceptance Criteria
- Dashboard renders all specified widgets with accessible headings and placeholders.
- Page consumes typed selectors (e.g., `useDashboardSnapshot`) that currently return stub data but enforce shape for later wiring.
- Tests confirm the placeholder values and headings; snapshot or DOM assertions accepted.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [VISION Scope §2](../../VISION_SCOPE.md#2-product-pillars)

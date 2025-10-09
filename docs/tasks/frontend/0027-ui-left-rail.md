# UI Left Rail Navigation

**ID:** 0027
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, ui, navigation, track-4

## Rationale
The left rail provides global navigation between Dashboard, Zone Detail, and Workforce KPIs. Implementing the shell early enables other surfaces to slot into consistent routes and keeps layout work isolated.

## Scope
- In: add React Router (or existing routing strategy) with routes for Dashboard, Zone Detail, Workforce KPIs placeholders.
- In: implement left rail component with accordion-style structures/zones per proposal, using mock data sourced from read-model types (can be hard-coded until hydration tasks land).
- Out: actual data hydration or real-time updates (handled by later tasks).

## Deliverables
- `packages/ui/src/components/layout/LeftRail.tsx` rendering navigation sections and active state styling.
- Routing updates in `packages/ui/src/App.tsx` (or router module) hooking the left rail + outlet.
- `packages/ui/src/components/layout/__tests__/LeftRail.test.tsx` verifying navigation links render and active route highlighting works.

## Acceptance Criteria
- Left rail lists structures and zones with accordion behaviour; selecting items updates URL routes.
- Navigation supports keyboard interaction (tab + enter/space) per accessibility expectations.
- Tests cover initial render and route change highlighting.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [VISION Scope §2](../../VISION_SCOPE.md#2-product-pillars)

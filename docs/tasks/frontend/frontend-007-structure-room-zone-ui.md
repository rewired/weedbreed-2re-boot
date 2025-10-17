# Swap Structure/Room/Zone UI to Live Data

**ID:** FRONT-007
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, ui, read-models

## Rationale
Navigation, dashboard metrics, and structure/room/zone feature hooks still rely on hard-coded fixtures, blocking parity with backend metrics and warnings. Once the store fetches live payloads we must update components to consume them.

## Scope
- In: Update navigation builders, dashboard cards, and structure/room/zone hooks to read from live selectors and remove deterministic fixtures.
- In: Surface backend-provided warnings, tasks, compatibility hints, and tariffs with graceful empty states.
- Out: Workforce or HR surfaces; strain catalog UI; telemetry-driven animations (handled elsewhere).

## Deliverables
- Updated UI modules (e.g. `packages/ui/src/features/structures/**`, `packages/ui/src/components/dashboard/**`).
- Component/unit tests adjusted to mock live selectors.
- Storybook or docs snippets showing live-data-driven cards.

## Acceptance Criteria
- Navigational tree reflects live read-model IDs without hard-coded arrays.
- Dashboards display backend KPIs and warnings; no fixture constants remain in targeted files.
- Tests verify selectors/rendering when backend returns populated and empty payloads.

## References
- SEC §§1–3 (structure hierarchy, economy KPIs)
- DD §4 (UI read-model mapping)
- Root `AGENTS.md` (UI contract guidance)

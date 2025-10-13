# HR Directory & Tasking Surface

**ID:** 0106
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, hr, workforce

## Rationale
Stand up the HR surface described in the proposal so teams can track workforce assignments, activity timelines, task queues, and capacity hints from a central UI.
This work links HR intents (assignments, inspections, treatments, maintenance) with existing structure/zone flows while keeping telemetry read-only.

## Scope
- In:
  - Build HR left-rail section/route showing workforce directory with role, skill tags, current assignment, recent activity, overtime flag, condition/morale, and hourly cost (per-hour display).
  - Render global HR activity timeline (who/where/when/duration) with filters by structure/room/zone/role.
  - Surface read-only task queues for upcoming/in-progress zone/room tasks showing assignee when available.
  - Provide capacity snapshot summarizing headcount by role vs open tasks and coverage hints.
  - Add buttons for assign/reassign, acknowledge/launch inspections/treatments, and maintenance start/complete hooking into intents used elsewhere.
- Out:
  - Payroll/economy adjustments beyond per-hour displays.
  - Implementing backend scheduling (assume existing intent pathways handle) beyond hooking to commands.

## Deliverables
- Expand or replace `WorkforcePage` under `packages/ui/src/pages` with HR-focused components plus supporting UI under `packages/ui/src/components/workforce`.
- Integrate HR read-model data and filters, storing state where appropriate (e.g., `packages/ui/src/state/workforce.ts`).
- Ensure navigation labels reflect “HR” terminology in design tokens.
- Provide tests covering directory rendering, filtering, task queues, and action button availability.
- Update `docs/CHANGELOG.md` capturing the HR surface.

## Acceptance Criteria
- HR route shows workforce directory with role, skills, current assignment, recent activity snippet, overtime flag, condition/morale indicator, and hourly cost formatted per locale.
- Activity timeline lists recent tasks with who/where/when/duration and supports filters by structure/room/zone/role.
- Task queues display upcoming/in-progress inspections, treatments, harvest, and maintenance tasks with assignee info when available.
- Capacity snapshot compares open tasks vs available headcount with simple coverage hint.
- Action buttons for assignment, inspections/treatments, and maintenance dispatch the same intents exposed in room/zone modules (read-only telemetry maintained).

## References
- docs/proposals/20251013-ui-plan.md §5
- AGENTS.md (root) — telemetry read-only, intent guardrails

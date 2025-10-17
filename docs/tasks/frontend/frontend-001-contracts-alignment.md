# Align Frontend Contracts with SEC/DD

**ID:** FRONT-001
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, documentation, planning

## Rationale
The UI still renders deterministic fixtures and lacks a verified mapping against the Simulation Engine Contract. We need an authoritative checklist so subsequent wiring work lands against the correct read-model, telemetry, and intent shapes.

## Scope
- In: Review SEC/DD/TDD for required frontend data and intents; document deltas versus current UI; enumerate missing endpoints or schema fields.
- Out: Implementing schema or code changes; modifying backend adapters; updating UI components beyond documentation.

## Deliverables
- Updated contract notes in `docs/tasks/frontend/FRONT-001` subfolder (create if needed) summarising required read-model, telemetry, and intent payloads.
- Issues or follow-up tickets created for any SEC gaps found (link them in the task notes).
- CHANGELOG/DD annotations only if new decisions are made.

## Acceptance Criteria
- Inventory lists each required contract element with status (implemented vs missing) and cites source clauses.
- Risks/unknowns escalated via linked follow-up tasks or ADR stubs.
- Review signed off by tech lead or product counterpart.

## References
- SEC §§1–3, §7.5
- DD §§2–4
- TDD §1 (transport expectations)
- Root `AGENTS.md` (documentation requirements)

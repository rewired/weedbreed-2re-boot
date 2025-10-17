# Sim Control Contract Checklist

**ID:** 0130
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** ui, simulation, documentation

## Rationale
Simulation controls require precise transport and acknowledgement semantics; documenting these before implementation prevents inconsistent handling across backend and frontend tasks.

## Scope
- In: produce a checklist within docs/TDD.md covering play/pause/step/speed and telemetry coupling expectations for the UI.
- In: annotate SEC or DD where current guidance is silent on control acknowledgement sequencing.
- Out: no modifications to transport code or store implementations.
- Out: no addition of new control features beyond documentation.
- Rollback: remove the checklist additions if later superseded by an ADR.

## Deliverables
- Checklist table or bullet list inserted into docs/TDD.md summarising control contract requirements and referencing follow-up tasks.
- Optional note in docs/SEC.md pointing to the new checklist for implementation guidance.

## Acceptance Criteria
- ≤3 documentation files touched; ≤150 diff lines total.
- Checklist explicitly lists required telemetry events, intent payloads, and acknowledgement timing with references to tasks 3100–3130.
- Document builds without lint errors (`pnpm lint:docs` if available).
- Tests to add/modify: none.

## References
- SEC §5 telemetry guidance
- TDD §3 simulation controls
- Root AGENTS.md §4 (Telemetry vs Intent)

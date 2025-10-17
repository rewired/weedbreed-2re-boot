# Workforce & Maintenance Intents

**ID:** 3120
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** backend, intents, workforce

## Rationale
HR, pest, and maintenance workflows must issue intents that adjust assignments and task queues to reflect live simulation state.

## Scope
- In: implement HR assignment, pest mitigation, and maintenance scheduling intents with validation against workforce capacity and SEC policies.
- In: ensure acknowledgements return updated queue summaries and warnings.
- Out: UI workforce panel updates (Phase 4).
- Out: telemetry publishing (Phase 2 already handles events).
- Rollback: remove new intent handlers if instability arises.

## Deliverables
- Command handlers for HR/pest/maintenance intents.
- Unit tests covering assignment success, capacity overflow failure, and pest mitigation scheduling.
- CHANGELOG entry referencing workforce intent support.

## Acceptance Criteria
- ≤3 source files (plus tests) modified; ≤150 diff lines.
- Handlers enforce workforce utilization caps and SEC §7 task policies.
- Acknowledgements include deterministic roster deltas for UI consumption.
- Tests to add/modify: 3 unit tests (assignment success, overflow failure, pest scheduling).

## References
- SEC §7 workforce tasks
- DD §3 workforce operations
- Root AGENTS.md §6a interface stacking

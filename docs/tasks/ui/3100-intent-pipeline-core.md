# Intent Pipeline Core

**ID:** 3100
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, intents

## Rationale
The façade must handle rename and movement intents end-to-end so UI interactions stop logging stub messages.

## Scope
- In: implement rename/move intents (structures, rooms, zones, devices) through the façade command pipeline with deterministic validation.
- In: ensure acknowledgements return success/failure envelopes consistent with TDD.
- Out: climate/lighting adjustments (other tasks).
- Out: frontend store updates (Phase 4).
- Rollback: revert command handlers and restore stub responses.

## Deliverables
- Updated command handler modules supporting rename/move intents.
- Unit tests covering success and failure cases with deterministic seeds.
- CHANGELOG entry referencing intent pipeline expansion.

## Acceptance Criteria
- ≤3 source files (plus tests) modified; ≤150 diff lines.
- Handlers validate placementScope and roomPurpose per SEC before applying moves.
- Acknowledgements include correlation IDs and status per contract.
- Tests (1–3) cover rename success, move validation failure, and success path.
- Tests to add/modify: 3 unit tests.

## References
- SEC §4 intent contracts, §4.2 placement
- TDD §6 command handling
- Root AGENTS.md §§4–5, §13 Do & Don’t

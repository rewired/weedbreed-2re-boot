# Environment Adjust Intents

**ID:** 3110
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, intents, climate

## Rationale
Lighting and climate adjustments must flow through the façade pipeline to control devices with acknowledgements that mirror SEC expectations.

## Scope
- In: implement lighting/climate adjustment intents (setpoints, schedules) for rooms/zones with validation against device capacity and cultivation methods.
- In: ensure acknowledgements include resulting target state and command correlation.
- Out: HR/pest/maintenance intents (other tasks).
- Out: frontend UI updates.
- Rollback: remove new intent handlers and revert to stub responses.

## Deliverables
- Command handler updates enabling climate/lighting adjustments.
- Unit tests verifying validation failures (capacity breach) and success responses.
- CHANGELOG note documenting environment intent support.

## Acceptance Criteria
- ≤3 source files (plus tests) modified; ≤150 diff lines.
- Handlers enforce SEC §6 power/heat coupling constraints when calculating new setpoints.
- Tests (1–3) include success case and failure due to incompatible cultivation method/device.
- Acknowledgements return deterministic payloads consumed by Phase 4 tasks.
- Tests to add/modify: 3 unit tests.

## References
- SEC §6 power & climate, §7 cultivation
- TDD §6 command handling
- Root AGENTS.md §§6, 13

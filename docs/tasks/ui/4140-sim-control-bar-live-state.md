# Sim Control Bar Live State

**ID:** 4140
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, simulation, controls

## Rationale
The simulation control bar must reflect live playback state, clock, and economy values sourced from telemetry and acknowledgements.

## Scope
- In: bind control bar components to telemetry tick clock, economy read model, and intent acknowledgement state from Phase 3.
- In: ensure UI updates only after successful backend acknowledgements to maintain determinism.
- Out: command dispatch refactors (existing hooks remain).
- Out: styling changes.
- Rollback: revert control bar to previous placeholder bindings.

## Deliverables
- Updated control bar hooks/components reading telemetry clock and economy balance/delta.
- Component tests confirming state updates after simulated acknowledgement and telemetry events.
- CHANGELOG note referencing control bar live state.

## Acceptance Criteria
- ≤3 files (plus tests) modified; ≤150 diff lines.
- Control bar clock increments per telemetry tick and pauses when playback state ack indicates paused.
- Economy balance and daily delta values originate from live read model without hard-coded numbers.
- Tests to add/modify: 2 component tests (tick advance, pause state).

## References
- SEC §1 tick standard, §5 economy
- TDD §3 simulation controls
- Root AGENTS.md §§2, 4

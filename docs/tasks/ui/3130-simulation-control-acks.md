# Simulation Control ACKs

**ID:** 3130
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, intents, simulation

## Rationale
Simulation control intents (play, pause, step, speed) must propagate acknowledgements that reflect actual playback state to keep frontend stores consistent.

## Scope
- In: implement command handlers that mutate playback state and respond with deterministic acknowledgements.
- In: ensure state mirrors update only after successful backend confirmation, coordinating with telemetry loop.
- Out: frontend store wiring (Phase 4) and telemetry loop (Phase 2 already handles ticking).
- Out: additional control types beyond play/pause/step/speed.
- Rollback: restore previous stubbed control responses.

## Deliverables
- Updated playback command handlers with acknowledgement payloads.
- Unit tests ensuring each control intent results in expected playback state transitions.
- CHANGELOG note referencing control acknowledgement support.

## Acceptance Criteria
- ≤3 source files (plus tests) modified; ≤150 diff lines.
- Acknowledgements include new state (`running`, `paused`, `speedMultiplier`) and correlation IDs.
- Tests (1–3) cover play→pause transition, single step behavior, and speed change validation.
- Tests to add/modify: 3 unit tests.

## References
- SEC §1 tick standard, §4 telemetry vs command
- TDD §3 simulation controls
- Root AGENTS.md §4 telemetry separation, §15 acceptance

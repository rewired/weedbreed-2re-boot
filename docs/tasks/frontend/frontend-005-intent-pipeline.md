# Implement Live Intent Pipeline Coverage

**ID:** FRONT-005
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** intents, backend, api

## Rationale
UI intent handlers currently log "stub" messages, so users cannot rename zones, adjust climate, or control simulation playback. Completing the intent pipeline is essential before switching off fixtures.

## Scope
- In: Extend façade command handlers to support rename/move, climate/lighting adjustments, HR actions, pest/maintenance tasks, and simulation controls per proposal expectations.
- In: Ensure acknowledgements propagate back to the UI and update Zustand mirrors only on success.
- Out: Frontend UI redesign; telemetry emissions unrelated to intents; scenario content changes.

## Deliverables
- Updated intent routing modules (e.g. `packages/transport/src/intents/**`) with coverage for documented actions.
- Contract tests verifying commands mutate the simulation world and return success/failure responses deterministically.
- Documentation updates outlining available intents and error semantics.

## Acceptance Criteria
- Each documented UI action triggers a real backend mutation and returns an acknowledgement payload.
- Failed intents surface descriptive errors without crashing the transport server.
- Tests confirm determinism across repeated runs (same seed ⇒ same outcome).

## References
- SEC §§4–5 (intent semantics)
- DD §5 (control workflows)
- Root `AGENTS.md` §4 (command vs telemetry separation)

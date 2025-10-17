# Telemetry Loop Integration

**ID:** 2100
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, telemetry, playback

## Rationale
The engine run loop must drive the transport playback controller to emit live telemetry, replacing the stubbed socket reconnect errors observed today.

## Scope
- In: connect engine tick progression to the transport playback controller, ensuring deterministic scheduling.
- In: validate playback loop respects pause/resume controls exposed via intents.
- Out: frontend store updates (Phase 4) and intent handlers (Phase 3).
- Out: changes to telemetry payload schemas (covered by other tasks).
- Rollback: restore previous loop wiring and disable new hooks.

## Deliverables
- Updated playback controller wiring linking engine ticks to transport emission.
- Unit/integration tests verifying tick advancement triggers telemetry dispatch.
- CHANGELOG note summarising telemetry loop integration.

## Acceptance Criteria
- ≤3 source files (plus tests) modified; total diff ≤150 lines.
- Playback controller receives deterministic tick cadence (1 tick = 1 in-game hour) and respects pause state.
- Tests (1–3) confirm telemetry dispatch occurs within one iteration after tick advancement.
- No new dependencies introduced; use existing scheduler utilities.
- Tests to add/modify: 2 integration tests around playback loop.

## References
- SEC §1 tick pipeline, §4 telemetry
- TDD §5 transport playback
- Root AGENTS.md §2 determinism, §4 telemetry bus guidance

# Telemetry Buffer Drain

**ID:** 2120
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** backend, telemetry

## Rationale
Pending telemetry buffers should flush deterministically to avoid memory leaks and delayed UI updates once live playback is enabled.

## Scope
- In: audit pendingTelemetry handling and ensure buffers drain on connection establishment and reconnection.
- In: add metrics/logging hooks for buffer length under debug builds.
- Out: frontend socket handling (Phase 4) and intent logic (Phase 3).
- Out: addition of observability infrastructure beyond simple logging counters.
- Rollback: revert buffer management changes to previous behavior.

## Deliverables
- Updated telemetry binder/controller logic ensuring buffers flush within one tick post connection.
- Unit tests verifying buffer drain on initial connect and reconnect scenarios.
- CHANGELOG note summarizing buffer drain fix.

## Acceptance Criteria
- ≤3 source files (plus tests) modified; ≤150 diff lines.
- Buffer length is zero after connect/reconnect in deterministic tests.
- Added logging guarded by debug flag to avoid noisy production output.
- Tests to add/modify: 2 unit tests (initial connect, reconnect flush).
- No new dependencies introduced.

## References
- SEC §4 telemetry bus behavior
- TDD §5 telemetry buffering
- Root AGENTS.md §4 telemetry guidance

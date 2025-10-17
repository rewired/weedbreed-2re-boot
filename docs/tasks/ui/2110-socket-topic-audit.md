# Socket Topic Audit

**ID:** 2110
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, telemetry, qa

## Rationale
Ensuring Socket.IO namespaces emit the full set of telemetry topics (tick, zone, workforce, harvest) prevents UI regressions and reconnect loops.

## Scope
- In: audit current telemetry topics and expand the publisher to include missing tick/zone/workforce/harvest events.
- In: document topic schemas and register them in a schema validation utility.
- Out: frontend subscription updates (Phase 4).
- Out: intent acknowledgement changes (Phase 3).
- Rollback: revert topic registration changes and restore previous publisher state.

## Deliverables
- Updated telemetry publisher module emitting required topics with schema validation.
- Unit tests asserting emission of each topic on deterministic tick data.
- Documentation update referencing topic coverage (CHANGELOG or docs/telemetry).

## Acceptance Criteria
- ≤3 source files (plus tests) modified; total diff ≤150 lines.
- Publisher emits deterministic payloads validated against schema definitions.
- Tests (1–3) confirm each topic fires when expected and fails if schema violated.
- No new dependencies added.
- Tests to add/modify: 3 unit tests (tick, zone, workforce topics).

## References
- SEC §4 telemetry topics
- TDD §5 transport telemetry
- Root AGENTS.md §4 telemetry bus guidance

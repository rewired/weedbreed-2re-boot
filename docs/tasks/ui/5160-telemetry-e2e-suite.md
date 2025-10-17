# Telemetry E2E Suite

**ID:** 5160
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** testing, telemetry

## Rationale
End-to-end telemetry tests ensure Socket.IO topics and UI bindings remain synchronized after live data wiring.

## Scope
- In: create e2e tests (Playwright or equivalent) that start façade + UI, simulate ticks, and verify dashboard updates.
- In: reuse deterministic loader seed to keep outputs stable.
- Out: performance/load testing.
- Out: infrastructure changes beyond necessary scripts.
- Rollback: remove e2e suite and revert scripts if failures occur.

## Deliverables
- E2E test script verifying telemetry topics (tick, zone, workforce) propagate to UI controls.
- Supporting fixtures/scripts for launching façade and UI in test mode.
- CHANGELOG note referencing telemetry e2e coverage.

## Acceptance Criteria
- ≤3 files touched (test script + config + doc) with ≤150 diff lines.
- Test asserts telemetry-driven UI changes within deterministic tick count.
- Test validates schema compliance using definitions from Task 2130.
- Tests to add/modify: 1 e2e test.

## References
- SEC §4 telemetry
- TDD §5 e2e coverage
- Root AGENTS.md §4 telemetry guidance

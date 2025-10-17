# Read-Model Test Harness

**ID:** 5150
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** testing, read-model

## Rationale
Automated tests must verify read-model hydration outputs and transport clients to prevent regressions once live data wiring is complete.

## Scope
- In: add unit/integration tests exercising read-model providers and transport clients using deterministic loader seeds.
- In: include golden snapshots or hashes within tolerances defined by SEC.
- Out: UI component tests (handled in Phase 4).
- Out: new dependencies or CI pipelines.
- Rollback: remove new tests and fixtures if instability arises.

## Deliverables
- Vitest suites covering structure/room/zone/workforce/economy read-model hydration.
- Fixture data or serialized snapshots stored under tests/resources.
- CHANGELOG note referencing test harness introduction.

## Acceptance Criteria
- ≤3 test files added/updated; ≤150 diff lines.
- Tests cover at least two deterministic seeds and compare outputs within EPS_REL 1e-6.
- Transport client mocked responses validated against schema definitions from Task 2130.
- Tests to add/modify: 3 integration/unit tests.

## References
- SEC §2–§7 data expectations
- TDD §4 read-model testing
- Root AGENTS.md §2 determinism, §15 acceptance

# Intent Regression Suite

**ID:** 5170
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** testing, intents

## Rationale
Automated regression tests for intent flows ensure rename/move/environment/workforce commands remain stable and acknowledged correctly.

## Scope
- In: add unit/integration tests covering command handlers introduced in Phase 3 with deterministic seeds and mocked transport.
- In: verify acknowledgements propagate expected payloads and errors.
- Out: UI-level intent tests (handled elsewhere).
- Out: new dependencies.
- Rollback: remove regression tests and fixtures.

## Deliverables
- Vitest suites for rename/move, environment adjustments, workforce/maintenance, and simulation control intents.
- Fixtures for sample intent payloads referencing deterministic world IDs.
- CHANGELOG note referencing intent regression coverage.

## Acceptance Criteria
- ≤3 test files touched; ≤150 diff lines.
- Tests cover success and failure cases for each intent category with deterministic assertions.
- Tests assert acknowledgements include correlation IDs and status codes defined in TDD.
- Tests to add/modify: 3 integration tests.

## References
- SEC §4 intent contracts
- TDD §6 command handling tests
- Root AGENTS.md §§4, 13

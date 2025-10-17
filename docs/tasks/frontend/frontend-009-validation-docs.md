# Validate Live Wiring & Update Documentation

**ID:** FRONT-009
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** testing, documentation, qa

## Rationale
Switching from fixtures to live data introduces regression risk. We need a focused validation task to cover automated tests, manual smoke plans, and required documentation updates (CHANGELOG, ADR) once wiring is complete.

## Scope
- In: Add end-to-end and unit tests for read-model hydration, telemetry streaming, intent handling, and UI selectors.
- In: Draft or update ADRs/CHANGELOG entries capturing the shift to live data and any contract decisions.
- Out: Implementing fixes beyond what's needed to make tests pass; creating new product features.

## Deliverables
- Test suites or scripts (e.g. `packages/ui/tests/**`, `packages/transport/tests/**`) covering the live data flows.
- Manual QA checklist recorded in task notes.
- Updated `docs/CHANGELOG.md` and ADR entry documenting the live wiring milestone.

## Acceptance Criteria
- Automated test runs cover critical live data paths and pass deterministically in CI.
- Manual smoke checklist executed against dev stack with results logged.
- Documentation updated and linked in the task completion notes.

## References
- SEC §0.1 (deterministic requirements)
- TDD §4 (testing expectations)
- Root `AGENTS.md` §15 (acceptance criteria)

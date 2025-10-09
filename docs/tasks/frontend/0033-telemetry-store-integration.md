# Telemetry Store Integration Tests

**ID:** 0033
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, telemetry, tests, track-3

## Rationale
After wiring the binder, we need integration tests ensuring telemetry events propagate into the UI store and update selectors consumed by pages. This guards regressions before UI wiring is completed.

## Scope
- In: create integration tests that mount the store + binder with mocked socket client and assert selectors update for each topic.
- In: verify connection status events surface to UI consumers (e.g., connection banner hook).
- Out: visual UI updates (covered elsewhere).

## Deliverables
- `packages/ui/src/state/__tests__/telemetryIntegration.test.tsx` using React Testing Library to mount provider + binder.
- Mock helpers for socket client events under `packages/ui/src/test-utils/socketMock.ts`.

## Acceptance Criteria
- Tests emit each telemetry topic and assert selectors return updated values.
- Connection loss triggers status flag within store and resets to defaults on reconnect.
- Unknown topics do not mutate state; test asserts store remains unchanged.

## References
- [Proposal §3](../../proposals/20251009-mini_frontend.md#3-architectural-contracts)
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [TDD §9](../../TDD.md#9-integration-testing-guidelines)

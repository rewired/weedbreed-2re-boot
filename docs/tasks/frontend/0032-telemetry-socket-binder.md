# Telemetry Socket Binder

**ID:** 0032
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, telemetry, transport, track-3

## Rationale
With store slices defined, the UI needs a binder that connects to the `/telemetry` namespace, subscribes to four topics, and dispatches updates deterministically. This task builds the socket client plumbing and reconnection policy described in the proposal.

## Scope
- In: implement `packages/ui/src/transport/telemetryBinder.ts` using `socket.io-client`, handling connect/disconnect and exponential backoff.
- In: register handlers for the four telemetry topics, dispatching to the store actions from Task 0031.
- In: surface a minimal event emitter for components to listen for heartbeat/connection status.
- Out: UI integration tests (handled next) or intent handling.

## Deliverables
- Telemetry binder module + index export.
- `packages/ui/src/transport/__tests__/telemetryBinder.test.ts` using mocked Socket.IO client to assert subscriptions and reconnection behaviour.
- Update `packages/ui/src/App.tsx` (or root provider) to initialise the binder at boot with configurable base URL.

## Acceptance Criteria
- Binder connects to `/telemetry`, listens for `telemetry:event`, and routes payloads based on `topic` string.
- Reconnect policy implements exponential backoff with jitter capped per proposal risk mitigations.
- Tests verify handler registration, dispatch invocation per topic, and that inbound telemetry with unknown topics is ignored with a logged warning.

## References
- [Proposal §3](../../proposals/20251009-mini_frontend.md#3-architectural-contracts)
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §8](../../proposals/20251009-mini_frontend.md#8-risks-mitigations)

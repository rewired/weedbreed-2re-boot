# Transport Server Bootstrap

**ID:** 0020
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, transport, track-1

## Rationale
The transport slice must expose dedicated telemetry and intent namespaces with a health endpoint before any clients can hydrate or emit intents. Wiring the façade HTTP server to the Socket.IO adapter early unblocks later tracks that depend on stable URLs and namespaces defined in the proposal.

## Scope
- In: create façade-side HTTP server factory with `/healthz` route and Socket.IO namespaces (`/telemetry`, `/intents`).
- In: surface minimal server options (CORS, origins) required for local dev bootstrap.
- Out: business logic for read-model handlers, telemetry publishing, or intent processing beyond invoking the provided callback.

## Deliverables
- `packages/facade/src/transport/server.ts` standing up the HTTP server and binding `createSocketTransportAdapter`.
- `packages/facade/tests/integration/transport/serverNamespaces.spec.ts` covering namespace registration and health response.
- New `docs/tools/dev-stack.md` note describing how to launch the façade transport server locally.

## Acceptance Criteria
- Creating the server returns references to `/telemetry` and `/intents` namespaces and a `close()` helper.
- `GET /healthz` responds with HTTP 200 and `{status:"ok"}`.
- Integration test asserts that custom CORS origin configuration is accepted and telemetry namespace rejects inbound emits by default (no handler registered yet).
- Documentation explains the pnpm script (or command sequence) to start the transport server and the expected port configuration.

## References
- [Proposal §3](../../proposals/20251009-mini_frontend.md#3-architectural-contracts)
- [Proposal §5](../../proposals/20251009-mini_frontend.md#5-thin-transport-slice-mvp-wiring)
- [SEC §1](../../SEC.md#1-core-invariants-guardrails)
- [TDD §11](../../TDD.md#11-telemetry-read-only-transport-separation-sec-11)

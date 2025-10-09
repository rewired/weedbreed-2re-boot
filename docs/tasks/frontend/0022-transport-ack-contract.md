# Transport Ack Contract Publication

**ID:** 0022
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, transport, contracts, track-1

## Rationale
The UI and intent flows require a single source of truth for transport acknowledgements and error codes. Publishing typed helpers and documentation ensures both sides agree on the ack payload structure ahead of telemetry and intent wiring.

## Scope
- In: factor shared `TransportAck`/error-code definitions into a dedicated module that can be imported by façade, UI, and tests.
- In: add lightweight runtime guard (e.g., zod or manual predicate) to validate incoming ack payloads on the client side.
- Out: UI usage of the guard (covered by later tracks) or backend business logic for handling intents.

## Deliverables
- `packages/transport-sio/src/contracts/ack.ts` exporting error-code registry, ack types, and a `assertTransportAck` (or similar) runtime validator.
- Re-export hook in `packages/facade/src/transport/adapter.ts` so downstream packages consume the new module.
- `docs/constants/transport-error-codes.md` describing codes and linking back to SEC proposal sections.

## Acceptance Criteria
- Module exports a frozen error-code map containing at least `WB_TEL_READONLY`, `WB_INTENT_INVALID`, `WB_INTENT_CHANNEL_INVALID`, `WB_INTENT_HANDLER_ERROR`.
- Validator throws (or returns false) when ack payloads violate the contract; unit tests cover positive/negative cases.
- Existing transport adapter compiles against the new module without duplicating constants.
- Documentation lists the codes, describes when they surface, and references SEC/TDD clauses.

## References
- [Proposal §3](../../proposals/20251009-mini_frontend.md#3-architectural-contracts)
- [Proposal §5](../../proposals/20251009-mini_frontend.md#5-thin-transport-slice-mvp-wiring)
- [SEC §1](../../SEC.md#1-core-invariants-guardrails)
- [TDD §11](../../TDD.md#11-telemetry-read-only-transport-separation-sec-11)

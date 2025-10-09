# Intent Error Dictionary & Client

**ID:** 0034
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, intents, transport, track-5

## Rationale
Intent flows rely on deterministic ack handling and human-readable error messaging. Establishing a shared client for intent submission and an error dictionary ensures consistent UX across exemplar forms.

## Scope
- In: create `packages/ui/src/transport/intentClient.ts` that emits `intent:submit`, handles acks using the contract from Task 0022, and exposes typed results.
- In: define centralized error dictionary mapping transport codes to localized messages and recommended user actions.
- Out: specific form components (handled by follow-up tasks).

## Deliverables
- Intent client module with unit tests under `packages/ui/src/transport/__tests__/intentClient.test.ts` covering success, handler error, invalid payload, and telemetry misuse scenarios.
- `packages/ui/src/intl/intentErrors.ts` (or similar) exporting dictionary + helper for toast copy.
- Documentation snippet in `docs/tools/intent-playground.md` describing how to use the client in dev (curl/socket script).

## Acceptance Criteria
- Client rejects attempts to submit without ack handler and maps error codes to dictionary entries.
- Dictionary covers at least `WB_TEL_READONLY`, `WB_INTENT_INVALID`, `WB_INTENT_CHANNEL_INVALID`, `WB_INTENT_HANDLER_ERROR` with actionable text.
- Tests verify ack parsing uses the validator from Task 0022 and surfaces dictionary messages.

## References
- [Proposal §3](../../proposals/20251009-mini_frontend.md#3-architectural-contracts)
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §5](../../proposals/20251009-mini_frontend.md#5-thin-transport-slice-mvp-wiring)

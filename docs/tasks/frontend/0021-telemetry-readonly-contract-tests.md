# Telemetry Read-only Contract Tests

**ID:** 0021
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, transport, tests, track-1

## Rationale
Read-only enforcement on the telemetry namespace is a hard contract in SEC and the proposal. Adding focused contract tests ensures regressions are caught before UI integration and provides fixtures for later telemetry binder work.

## Scope
- In: write integration tests against `createSocketTransportAdapter` verifying that telemetry emits are rejected with `WB_TEL_READONLY` and that no handler is invoked.
- In: add fixtures ensuring the intents namespace still accepts `intent:submit` when payload is valid.
- Out: UI-side handling of these errors or documentation updates (covered by other tasks).

## Deliverables
- `packages/transport-sio/tests/integration/telemetryReadonly.spec.ts` covering negative cases and ack expectations.
- Updates to existing vitest config if needed to run the new integration suite.

## Acceptance Criteria
- Tests assert that any client emit on `/telemetry` (with or without ack) yields `WB_TEL_READONLY` and does not call the provided handler.
- Tests confirm that `/intents` continues to resolve valid submissions with `{ok:true}` and rejects malformed payloads with `WB_INTENT_INVALID`.
- The new test suite runs via `pnpm --filter @wb/transport-sio test` without additional manual wiring.

## References
- [Proposal §3](../../proposals/20251009-mini_frontend.md#3-architectural-contracts)
- [Proposal §5](../../proposals/20251009-mini_frontend.md#5-thin-transport-slice-mvp-wiring)
- [SEC §1](../../SEC.md#1-core-invariants-guardrails)
- [TDD §11](../../TDD.md#11-telemetry-read-only-transport-separation-sec-11)

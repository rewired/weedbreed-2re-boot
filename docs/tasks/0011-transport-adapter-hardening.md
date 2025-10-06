# Transport Adapter Hardening

**ID:** 0011  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P1  
**Tags:** backend, transport, tests, docs

## Rationale
The transport adapter must enforce telemetry read-only semantics and separate intent channels per [SEC §11.3 Transport Policy](../SEC.md#113-transport-policy) and [SEC §1 Core Invariants](../SEC.md#1-core-invariants-guardrails). [TDD §11](../TDD.md#11-telemetry-read-only-transport-separation-sec-11) prescribes contract tests, and [AGENTS §2/§4](../../AGENTS.md#2-core-invariants-mirror-sec-1) reiterate determinism and channel separation. We must harden the adapter with negative tests and updated docs.

## Scope
- Include: enforce read-only telemetry channel, separate intents, adapter-level rejection of inbound telemetry writes.
- Include: negative tests covering malformed payloads, channel misuse, and failure modes.
- Include: documentation updates describing adapter contracts.
- Out of scope: supporting new transport protocols beyond Socket.IO/SSE baseline; UI changes.

## Deliverables
- Hardened transport adapter implementation with explicit channel separation and guards.
- Contract tests covering successful subscriptions, rejected telemetry writes, and intent routing.
- Documentation updates (SEC/TDD or dedicated adapter doc) outlining usage and rejection rules; CHANGELOG entry.

## Implementation Steps
1. Review adapter implementation to ensure telemetry sockets are receive-only and intents use separate namespace/channel.
2. Add guards rejecting telemetry writes, malformed payloads, and unauthorized channel usage with deterministic error codes.
3. Expand test suite with contract tests (unit/integration) covering positive and negative cases, referencing TDD guidance.
4. Update documentation describing adapter contract and add CHANGELOG note; ensure README/SEC cross-links.

## Acceptance Criteria / DoD
- Telemetry channel rejects all inbound messages; tests assert failure responses and no state mutation.
- Intent channel continues to accept validated commands; tests cover separation and no cross-leakage.
- Documentation updated with contract details and referenced in SEC/TDD; CHANGELOG records hardening.
- Negative tests executed in CI to guard regressions.

## Tests
- Unit tests: adapter guard functions, payload validators.
- Integration tests: `packages/facade/tests/integration/transport/telemetryReadonly.spec.ts` and new negative tests verifying separation.
- CI: pnpm test suite ensures transport tests run; optional contract test stage in CI pipeline.

## Affected Files (indicative)
- `packages/facade/src/transport/adapter.ts`
- `packages/facade/tests/integration/transport/telemetryReadonly.spec.ts`
- `packages/facade/tests/integration/transport/intentRouting.spec.ts`
- `docs/SEC.md` ([§11.3](../SEC.md#113-transport-policy))
- `docs/TDD.md` ([§11](../TDD.md#11-telemetry-read-only-transport-separation-sec-11))
- `AGENTS.md` ([§2](../../AGENTS.md#2-core-invariants-mirror-sec-1))
- `docs/CHANGELOG.md`

## Risks & Mitigations
- **Risk:** Breaking existing clients. **Mitigation:** Document contract clearly and provide integration test fixtures for clients.
- **Risk:** Error handling introduces nondeterminism. **Mitigation:** Use deterministic error codes/messages and unit tests.
- **Risk:** Test flakiness due to async behaviour. **Mitigation:** Use deterministic fakes/mocks and ensure timeouts controlled.

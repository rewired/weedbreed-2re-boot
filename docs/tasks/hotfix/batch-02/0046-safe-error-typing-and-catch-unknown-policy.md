# Safe error typing and catch policy

**ID:** 0046
**Status:** Planned
**Owner:** unassigned
**Priority:** P0
**Tags:** engine, safety

## Rationale
Unsafe `any` and error flows in engine utilities and telemetry violate `use-unknown-in-catch`, `no-unsafe-argument`, and the proposal’s catch policy, risking unhandled telemetry payloads.
Standardizing `catch (unknown)` handling prevents accidental error leakage and enforces typed return paths.

## Scope
- In: Engine modules cited in the proposal (e.g., `util/photoperiod.ts`, `physiology/vpd.ts`, telemetry emitters) plus any shared helpers that accept raw errors.
- Out: Broad redesign of telemetry systems, transport protocol changes, or adding new runtime features.

## Deliverables
- Update try/catch blocks to capture `unknown`, normalize to `Error` objects, and avoid returning raw error values.
- Guard all telemetry payload construction, ensuring unsafe `any` inputs are validated or stringified before emission.
- Document the safety policy in CHANGELOG or developer docs if required.

## Acceptance Criteria
- Lint rules `@typescript-eslint/use-unknown-in-catch-callback-variable` and `@typescript-eslint/no-unsafe-argument` pass for the touched modules.
- No function returns raw `error`/`any` objects; tests confirm thrown errors are handled appropriately.
- Telemetry and safety-related unit/integration tests remain green.

## References
- [HOTFIX‑042 §2.6 — Unsafe any/error handling](../../../proposals/20251009-hotfix-batch-02.md#26-unsafe-anyerror-no-unsafe-argument-use-unknown-in-catch-callback-variable)
- [AGENTS.md §2 — Core Invariants & Telemetry Guardrail](../../../../AGENTS.md#2-core-invariants-mirror-sec-%C2%A71)

# Facade transport promise and async safety

**ID:** 0051
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** facade, transport

## Rationale
Facade transport modules violate `require-await`, `no-misused-promises`, and safe catch handling, risking unawaited handlers and swallowed errors.
Enforcing async safety ensures deterministic telemetry and transport behavior per the hotfix.

## Scope
- In: Façade transport server/adapter files and tests cited in the proposal to add awaits, correct promise handling, and `catch (unknown)` normalization.
- Out: Reworking transport protocols, adding new endpoints, or modifying UI client behavior.

## Deliverables
- Update async functions to await promises or convert to synchronous functions where appropriate.
- Fix lint issues around promise misuse and ensure `catch` blocks enforce the unknown-to-Error policy.
- Adjust façade transport tests accordingly and document in CHANGELOG if behavior is externally visible.

## Acceptance Criteria
- Lint rules `require-await`, `no-misused-promises`, and catch safety checks pass for façade transport code.
- Transport integration tests remain green, confirming no regressions in message flow.
- No new lint warnings introduced by the changes.

## References
- [HOTFIX‑042 §4 — File-Specific Notes (facade/transport)](../../../proposals/20251009-hotfix-batch-02.md#4-file-specific-notes-non-exhaustive-prioritized)
- [AGENTS.md §4 — Telemetry bus ≠ command bus](../../../../AGENTS.md#4-world-model--placement-sec-%C2%A71-1)

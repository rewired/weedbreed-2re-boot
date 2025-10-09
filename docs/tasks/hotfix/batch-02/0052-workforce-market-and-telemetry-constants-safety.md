# Workforce market and telemetry safety

**ID:** 0052
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** workforce, constants, telemetry

## Rationale
Workforce modules still inline probability literals, misuse optional chaining, and pass unsafe telemetry payloads, all called out in the proposal.
Hoisting constants and sanitizing telemetry is required to meet lint budgets and maintain observability integrity.

## Scope
- In: Workforce market, raises, telemetry emitters, and related helpers/tests mentioned in the proposal.
- Out: Introducing new workforce features, changing economic balancing, or modifying unrelated engine subsystems.

## Deliverables
- Hoist repeated workforce probability literals to named constants (global or local with JSDoc).
- Fix optional chaining/nullish misuse and ensure telemetry emitters guard inputs and use safe template formatting.
- Update documentation/CHANGELOG and relevant tests to reflect the constant centralization and telemetry guards.

## Acceptance Criteria
- Workforce files pass lint with zero `no-magic-numbers`, optional chaining, or telemetry safety violations.
- Telemetry payloads are constructed from validated data types, satisfying `no-unsafe-argument` and related rules.
- Workforce unit/integration tests remain deterministic and green.

## References
- [HOTFIX‑042 §2.1/§2.2/§2.6 — Workforce notes](../../../proposals/20251009-hotfix-batch-02.md#4-file-specific-notes-non-exhaustive-prioritized)
- [SEC v0.2.1 §2 — Ordered tick pipeline](../../../SEC.md#2-core-invariants)
- [AGENTS.md §5 — Data Contracts & Price Separation](../../../../AGENTS.md#5-data-contracts--price-separation-sec-%C2%A73)

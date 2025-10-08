# ADR-0021 — Economy Units Guardrails

## Status
Accepted — 2025-10-07

## Context
SEC §3.6 mandates per-hour monetary units and forbids `*_per_tick` rates. Contributors were repeatedly landing monetary fields or identifiers with tick-based units because no automated guardrail existed. Linting only for duplicate constants did not surface the issue early, and manual reviews could miss violations, especially in JSON fixtures and new TypeScript modules.

## Decision
- Added a dedicated ESLint rule `wb-sim/no-economy-per-tick` that rejects identifiers/strings containing `*_per_tick` whenever the token looks monetary (cost, price, wage, tariff, etc.).
- Covered the rule with `packages/engine/tests/unit/economy/noEconomyPerTickRule.test.ts` so contributors see a clear error message and we avoid regressions when adjusting the keyword set.
- Documented the guardrail in `docs/TDD.md` and referenced it in the changelog so future contract updates know a lint rule and tests must be updated in lockstep.
- Explicitly allow `_per_tick` for physical telemetry/process metrics (e.g. `ppm_per_tick`, `humidity_change_per_tick`) to avoid blocking legitimate device or sensor fields.

## Consequences
- Monetary naming violations now fail fast during linting/CI and include actionable messages.
- New monetary fields must use per-hour (or other SEC-approved) units, reducing churn in later reviews.
- When expanding the monetary keyword list or renaming fields, teams must update the unit test snapshots accordingly to keep coverage in sync.

# ADR-0001: Canonical simulation constants alignment

## Status
Accepted

## Context
The Simulation Engine Contract (SEC v0.2.1 §1.2) and downstream design documentation already specify the canonical geometry and calendar constants the engine must honor, notably `AREA_QUANTUM_M2 = 0.25` and `ROOM_DEFAULT_HEIGHT_M = 3`. The same values are reiterated in the Design Document (DD §2), Testing & Diagnostics Document (TDD §1), AGENTS guardrails (§3), and the product vision (VISION_SCOPE §15). Without an Architecture Decision Record, the alignment only existed as repeated prose, and tooling proposals have begun to drift—`tasks.json` still advertises an exporter contract with `AREA_QUANTUM_M2 = 0.5`, contradicting the SEC baseline.

## Decision
- Affirm the SEC-defined canonical constants as normative for the entire stack:
  - `AREA_QUANTUM_M2 = 0.25`
  - `ROOM_DEFAULT_HEIGHT_M = 3`
  - Calendar invariants `HOURS_PER_DAY = 24`, `DAYS_PER_MONTH = 30`, `MONTHS_PER_YEAR = 12`
- Record the precedence order for simulation constants in this ADR to mirror the documentation contract hierarchy (SEC → DD → TDD → AGENTS → VISION_SCOPE) and ensure any change flows through all affected documents and the shared `simConstants` module.
- Flag the legacy exporter specification advertising `AREA_QUANTUM_M2 = 0.5` for correction so downstream integrations are updated alongside the SEC-aligned constants.

## Consequences
- Future modifications to canonical constants require updating this ADR plus the SEC/DD/TDD/AGENTS/VISION_SCOPE documents to preserve the documented precedence chain.
- Tooling that assumed the `0.5 m²` area quantum must be adjusted to the `0.25 m²` baseline; export contracts and fixtures should align with the shared `simConstants` definitions.
- The documentation set now has an authoritative historical record for why these constants are fixed, reducing the risk of silent drift across specs, code, and integrations.
- The repository must expose the canonical constants exclusively through `src/backend/src/constants/simConstants.ts`, with linting guardrails preventing redeclarations elsewhere.

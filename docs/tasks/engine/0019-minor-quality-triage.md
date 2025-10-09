# Minor Quality Triage — Typo, Logic, Documentation, and Test Follow-ups

**Author:** gpt-5-codex (automation)
**Date:** 2025-02-15

This note captures four lightweight follow-up tasks discovered while reviewing the codebase. Each section outlines the observed problem, the impacted artifact, and a concrete recommendation so the owning team can prioritise remediation work.

## 1. Typo: `aswell` in SEC migration guidance
- **Location:** `docs/SEC.md`, migration notes list (line 644).
- **Issue:** The guidance about tariff overrides spells "`energyPriceOverride`aswell" (missing space and misspelt "as well"), which leaks into downstream references that quote SEC verbatim.
- **Recommendation:** Replace `aswell` with `as well` (and insert the missing space after ``energyPriceOverride``) to keep the contract language professional and eliminate confusion in derived documentation.

## 2. Logic bug: `createCo2InjectorStub` clamps misreport
- **Location:** `packages/engine/src/backend/src/stubs/Co2InjectorStub.ts`, final return block (lines 175–191).
- **Issue:** `clampedByTarget` is set to `requestedDelta_ppm > FLOAT_TOLERANCE`, so any positive request—even when fully satisfied—reports that the injector was target-clamped. Consumers relying on this flag (e.g., telemetry dashboards or diagnostics) cannot distinguish between "met target" and "could not reach target" states.
- **Recommendation:** Derive `clampedByTarget` by comparing the requested delta with the deliverable output (e.g., `requestedDelta_ppm > deliverable_ppm + FLOAT_TOLERANCE`). Update the corresponding branch in the zero-delivery case to use the same predicate. Add unit coverage proving the flag only flips when the target headroom—not the command—limits delivery.

## 3. Documentation inconsistency: ADR still claims Node.js 23+ target
- **Location:** `docs/ADR/ADR-0012-node-version-tooling-alignment.md`, Context section (lines 16–23).
- **Issue:** The ADR notes that Node.js 22 LTS is now standard, yet the Context paragraph still says "The monorepo targets Node.js 23+ in production and CI". This contradicts the status note and misleads readers auditing tooling requirements.
- **Recommendation:** Update the Context to reflect the current baseline (Node.js 22 LTS) or explicitly mark the historical statement as superseded so onboarding docs stay consistent with AGENTS and package metadata.

## 4. Test coverage gap: `createEngineBootstrapConfig`
- **Location:** `packages/engine/tests/unit/createEngineBootstrapConfig.test.ts` (entire file).
- **Issue:** The spec only exercises the default tariff path and the empty scenario guard. We do not assert that difficulty-specific overrides (e.g., `hard` difficulty using `energyPriceFactor`/`energyPriceOverride`) are honoured or that the internal cache maintains referential stability.
- **Recommendation:** Extend the test suite with cases that (a) request a difficulty ID defined in `data/configs/difficulty.json` and assert the resolved tariffs match the overrides, and (b) call `createEngineBootstrapConfig` twice with the same difficulty to confirm the cached tariffs object is reused. This protects against regressions in the tariff resolver and caching logic.

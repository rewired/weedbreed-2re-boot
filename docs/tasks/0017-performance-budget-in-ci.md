# Performance Budget in CI

**ID:** 0017
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P2  
**Tags:** backend, performance, ci, tests

## Rationale
Performance targets require ≥1 tick/s and memory bounds per [VISION_SCOPE §3 Success Criteria](../VISION_SCOPE.md#3-success-criteria). [TDD Tick Pipeline](../TDD.md#tick-pipeline-canonical-9-phases) and perf harness guidance (`withPerfHarness`, `generateSeedToHarvestReport`) specify measurement tooling, and [TDD §0 Principles](../TDD.md#0-principles) emphasises golden perf checks. We must wire CI gates enforcing ≥5k ticks/min headless throughput and heap plateau <64 MiB per 10k ticks as stated in the prompt.

## Scope
- Include: implement performance harness invocation in CI measuring ticks/min and heap usage for reference scenario.
- Include: define regression thresholds and failure policy (warn vs fail) documented in repo.
- Include: update documentation referencing perf budget enforcement.
- Out of scope: micro-optimisations beyond meeting the documented thresholds; UI performance.

## Deliverables
- Perf harness script (pnpm task) executing headless runs (≥10k ticks) capturing throughput and heap metrics.
- CI job enforcing ≥5k ticks/min and heap plateau <64 MiB per 10k ticks, failing builds on regression beyond threshold policy.
- Documentation updates (TDD, docs/engine/simulation-reporting) describing CI perf gate configuration.
- CHANGELOG entry noting the new perf budget checks.

## Implementation Steps
1. Configure perf harness invocation (`withPerfHarness`, `runTick` loops) to produce metrics for the reference scenario.
2. Implement analysis script comparing measured throughput/heap against thresholds (with allowed regressions policy) and exit codes accordingly.
3. Add CI workflow step executing the perf script on suitable hardware (or flagged job) with caching to keep runtime manageable.
4. Update documentation (TDD/perf sections, simulation-reporting doc) describing usage and thresholds; update CHANGELOG.

## Acceptance Criteria / DoD
- CI job runs perf harness in headless mode, measuring ≥10k ticks; fails if throughput <5k ticks/min or heap >64 MiB plateau.
- Threshold policy documented (e.g., percentage regression allowed or manual override procedure).
- Documentation references new pnpm command and thresholds; CHANGELOG entry added.
- Perf job integrated into CI pipeline (per branch or nightly) as agreed.

## Tests
- Automated perf run script verifying thresholds and returning exit status (can be treated as integration test); optional unit tests for threshold parser.
- Manual verification step documented for local runs (`pnpm --filter @wb/engine perf:ci`).
- CI: dedicated job executed with gating.

## Affected Files (indicative)
- `packages/engine/scripts/perf/ciPerfCheck.ts`
- `.github/workflows/ci.yml` (or equivalent)
- `docs/TDD.md` ([Tick Pipeline](../TDD.md#tick-pipeline-canonical-9-phases), [Principles](../TDD.md#0-principles))
- `docs/engine/simulation-reporting.md`
- `docs/CHANGELOG.md`
- `docs/VISION_SCOPE.md` ([§3](../VISION_SCOPE.md#3-success-criteria))

## Risks & Mitigations
- **Risk:** CI hardware variance causes flaky perf results. **Mitigation:** Use relative thresholds with guard band and collect baseline stats; allow manual override with documented procedure.
- **Risk:** Perf job lengthens CI significantly. **Mitigation:** Run on nightly or cached job, or reduce tick count while maintaining statistical confidence.
- **Risk:** Perf harness drifts from gameplay scenario. **Mitigation:** Document scenario, tie to golden master, and update together with CHANGELOG entries.

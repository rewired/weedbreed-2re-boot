ID: 0003
# Golden Master & Conformance Suite

**ID:** 0001
**Status:** Planned
**Owner:** unassigned
**Priority:** P0
**Tags:** backend, tests, ci

## Rationale

Rebuild the canonical golden master so every release can be validated against the deterministic savegame, daily hashes, and tolerance rules called out in [SEC §0.2 Reference Test Simulation](../SEC.md#02-reference-test-simulation-golden-master), [SEC §5 Determinism & RNG](../SEC.md#5-determinism--rng), and [SEC §15 Acceptance Criteria for Engine Conformance](../SEC.md#15-acceptance-criteria-for-engine-conformance). [TDD §12 Golden Master](../TDD.md#12-golden-master-sec-15) and the perf harness guidance in [docs/engine/simulation-reporting.md](../engine/simulation-reporting.md) already prescribe the artifact layout and CI hooks we must enforce.

## Scope

* Include: canonical save fixture refresh, deterministic **30-day run (720 ticks)** with per-day hashes, tolerance enforcement (`EPS_ABS`, `EPS_REL`), CI wiring for conformance suite, artifact retention linked from Appendix references.
* **Include (new):** deterministic **200-day "Soak" run (4,800 ticks)** with identical hashing/tolerance rules to validate full life-cycles (Harvest → Storage → Re-Planting) and long-run drift/stability; scheduled nightly or on demand (not on every PR).
* Include: documentation updates referencing Appendix B and artifact storage expectations.
* Out of scope: new gameplay content, scenario design changes beyond what the SEC already codifies, alternative RNG engines.

## Deliverables

* Updated or newly generated golden save fixture under `packages/engine/tests/fixtures/golden/**` with schema version metadata.
* **30-Day Conformance (PR Gate):**

  * Conformance test suite asserting 30-day deterministic run, per-day hashes, and event counts with tolerance checks.
  * Fixtures: `packages/engine/tests/fixtures/golden/30d/daily.jsonl`, `.../30d/summary.json`.
* **200-Day Soak (Nightly/On-Demand):**

  * Conformance test suite asserting 200-day deterministic run with additional lifecycle assertions (re-planting, inventory), same tolerance checks.
  * Fixtures: `packages/engine/tests/fixtures/golden/200d/daily.jsonl`, `.../200d/summary.json`.
* CI workflow or pnpm scripts invoking both suites and persisting artifacts (daily hashes, summary) to predictable output directories noted in docs (`./reporting/30d`, `./reporting/200d`).
* Documentation updates in `docs/SEC.md` Appendix references and `docs/CHANGELOG.md` describing the refreshed suite.

## Implementation Steps

1. Refresh or author the canonical save fixture to align with current schema contracts and record expected hashes/summary outputs.
2. Extend the conformance runner to emit per-day hash files plus a summary JSON, using deterministic formatting rules from SEC §0.2.3. Provide a unified API:

   ```ts
   runDeterministic({ days, seed, outDir }): Promise<{ summaryPath: string; dailyPath: string }>
   ```
3. Add or update Vitest specs under `packages/engine/tests/conformance`:

   * `goldenMaster.30d.spec.ts` executes a **30-day** run and asserts hashes/metrics with SEC tolerances.
   * **New:** `goldenMaster.200d.spec.ts` executes a **200-day** run and asserts:

     * Daily hash stability (length 200; no drift beyond tolerances).
     * **Re-Planting evidence:** count of `plant.harvested` events matches the expected re-spawn behavior for the scenario (equality if auto-replant; otherwise the documented ratio in the fixture `summary.json`).
     * **Harvest → Storage path:** inventory/lot creation events exist for harvested biomass; no orphaned harvest outputs.
     * **Lifecycle reset:** after harvest in a zone/slot, a subsequent plant appears with age ≈ 0 and a fresh UUID stream.
4. Wire pnpm tasks (engine package `package.json`):

   ```json
   {
     "scripts": {
       "test:conf:30d": "vitest run -t golden-30d",
       "test:conf:200d": "vitest run -t golden-200d"
     }
   }
   ```
5. CI:

   * PR pipeline runs **only** `pnpm --filter @wb/engine test:conf:30d` and fails on any hash drift.
   * Nightly or `workflow_dispatch` runs `pnpm --filter @wb/engine test:conf:200d`, uploads artifacts from `./reporting/200d/*` (and `./reporting/30d/*` if executed in the same job).
6. Update SEC/TDD references and CHANGELOG entries to link the artifact locations and conformance process; ensure Appendix B references point to the artifacts.

## Acceptance Criteria / DoD

* **30-Day (PR Gate):** deterministic run produces identical `daily.jsonl` (hash + telemetry counts) and `summary.json` compared to committed expectations using `EPS_ABS = 1e-9` and `EPS_REL = 1e-6` comparisons.
* **200-Day (Soak):**

  * `daily.jsonl` and `summary.json` match committed expectations under the same tolerances.
  * At least one full **Harvest → Storage → Re-Planting** cycle (or the scenario’s documented expectation) is observed and asserted.
  * No orphaned harvest outputs; inventory deltas account for harvested biomass.
  * Perf harness budget respected across the run (avg tick time and memory within TDD guidance).
* CI: PR gate (30d) enforces conformance; Nightly/On-Demand (200d) validates long-run behavior; artifacts are uploaded or stored locally with links captured in README/Appendix.
* Documentation updates explicitly reference the refreshed artifacts and the CI commands, with CHANGELOG noting the update.
* No additional gameplay or scenario data changes beyond what the SEC mandates.

## Tests

* Unit tests: hash canonicalisation helpers, tolerance comparison utilities (`packages/engine/tests/unit/util/hash.spec.ts`, `.../tolerance.spec.ts`).
* Integration tests:

  * `packages/engine/tests/integration/pipeline/runTick.trace.integration.test.ts` ensuring pipeline order.
  * Conformance specs: `packages/engine/tests/conformance/goldenMaster.30d.spec.ts` and `.../goldenMaster.200d.spec.ts` per [TDD §12](../TDD.md#12-golden-master-sec-15).
* CI gates: `test:conf:30d` on PR; `test:conf:200d` nightly/triggered. Ensure runtime stays within perf harness bounds recorded in `docs/engine/simulation-reporting.md` (5 ms avg/tick, <64 MiB heap per TDD guidance).

## Affected Files (indicative)

* `packages/engine/tests/fixtures/golden/30d/{daily.jsonl,summary.json}`
* `packages/engine/tests/fixtures/golden/200d/{daily.jsonl,summary.json}`
* `packages/engine/tests/conformance/goldenMaster.30d.spec.ts`
* `packages/engine/tests/conformance/goldenMaster.200d.spec.ts`
* `packages/engine/src/backend/src/engine/testHarness.ts`
* `docs/SEC.md` ([§0.2](../SEC.md#02-reference-test-simulation-golden-master), [§15](../SEC.md#15-acceptance-criteria-for-engine-conformance))
* `docs/TDD.md` ([§12](../TDD.md#12-golden-master-sec-15))
* `docs/CHANGELOG.md`

## Risks & Mitigations

* **Risk:** Cross-platform floating-point drift breaks hashes. **Mitigation:** Use canonical JSON ordering and SEC-defined tolerances with deterministic number formatting.
* **Risk:** CI runtime over budget for 30-day suite. **Mitigation:** Keep 30d as PR gate; move 200d to Nightly/On-Demand.
* **Risk:** Fixture rot when schema evolves. **Mitigation:** Pair fixture updates with CHANGELOG entries and migration notes; document regeneration steps in README.
* **Risk:** Long-run memory growth or GC churn in 200d. **Mitigation:** Leverage perf harness metrics and investigate retained sets if thresholds are exceeded; bisect with 100d/50d subsets if needed.

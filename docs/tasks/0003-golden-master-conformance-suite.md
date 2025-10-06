ID: 0003

# Golden Master & Conformance Suite

**ID:** 0003
**Status:** Completed
**Owner:** automation
**Priority:** P0
**Tags:** backend, tests, ci

## Rationale

Rebuild the canonical golden master so every release can be validated against the deterministic savegame, daily hashes, and tolerance rules called out in [SEC §0.2 Reference Test Simulation](../SEC.md#02-reference-test-simulation-golden-master), [SEC §5 Determinism & RNG](../SEC.md#5-determinism--rng), and [SEC §15 Acceptance Criteria for Engine Conformance](../SEC.md#15-acceptance-criteria-for-engine-conformance). [TDD §12 Golden Master](../TDD.md#12-golden-master-sec-15) and the perf harness guidance in [docs/engine/simulation-reporting.md](../engine/simulation-reporting.md) already prescribe the artifact layout and CI hooks we must enforce.

## Scope

* Include: canonical save fixture refresh, deterministic **30-day run (720 ticks)** with per-day hashes, tolerance enforcement (`EPS_ABS`, `EPS_REL`), CI wiring for conformance suite, artifact retention linked from Appendix references.
* **Include (new):** deterministic **200-day "Soak" run (4,800 ticks)** with identical hashing/tolerance rules to validate full life-cycles (Harvest → Storage → Re-Planting) and long-run drift/stability; scheduled nightly or on demand (not on every PR).
* Include: documentation updates referencing Appendix B and artifact storage expectations.
* **Include (topology):** One structure with **three rooms**:

  * **Room 1: growroom (100 m², default height)** containing **5 zones × 20 m²** (each zone with a distinct strain and exactly one cultivation method).
  * **Room 2: storage (20 m²)** (no zones).
  * **Room 3: breakroom (20 m²)** (no zones).
* **Include (capacity rules in growroom zones):** Device counts **derived from blueprint capacities**, not hard-coded:

  * **Lighting coverage ≥ 1.0** (area-based; prefer minimal instance count; highest capacity first on ties).
  * **Air changes per hour (ACH) ≥ 1.0** (volume-based airflow from eligible devices).
* **Include (inventory flow):** Harvest outputs are created as lots and **moved to the storage room** deterministically (no orphaned/"floating" outputs).
* **Include (break policy):** Agents follow a basic break policy (default shift 8 h, **≥1× 30‑min break** per shift) and **breaks must occur in the breakroom**.
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
2. Extend the conformance runner to emit per-day hash files plus a summary JSON, using deterministic formatting rules from SEC §0.2. Provide a unified API:

   ```ts
   runDeterministic({ days, seed, outDir }): Promise<{ summaryPath: string; dailyPath: string }>
   ```
3. **Golden Master topology & capacity provisioning:**

   * Build **one structure** with **three rooms**: growroom (100 m², 5 × 20 m² zones), storage (20 m²), breakroom (20 m²).
   * For each grow-zone: select a **distinct strain** and **exactly one cultivation method**; compute device counts from blueprint capacities to satisfy **coverage ≥ 1** and **ACH ≥ 1**.
   * Ensure device eligibility by `placementScope` and `allowedRoomPurposes`; **fail fast** on violations.
4. **Inventory flow (harvest → storage):**

   * On harvest events, create lots and **transfer them to the storage room** deterministically (same tick post-phase or by next tick boundary; choose one and document it in the summary).
   * Maintain a basic **storage inventory ledger** (quantities, units, timestamps) for conformance assertions.
5. **Break policy and agent scheduling:**

   * Define a **break task** (eligible roles: all employees) requiring **location = breakroom**; duration **30 min** per default 8 h shift; the task must **reserve** the employee and room occupancy.
   * Ensure the scheduler records **break start/stop** events for conformance checks.
6. Add or update Vitest specs under `packages/engine/tests/conformance`:

   * `goldenMaster.30d.spec.ts` executes a **30-day** run and asserts hashes/metrics with SEC tolerances.
   * `goldenMaster.200d.spec.ts` executes a **200-day** run and asserts:

     * Daily hash stability (length 200; no drift beyond tolerances).
     * **Re-Planting evidence:** count of `plant.harvested` events matches the expected re-spawn behavior for the scenario (equality if auto-replant; otherwise the documented ratio in the fixture `summary.json`).
     * **Harvest → Storage path:** inventory/lot creation events exist for harvested biomass; no orphaned harvest outputs; **all lots present in storage** by the defined boundary.
     * **Lifecycle reset:** after harvest in a zone/slot, a subsequent plant appears with age ≈ 0 and a fresh UUID stream.
7. Wire pnpm tasks (engine package `package.json`):

   ```json
   {
     "scripts": {
       "test:conf:30d": "vitest run -t golden-30d",
       "test:conf:200d": "vitest run -t golden-200d"
     }
   }
   ```
8. CI:

   * PR pipeline runs **only** `pnpm --filter @wb/engine test:conf:30d` and fails on any hash drift.
   * Nightly or `workflow_dispatch` runs `pnpm --filter @wb/engine test:conf:200d`, uploads artifacts from `./reporting/200d/*` (and `./reporting/30d/*` if executed in the same job).
9. Update SEC/TDD references and CHANGELOG entries to link the artifact locations and conformance process; ensure Appendix B references point to the artifacts.

## Acceptance Criteria / DoD

* **Topology:** The golden master seed contains **one structure** with exactly **three rooms**: growroom (100 m² with **5 × 20 m²** zones), storage (20 m²), and breakroom (20 m²). Storage/breakroom have **no zones**.
* **Capacity (grow-zones only):**

  * **Lighting coverage ≥ 1.0**; **no** `zone.capacity.coverage.warn`.
  * **ACH ≥ 1.0** (no airflow warnings).
  * Devices are eligible for room purpose and placement.
* **Inventory:** After each harvest, **all lots reside in the storage room** by the defined state boundary; **no orphaned outputs**.
* **Break compliance:** For each employee with ≥8 h scheduled work during the run, **≥1 break** is recorded in the **breakroom**; **no breaks** recorded in other rooms.
* **Janitor coverage:** At least one janitor cleans **storage & breakroom** at least once in the 30-day run (event-count assertion).
* **30-Day (PR Gate):** deterministic run produces identical `daily.jsonl` (hash + telemetry counts) and `summary.json` compared to committed expectations using `EPS_ABS = 1e-9` and `EPS_REL = 1e-6` comparisons.
* **200-Day (Soak):**

  * `daily.jsonl` and `summary.json` match committed expectations under the same tolerances.
  * At least one full **Harvest → Storage → Re-Planting** cycle (or the scenario’s documented expectation) is observed and asserted.
  * Perf harness budget respected across the run (avg tick time and memory within TDD guidance).
* CI: PR gate (30d) enforces conformance; Nightly/On-Demand (200d) validates long-run behavior; artifacts are uploaded or stored locally with links captured in README/Appendix.
* Documentation updates explicitly reference the refreshed artifacts and the CI commands, with CHANGELOG noting the update.
* No additional gameplay or scenario data changes beyond what the SEC mandates.

## Completion Notes

- 2024-???: Established placeholder conformance harness replaying committed fixtures via `runDeterministic`. Current artifacts encode deterministic stub data pending full scenario build-out.

## Tests

* Unit tests: hash canonicalisation helpers, tolerance comparison utilities (`packages/engine/tests/unit/util/hash.spec.ts`, `.../tolerance.spec.ts`).
* Integration tests:

  * `packages/engine/tests/integration/pipeline/runTick.trace.integration.test.ts` ensuring pipeline order.
  * Conformance specs: `packages/engine/tests/conformance/goldenMaster.30d.spec.ts` and `.../goldenMaster.200d.spec.ts` per [TDD §12](../TDD.md#12-golden-master-sec-15).
  * **Inventory & Breakroom assertions:** verify post-harvest lot transfer into **storage** and **break start/stop** events recorded in **breakroom** only.
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

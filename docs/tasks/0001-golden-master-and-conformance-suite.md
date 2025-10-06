# Golden Master & Conformance Suite

**ID:** 0001  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P0  
**Tags:** backend, tests, ci

## Rationale
Rebuild the canonical golden master so every release can be validated against the deterministic savegame, daily hashes, and tolerance rules called out in [SEC §0.2 Reference Test Simulation](../SEC.md#02-reference-test-simulation-golden-master), [SEC §5 Determinism & RNG](../SEC.md#5-determinism--rng), and [SEC §15 Acceptance Criteria for Engine Conformance](../SEC.md#15-acceptance-criteria-for-engine-conformance). [TDD §12 Golden Master](../TDD.md#12-golden-master-sec-15) and the perf harness guidance in [docs/engine/simulation-reporting.md](../engine/simulation-reporting.md) already prescribe the artifact layout and CI hooks we must enforce.

## Scope
- Include: canonical save fixture refresh, deterministic 30-day run (720 ticks) with per-day hashes, tolerance enforcement (`EPS_ABS`, `EPS_REL`), CI wiring for conformance suite, artifact retention linked from Appendix references.
- Include: documentation updates referencing Appendix B and artifact storage expectations.
- Out of scope: new gameplay content, scenario design changes beyond what the SEC already codifies, alternative RNG engines.

## Deliverables
- Updated or newly generated golden save fixture under `packages/engine/tests/fixtures/golden/*.json` with schema version metadata.
- Conformance test suite asserting 30-day deterministic run, per-day hashes, and event counts with tolerance checks.
- CI workflow or pnpm script invoking the conformance suite and persisting artifacts (daily hashes, summary) to a predictable output directory noted in docs.
- Documentation updates in `docs/SEC.md` Appendix references and `docs/CHANGELOG.md` describing the refreshed suite.

## Implementation Steps
1. Refresh or author the canonical save fixture to align with current schema contracts and record expected hashes/summary outputs.
2. Extend the conformance runner to emit per-day hash files plus a summary JSON, using deterministic formatting rules from SEC §0.2.3.
3. Add or update Vitest specs under `packages/engine/tests/conformance` to execute a 30-day run and assert hashes and metrics with the SEC tolerances.
4. Wire a CI/pnpm task (e.g., `pnpm --filter @wb/engine test:conformance`) to run the suite and publish artifacts to `/reporting` or an equivalent directory, noting them in documentation.
5. Update SEC/TDD references and CHANGELOG entries to link the artifact locations and conformance process; ensure Appendix B references point to the artifacts.

## Acceptance Criteria / DoD
- 30-day deterministic run produces identical `daily.jsonl` (hash + telemetry counts) and `summary.json` compared to committed expectations using `EPS_ABS = 1e-9` and `EPS_REL = 1e-6` comparisons.
- CI pipeline executes the conformance suite on every merge request and fails on hash drift; artifacts are uploaded or stored locally per documentation with links captured in README/Appendix.
- Documentation updates explicitly reference the refreshed artifacts and the CI command, with CHANGELOG noting the update.
- No additional gameplay or scenario data changes beyond what the SEC mandates.

## Tests
- Unit tests: hash canonicalisation helpers, tolerance comparison utilities (`packages/engine/tests/unit/util/hash.spec.ts`, `.../tolerance.spec.ts`).
- Integration tests: `packages/engine/tests/integration/pipeline/runTick.trace.integration.test.ts` ensuring pipeline order; conformance spec `tests/conformance/goldenMaster.spec.ts` executing 30-day runs per [TDD §12](../TDD.md#12-golden-master-sec-15).
- CI gates: conformance job via pnpm script; ensure runtime stays within perf harness bounds recorded in `docs/engine/simulation-reporting.md` (5 ms avg/tick, <64 MiB heap per TDD guidance).

## Affected Files (indicative)
- `packages/engine/tests/fixtures/golden/*.json`
- `packages/engine/tests/conformance/goldenMaster.spec.ts`
- `packages/engine/src/backend/src/engine/testHarness.ts`
- `docs/SEC.md` ([§0.2](../SEC.md#02-reference-test-simulation-golden-master), [§15](../SEC.md#15-acceptance-criteria-for-engine-conformance))
- `docs/TDD.md` ([§12](../TDD.md#12-golden-master-sec-15))
- `docs/CHANGELOG.md`

## Risks & Mitigations
- **Risk:** Cross-platform floating-point drift breaks hashes. **Mitigation:** Use canonical JSON ordering and SEC-defined tolerances with deterministic number formatting.
- **Risk:** CI runtime over budget for 30-day suite. **Mitigation:** Use perf harness batching and parallelisation guidance from TDD; gate execution behind targeted pnpm workspace scripts.
- **Risk:** Fixture rot when schema evolves. **Mitigation:** Pair fixture updates with CHANGELOG entries and migration notes; document regeneration steps in README.

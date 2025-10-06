# Blueprint Taxonomy v2 Loader Tests

**ID:** 0015  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P2  
**Tags:** backend, data, tests

## Rationale
Blueprint taxonomy rules are strict: [SEC §3.0.1](../SEC.md#301-blueprint-taxonomy-strict-adr-0015) and [AGENTS §5 Data Contracts](../../AGENTS.md#5-data-contracts--price-separation-sec-3) require path↔class alignment with max two directory levels. [TDD §2](../TDD.md#2-test-taxonomy--folder-layout) and [§9a](../TDD.md#9a-stub-tests--test-vectors-phase-1) emphasize loader tests. We need to harden the loader with v2 tests enforcing depth, class alignment, and fast failure.

## Scope
- Include: enforce maximum two-level directory depth, path/class alignment, and explicit error when mismatched.
- Include: loader tests covering happy path and failure cases; migration notes if taxonomy changes.
- Include: documentation updates clarifying loader behaviour.
- Out of scope: redefining taxonomy structure beyond SEC mandates.

## Deliverables
- Loader guard implementation ensuring directories deeper than two levels fail and class mismatches raise `BlueprintTaxonomyMismatchError`.
- Unit tests covering valid and invalid cases; fixtures for misplacement scenarios.
- Migration notes (if needed) in docs/CHANGELOG to guide contributors.

## Implementation Steps
1. Update loader to check directory depth and class alignment per SEC/AGENTS guidance; throw deterministic errors on violation.
2. Add unit tests enumerating valid/invalid paths, including deep nesting and mismatched class names.
3. Ensure integration tests scanning `/data/blueprints/**` enforce constraints and fail fast.
4. Update documentation/CHANGELOG to describe loader behaviour and guidance for contributors.

## Acceptance Criteria / DoD
- Loader rejects any blueprint beyond two directory levels or with path/class mismatch; tests cover each failure case.
- Valid blueprints continue to load deterministically; regression tests cover canonical directories.
- Documentation/CHANGELOG updated with loader behaviour and migration guidance.

## Tests
- Unit tests: `packages/engine/tests/unit/data/blueprintTaxonomy.spec.ts` covering depth/mismatch cases.
- Integration tests: repo-wide scan ensuring all existing blueprints comply, failing if new invalid files introduced.
- CI: pnpm test suite includes loader tests; optional lint script verifying file structure.

## Affected Files (indicative)
- `packages/engine/src/backend/src/data/blueprintLoader.ts`
- `packages/engine/tests/unit/data/blueprintTaxonomy.spec.ts`
- `/data/blueprints/**`
- `docs/SEC.md` ([§3.0.1](../SEC.md#301-blueprint-taxonomy-strict-adr-0015))
- `docs/TDD.md` ([§2](../TDD.md#2-test-taxonomy--folder-layout), [§9a](../TDD.md#9a-stub-tests--test-vectors-phase-1))
- `AGENTS.md` ([§5](../../AGENTS.md#5-data-contracts--price-separation-sec-3))
- `docs/CHANGELOG.md`

## Risks & Mitigations
- **Risk:** Existing blueprints violate rules. **Mitigation:** Audit repo and add migration notes; fix offenders before enabling guard.
- **Risk:** Loader changes break mod tooling. **Mitigation:** Document rules clearly and provide migration instructions.
- **Risk:** Tests slow due to filesystem scans. **Mitigation:** Cache directory listings and limit scope to blueprint tree.

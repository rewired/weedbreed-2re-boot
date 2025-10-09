# Save/Load and Migrations

**ID:** 0005
**Status:** Planned
**Owner:** unassigned
**Priority:** P0
**Tags:** backend, persistence, migrations, tests

## Rationale

The golden master relies on a canonical JSON savegame with schema versioning and deterministic hashes ([SEC §0.2](../SEC.md#02-reference-test-simulation-golden-master)). Migration expectations are documented in [SEC §13](../SEC.md#13-migration-notes-from-legacy-to-re-reboot), and the stability goal in [VISION_SCOPE §3 Success Criteria](../VISION_SCOPE.md#3-success-criteria) requires crash-safe saves with <1 tick data loss. We need a robust save/load pipeline with schema versioning and migration scaffolding plus backward-compat tests.

## Scope

* Include: define JSON save schema with explicit `schemaVersion`, implement crash-safe save/write mechanism, load validation, and migration scaffolding for version bumps.
* Include: regression tests ensuring older fixtures load via migrations and reproduce deterministic hashes.
* Include: **canonical repository location for saves** — default directory **`/data/savegames/`** for versioned, canonical save files used by the golden master and examples.
* Out of scope: new save formats (binary/custom) or UI save slots; scenario authoring tooling beyond schema definition.

## Deliverables

* Save/load module supporting schema versioning and atomic writes (temp file + rename) to guarantee crash safety.
* Migration scaffold (directory + API) for applying transformations between schema versions with tests.
* Backward-compat fixtures covering at least the current and prior schema versions with validation tests ensuring hash stability.
* **Default save location:** create and use **`/data/savegames/`** in-repo for canonical saves (golden master, example worlds); document naming convention (e.g., ISO-8601 timestamps).
* Documentation updates (SEC/TDD/CHANGELOG) describing the save pipeline and migration process.

## Implementation Steps

1. Formalize the save schema (TypeScript types + validation) including `schemaVersion`, metadata, and canonical ordering rules.
2. Implement crash-safe save writer (write to temp file, fsync, rename) and corresponding loader with validation.
3. Add migration registry that maps `schemaVersion` → transformer, with initial no-op migration for current version.
4. Create versioned fixtures under `packages/engine/tests/fixtures/save/` and write tests verifying load, migration, and resulting hashes against expectations.
5. **Establish `/data/savegames/`** as the default repository path for canonical saves and ensure the directory exists in the repo (added to source control as empty with a placeholder if needed).
6. Update documentation (SEC appendix note, TDD guidance) and CHANGELOG summarizing the new pipeline.

## Acceptance Criteria / DoD

* Save files include `schemaVersion`, `seed`, `simTime`, and canonical ordering; loading validates structure and rejects unknown versions without migration.
* Crash-safe write path demonstrated by tests simulating failure between write and rename (e.g., ensuring original file intact).
* Backward-compat test loads previous version fixture, runs migration, and matches expected state hash summary.
* **Default save location `/data/savegames/` is documented and used for canonical saves in-repo.**
* Documentation (SEC/TDD/CHANGELOG) updated with save/migration process and fixtures referenced.

## Tests

* Unit tests: schema validator, migration registry, crash-safe writer (mock fs interactions) under `packages/engine/tests/unit/save/*.spec.ts`.
* Integration tests: load versioned fixtures, run deterministic ticks, confirm hashes and event counts match expectations. Cover
  corrupt headers (non-numeric `schemaVersion`), missing `company.structures`, forward migration no-ops (v1→v1), and back-compat
  load of `tests/fixtures/save/v0/basic.json`.
* CI gate: conformance suite runs against migrated save to ensure deterministic behaviour remains intact.

## Affected Files (indicative)

* `packages/engine/src/backend/src/saveLoad/saveManager.ts`
* `packages/engine/src/backend/src/saveLoad/migrations/*.ts`
* `packages/engine/tests/unit/save/*.spec.ts`
* `packages/engine/tests/integration/saveLoad/*.integration.test.ts`
* `packages/engine/tests/fixtures/save/*.json`
* `data/savegames/*.json`
* `docs/SEC.md` ([§0.2](../SEC.md#02-reference-test-simulation-golden-master), [§13](../SEC.md#13-migration-notes-from-legacy-to-re-reboot))
* `docs/TDD.md` (update relevant sections)
* `docs/VISION_SCOPE.md` ([§3](../VISION_SCOPE.md#3-success-criteria))
* `docs/CHANGELOG.md`

## Risks & Mitigations

* **Risk:** Partial writes corrupt saves. **Mitigation:** Use atomic write strategy with tests simulating interruptions.
* **Risk:** Migration drift causing hash changes. **Mitigation:** Record expected hashes post-migration and run conformance suite on migrated worlds.
* **Risk:** Schema expansion complicates loader. **Mitigation:** Keep schema definitions centralized and documented; require ADR for breaking changes.

# ADR — Blueprint Taxonomy v2

- **Status:** Accepted (2025-10-06)
- **Owners:** Simulation Engine maintainers
- **Related:** SEC §3, DD §4, TDD §3

## Problem

The first-generation blueprint taxonomy nested deep directory trees and encoded subtype
semantics in the JSON `class` strings (e.g. `device.climate.cooling`,
`cultivation-method.training.sog`). Loader guardrails duplicated this path-derived logic
and tests mirrored the folder depth, making it painful to add new blueprints or
metadata. Subtype information was inferred from paths and class suffixes rather than
expressed explicitly, so downstream systems could not reason about devices or methods
without parsing strings.

## Decision

Adopt **Blueprint Taxonomy v2**:

1. Flatten `/data/blueprints` to domain-level folders with a maximum of two directory
   levels (e.g. `device/<category>/*.json`, `cultivation-method/*.json`,
   `room/purpose/*.json`).
2. Normalize JSON `class` values to domain identifiers (`strain`, `device.climate`,
   `room.purpose.<slug>`, etc.) and stop encoding subtypes in the class suffix.
3. Record subtype metadata in explicit fields (`mode`, `subtype`, `stage`, `media`,
   `family`, `technique`, `pathogen`, `speciesGroup`, `material`, `cycle`, `method`,
   `control`, `structureType`).
4. Update loaders to enforce domain↔path alignment only, keeping immutability guards, and
   refresh Zod schemas/tests to require the new metadata fields.
5. Provide migration scripts (`npm run migrate:folders`, `npm run migrate:classes`,
   `npm run migrate:blueprints`) so contributors can transition existing blueprints.

## Consequences

- Blueprint layout is consistent and shallow, making modding and diff reviews easier.
- Subtype information is explicit and validated by schemas instead of inferred from
  filesystem layout.
- Loader guardrails are simpler: they check domain alignment and immutability while
  subtype-specific validation happens inside the schema logic.
- Tests and documentation now describe domain-level classes and metadata requirements.
- Older blueprints must be migrated using the provided scripts; un-migrated content will
  fail the loader guards and Zod schemas.

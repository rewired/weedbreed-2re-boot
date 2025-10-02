# ADR-0009: Blueprint class taxonomy and validation

## Status
Accepted

## Context
Legacy blueprint JSON stored ad-hoc `kind` and `type` strings that were
neither constrained by the engine nor referenced consistently across the
simulation pipeline. As the number of blueprint families grows, loosely
typed identifiers make it difficult to validate fixtures, reason about
capabilities, or introduce class-specific parsing rules mandated by the
Simulation Engine Contract (SEC v0.2.1). Recent SEC clarifications require
a stable taxonomy that the backend can enforce when bootstrapping device
behaviour and downstream content.

## Decision
- Introduce a canonical `class` discriminator on every blueprint under
  `/data/blueprints/**` following the `<domain>.<effect>[.<variant>]`
  pattern so files can be grouped deterministically by capability.
- Remove the legacy `kind`/`type` fields from the data set and require
  kebab-case `slug` identifiers to remain unique per class.
- Extend the device blueprint schema to validate the new classes,
  mandating effect-specific fields (e.g., dehumidifiers must expose latent
  removal rates, CO₂ injectors must publish pulse parameters).
- Capture the taxonomy in SEC/DD documentation so future blueprints can
  align with the established hierarchy without reverse-engineering the
  fixtures or the validator implementation.

## Consequences
- All existing blueprint JSON files were migrated to include `class` and
  (where previously absent) `slug` attributes. Tests now parse the updated
  fixtures to ensure taxonomy compliance.
- Scenario loaders and integrations must refer to the `class` field rather
  than the removed `kind`/`type` keys. Attempting to load blueprints that
  omit class-specific settings now fails during schema validation.
- Documentation and changelog updates communicate the taxonomy to engine
  contributors, establishing a precedent for future blueprint additions
  and migrations.

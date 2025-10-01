# ISSUE-0002: Cultivation method blueprints missing SEC §7.5 required fields

## Summary
The cultivation method blueprints in `data/blueprints/cultivationMethods/` do not satisfy the strict contract from SEC §7.5. They only provide high-level metadata (e.g., `areaPerPlant`, compatible types, and defaults) and omit the mandated structured sections for container options, substrate options, irrigation compatibility, and normalized cost data.

## SEC references
- SEC §7.5 requires every cultivation method blueprint to declare planting density via `areaPerPlant_m2` and/or max plant rules, container options with acquisition + service-life policy, substrate options with pricing and density factors, irrigation compatibility, and per-hour normalized cost fields.【F:docs/SEC.md†L426-L447】
- AGENTS §5.1 mirrors the same requirements and forbids omitting these sections.【F:AGENTS.md†L99-L111】

## Affected data
- `data/blueprints/cultivationMethods/basic_soil_pot.json`
- `data/blueprints/cultivationMethods/scrog.json`
- `data/blueprints/cultivationMethods/sog.json`

Common problems:
- `areaPerPlant` uses a legacy name instead of the SEC-mandated `areaPerPlant_m2`.
- No `containers` array describing container IDs, CapEx, service life, or replacement policy.
- No `substrates` array with unit pricing and density factors.
- Missing `irrigationMethodIds`.
- No normalized recurring cost fields (per-hour) for method-specific labor/material overhead.

## Expected resolution
- Rename planting density fields to the SEC shape and add any additional density constraints as needed.
- Introduce explicit `containers` and `substrates` arrays with full economic and lifecycle metadata.
- Declare `irrigationMethodIds` for compatible irrigation methods.
- Provide per-hour recurring cost descriptors and link to price maps where applicable.

# Device blueprints module layout

This folder splits the former `deviceBlueprint.ts` monolith into focused modules.

- `schemaBase.ts` — shared schema fragments, primitive validators, and monetary guards.
- `schemaByClass.ts` — per-class refinements (`climate`, `airflow`, `lighting`, `filtration`).
- `guardTaxonomy.ts` — ensures the folder taxonomy and declared `class` stay aligned. Throw a
  `BlueprintTaxonomyMismatchError` on divergence.
- `parse.ts` — JSON→blueprint parsing plus helpers for runtime projections.

👉 **Never** add price/monetary fields here; device pricing belongs in `/data/prices/**` maps.

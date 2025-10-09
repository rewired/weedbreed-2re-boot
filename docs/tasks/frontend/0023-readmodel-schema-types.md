# Read-model Schema Types

**ID:** 0023
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, read-models, track-2

## Rationale
Typed DTOs and validators for the three MVP read models are required before wiring HTTP endpoints or hydrating the UI. Establishing these schemas prevents drift and enables reuse across façade and client code.

## Scope
- In: define TypeScript types and zod (or equivalent) validators for `companyTree`, `structureTariffs`, and `workforceView` read models.
- In: include `schemaVersion` and `simTime` metadata in each schema per proposal boot sequence.
- Out: HTTP route handlers or persistence of the data (handled by subsequent tasks).

## Deliverables
- `packages/facade/src/readModels/api/schemas.ts` exporting types and validators.
- `packages/facade/tests/unit/readModels/schemas.spec.ts` covering positive/negative validation cases.
- New `docs/constants/read-model-schemas.md` listing schema identifiers and linking back to the proposal.

## Acceptance Criteria
- Validators ensure required fields match the proposal shapes including nested structures.
- Schemas expose string literal `schemaVersion` fields and numeric `simTime` (hours) metadata.
- Unit tests cover at least one invalid payload per schema and assert descriptive error messages.
- Documentation lists the current schema version identifiers for the three read models.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §6](../../proposals/20251009-mini_frontend.md#6-data-schemas-mvp-minimal-fields)
- [DD §3](../../DD.md#3-domain-data-models)

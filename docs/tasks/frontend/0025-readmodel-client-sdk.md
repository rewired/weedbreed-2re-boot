# Read-model Client SDK

**ID:** 0025
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, read-models, sdk, track-2

## Rationale
UI hydration requires a thin client that fetches the three read models, validates responses, and surfaces typed results. Building this SDK now decouples later UI work from transport details and locks down error handling expectations.

## Scope
- In: implement fetch helpers for the three read models using the schemas from Task 0023.
- In: expose unified error type for schema mismatches or network failures.
- Out: state management or UI rendering (covered in later tracks).

## Deliverables
- `packages/facade/src/readModels/client.ts` exporting async functions `fetchCompanyTree`, `fetchStructureTariffs`, `fetchWorkforceView` that accept a base URL.
- `packages/facade/tests/unit/readModels/client.spec.ts` stubbing `fetch` to cover success, HTTP error, and schema mismatch cases.
- `docs/tools/rest-client.md` (new) providing `.http` examples or curl snippets for the three endpoints.

## Acceptance Criteria
- Each helper validates payloads via schema validators and throws a typed error when validation fails.
- Unit tests demonstrate rejection on non-2xx responses and invalid JSON.
- Documentation includes example requests/responses matching schema versions.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §6](../../proposals/20251009-mini_frontend.md#6-data-schemas-mvp-minimal-fields)
- [TDD §5](../../TDD.md#5-read-model-contracts)

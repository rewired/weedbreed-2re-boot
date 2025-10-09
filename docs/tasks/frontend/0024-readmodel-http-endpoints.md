# Read-model HTTP Endpoints

**ID:** 0024
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, read-models, facade, track-2

## Rationale
With schemas in place, the façade needs deterministic HTTP endpoints so the UI can hydrate its store. Implementing the three MVP endpoints ensures consistent responses and schema-version signalling per the proposal.

## Scope
- In: add `/api/companyTree`, `/api/structureTariffs`, and `/api/workforceView` GET handlers returning validated payloads.
- In: reuse schema validators to ensure responses conform before sending.
- Out: persistence/backing data sources beyond in-memory stubs sourced from engine bootstrap (follow-up tasks may replace data sources).

## Deliverables
- `packages/facade/src/server/http.ts` (new) or equivalent Express/Fastify module wiring the three routes.
- `packages/facade/tests/integration/readModels/httpEndpoints.spec.ts` covering happy paths and schema mismatch failures.
- Update to façade package `package.json` to expose a `dev:server` script if missing.

## Acceptance Criteria
- Each endpoint responds with HTTP 200, includes `schemaVersion` and `simTime`, and matches schema types.
- Invalid payloads trigger HTTP 500 with logged error and test coverage verifying the guard.
- Integration tests run under `pnpm --filter @wb/facade test`.
- Dev script instructions (package README or scripts) document how to start the HTTP server alongside the transport server.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §6](../../proposals/20251009-mini_frontend.md#6-data-schemas-mvp-minimal-fields)
- [TDD §5](../../TDD.md#5-read-model-contracts)

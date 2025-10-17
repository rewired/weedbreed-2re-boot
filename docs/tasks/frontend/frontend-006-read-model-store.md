# Replace Frontend Fixture Store with Live Fetch

**ID:** FRONT-006
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, state-management, transport

## Rationale
The frontend Zustand store boots with `deterministicReadModelSnapshot` and never fetches the façade endpoint, so UI components cannot display live data even if the backend is ready. We need a loading/error-aware fetch flow.

## Scope
- In: Initialize the store in loading state, fetch `/api/read-models` when `VITE_TRANSPORT_BASE_URL` is defined, and expose retry/error state to consumers.
- In: Preserve deterministic fallback only when no transport is configured, with clear console warnings.
- Out: Component-level replacements of fixture selectors; telemetry or intent handling beyond store bootstrap.

## Deliverables
- Updated store module (likely `packages/ui/src/stores/readModelStore.ts`) with TypeScript types aligned to live payloads.
- Unit tests covering initial load, success, failure, and fallback behaviours.
- Developer docs describing environment variables and error surfaces.

## Acceptance Criteria
- Store fetches live read models and transitions through loading → ready → error states deterministically.
- Missing/invalid `VITE_TRANSPORT_BASE_URL` falls back to fixtures with a single warning.
- Components consuming the store receive unchanged selectors/signatures aside from new status fields.

## References
- SEC §0.1 (transport adapter expectations)
- TDD §2 (read-model endpoint contract)
- Root `AGENTS.md` (UI deterministic fixtures guidance)

# Read-Model Store Live Fetch

**ID:** 4100
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, state, data

## Rationale
The frontend store must fetch live read models from the façade, handling loading/error states and falling back to fixtures only when transport is absent.

## Scope
- In: update Zustand read-model store to fetch `/api/read-models` on init, manage loading/error states, and respect VITE_TRANSPORT_BASE_URL.
- In: add retry/backoff hooks with deterministic timing for tests.
- Out: component consumption changes (handled by other tasks).
- Out: telemetry subscriptions (separate tasks).
- Rollback: restore previous deterministic snapshot seeding.

## Deliverables
- Updated store implementation handling live fetch, loading, and error states.
- Unit tests covering successful fetch, error fallback, and fixture-only mode.
- CHANGELOG note referencing live fetch behavior.

## Acceptance Criteria
- ≤3 source files (plus tests) modified; ≤150 diff lines.
- Store exposes `status: 'loading'|'ready'|'error'` and `lastError` fields used by downstream hooks.
- Tests (1–3) simulate fetch success, network failure, and no-transport configuration via mocked fetch.
- Tests to add/modify: 3 unit tests using Vitest/MSW or fetch mocks.

## References
- SEC §4 data transport
- TDD §4 read-model store
- Root AGENTS.md §2 determinism, §4 telemetry separation

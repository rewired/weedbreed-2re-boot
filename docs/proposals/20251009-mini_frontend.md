# Proposal — Minimal Frontend + Thin Transport Slice (WB Re‑ReBoot)

## 1) Purpose

Establish a minimal-yet-solid UI foundation, backed by a very thin transport slice, so the frontend can hydrate from read models, subscribe to live telemetry, and submit a small set of safe intents with acknowledgements. This proposal is the source of truth for deriving encapsulated tasks for Codex.

## 2) Scope (MVP)

**In scope**

* Read-only hydration via stable read models (company tree, tariffs, workforce view).
* Live telemetry subscription (tick events, zone snapshots, workforce KPIs, harvest created).
* Acknowledge-based intent flow for a small, safe subset (e.g., set light schedule, select irrigation method).
* Minimal UI surfaces: Dashboard + Zone Detail + Workforce KPIs; left-rail accordion navigation.
* Error/ack handling in the UI (toasts + per-action feedback) with a small, centralized error dictionary.

**Out of scope (MVP)**

* Complex inventory/shop flows, advanced editing UIs, bulk device layouting, HR scheduling, reports/exports.
* Non-essential intents or mutating flows beyond the two exemplar intents above.

## 3) Architectural Contracts

* **Transport**: Socket-based with two distinct namespaces/channels.

  * `telemetry` = strictly read-only; server rejects incoming events on this namespace.
  * `intents` = client emits `intent:submit` with `{type, intentId, payload}`, server replies via inline ack `{ok, error?}`.
* **Read Models**: Versioned, immutable snapshots at boot (~3 endpoints/queries), exposing `schemaVersion` and `simTime`.
* **Events (MVP minimum)**: `telemetry.tick.completed.v1`, `telemetry.zone.snapshot.v1`, `telemetry.workforce.kpi.v1`, `telemetry.harvest.created.v1`.
* **Error Codes (MVP minimum)**: `WB_TEL_READONLY`, `WB_INTENT_INVALID`, `WB_INTENT_CHANNEL_INVALID`, `WB_INTENT_HANDLER_ERROR`.

## 4) UI Surfaces & Data Flows

* **Boot sequence**

  1. Load runtime config (baseUrl, env, flags).
  2. Fetch read models: `companyTree`, `structureTariffs`, `workforceView` → hydrate store.
  3. Connect `telemetry` namespace (read-only) and bind event handlers.
  4. Connect `intents` namespace with ack handler and error dictionary.

* **Screens**

  * **Dashboard**: Ticks per sec, current sim day/time, daily cost rollups, energy/water usage; live event stream.
  * **Zone Detail**: Live PPFD/DLI_inc, Temp/RH/CO₂, ACH/capacity warnings; device coverage; actions panel for exemplar intents.
  * **Workforce**: KPIs and warnings via read model and telemetry.

* **Intent UX**

  * Optimistic UI only after `ack.ok === true`.
  * Toasts for errors; per-intent spinner + retry. All errors mapped via the dictionary.

## 5) Thin Transport Slice (MVP Wiring)

* Namespaces initialized; CORS/local dev allowed; auth stubbed or token passthrough.
* 1 healthcheck (e.g., `GET /healthz`) + 3 read-model endpoints + both sockets online.
* Contract tests that:

  * ensure `telemetry` rejects inbound client emits (read-only guarantee),
  * validate `intent:submit` ack shape and error codes,
  * verify event names and payloads for the 4 MVP telemetry topics.

## 6) Data Schemas (MVP minimal fields)

* **companyTree**: `{ companyId, name, structures:[{id,name, rooms:[{id,name, zones:[{id,name, area_m2, volume_m3}]}]}] }`
* **structureTariffs**: `{ electricity_kwh_price, water_m3_price, co2_kg_price?, currency?: null }`
* **workforceView**: `{ headcount, roles:{gardener, technician, janitor}, kpis:{utilization, warnings:[...]}}`
* **telemetry.zone.snapshot.v1**: `{ zoneId, simTime, ppfd, dli_incremental, temp_c, rh, co2_ppm, ach, warnings:[...] }`
* **intent.setLightSchedule.v1**: `{ zoneId, schedule:{on, off, photoperiod_h}}`
* **intent.selectIrrigationMethod.v1**: `{ zoneId, methodId }`

## 7) Acceptance Criteria (MVP)

* UI boots, hydrates from read models, and renders Dashboard & Zone Detail without mock data.
* Live telemetry visibly updates corresponding UI widgets within ≤300 ms from event arrival (dev machine).
* Attempting to emit on `telemetry` from the client is rejected and surfaced as `WB_TEL_READONLY`.
* Submitting either exemplar intent returns `ack.ok===true` in the happy path; failures map to user-visible errors.
* Contract tests green; vitest integration running in CI.

## 8) Risks & Mitigations

* **Schema drift**: Pin versions and surface `schemaVersion` in payloads; fail-fast if mismatch.
* **Backpressure**: Batch/process telemetry on animation frame; drop non-critical duplicates.
* **Flaky transport**: Heartbeats and auto-reconnect with exponential backoff.
* **Perf**: Avoid heavy recomputation; normalize store; throttle UI updates to 60 Hz.

## 9) Dev Experience & Local Setup

* Single `pnpm run dev:stack` starts façade (read models + sockets) and frontend.
* `.env.local` for baseUrl and flags; CORS permissive in dev.
* Example `.http` or REST client snippets for read models; Socket playground script for intents.

## 10) Next Step

Once this proposal is approved, derive **small, encapsulated Codex tasks**:

1. Transport slice (namespaces, read-only enforcement, acks + error codes).
2. Read-model hydration API (3 endpoints) + types.
3. Telemetry client binder (4 topics) + store wiring.
4. UI skeleton (left rail, dashboard, zone detail, workforce KPIs).
5. Intent flow (2 exemplar intents) with error dictionary and UX.
6. Contract tests + CI wiring.

---

**Decision needed:** Approve this MVP scope and contract set. If approved, we immediately break it into the tasks listed in §10 for Codex execution.

# ADR-0019: Economy Reporting Cadence

> **Metadata**
>
> - **ID:** ADR-0019
> - **Title:** Economy Reporting Cadence
> - **Status:** Accepted
> - **Date:** 2025-10-07
> - **Supersedes:** _None_
> - **Summary:** Anchor simulation accrual at the per-hour tick while standardising read-model rollups to hourly and daily slices for reporting.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD, VISION

## Context

SEC §10 enforces per-hour tariffs and prohibits `*_per_tick` money units. SEC §14 asked whether reporting should expose raw tick accruals or only daily aggregates. Without a decision, economy tests and UI contracts oscillated between hourly ledgers and daily dashboards, risking divergence.

## Decision

- **Accrual:** The engine SHALL continue to accrue economy metrics every tick (1 in-game hour) using per-hour tariffs. These per-hour entries constitute the canonical ledger for audits and determinism tests.
- **Reporting:** Read-models and telemetry SHALL expose both hourly (per tick) slices and derived daily aggregates computed as deterministic sums over 24 hourly records. No other aggregation cadence is permitted without a superseding ADR.
- **Storage/Export:** Persistence keeps hourly rows; daily summaries are derived on read. External exports (CSV/JSON) must include at least the hourly series, with daily totals optional.

## Consequences

- **Pros:** Preserves determinism and auditability while supporting daily dashboards expected by operations teams. Aligns with existing conformance tests that compare hourly hashes.
- **Cons:** Increases read-model payload size compared to daily-only reports, though compression is acceptable if deterministic.
- **Follow-up:** Update DD/TDD reporting sections to document hourly schema fields and aggregation rules; ensure façade/API validators lock the cadence to hourly + daily only.

## Alternatives Considered

- **Daily-only accrual:** Rejected; would require deriving per-hour tariffs post-hoc, breaking SEC §3.6 and existing determinism fixtures.
- **Per-tick (<1h) accrual:** Rejected; tick duration is fixed at 1 hour by SEC constants, so finer granularity adds complexity without benefit.

## Links

- SEC §10 Economy Integration
- TDD §8 Economy & Tariffs
- VISION_SCOPE §1 Vision (Operations dashboard)

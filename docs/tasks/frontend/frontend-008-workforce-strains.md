# Move Workforce & Strain Surfaces to Live Data

**ID:** FRONT-008
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, hr, catalog

## Rationale
Workforce summaries and strain catalog pages are currently synthetic, preventing HR analytics and cultivar metadata from reflecting backend data. After live read models are available we must hook these surfaces up.

## Scope
- In: Refactor workforce selectors/components to consume HR read models and telemetry-backed utilization/warning data.
- In: Build strain catalog views using façade-provided catalogs (or newly added read models) with search/filter support.
- Out: Structural navigation (handled in FRONT-007); intent submission UI; pricing or logistics beyond data binding.

## Deliverables
- Updated HR-related components (`packages/ui/src/features/workforce/**`) and strain catalog modules (`packages/ui/src/features/strains/**`).
- Tests verifying rendering with populated and empty datasets.
- Documentation snippet describing data sources and fallback behaviours.

## Acceptance Criteria
- Workforce page shows real headcount, assignments, warnings, and queues from the backend.
- Strain catalog lists live cultivar metadata with loading/empty/error states handled gracefully.
- No deterministic fixtures remain in targeted modules.

## References
- SEC §3 (catalog data) & §7.5 (cultivation methods)
- DD §4 (HR & strain UX requirements)
- Root `AGENTS.md` (documentation + determinism)

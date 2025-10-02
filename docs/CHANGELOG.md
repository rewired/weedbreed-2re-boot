# Changelog

All notable changes to this repository will be documented in this file.

## [2025-10-03] Irrigation compatibility source of truth correction
- Removed `supportedIrrigationMethodIds` from substrate blueprints; irrigation compatibility is now resolved from irrigation method blueprints that list compatible substrates under `compatibility.substrates`.
- Superseded ADR-0002 with ADR-0003 to document the irrigation-method-driven compatibility model and refreshed SEC/DD/TDD guidance accordingly.

## [2025-10-02] Cultivation method blueprint field alignment
- Renamed cultivation method planting density to `areaPerPlant_m2` and updated container/substrate references to concrete blueprint slugs.
- Shifted irrigation compatibility to substrate blueprints via `supportedIrrigationMethodIds`, removing direct `irrigationMethodIds` from cultivation methods (see ADR-0002, superseded by ADR-0003).
- Added ADR-0002 documenting the substrate-driven irrigation compatibility decision and refreshed SEC/DD/AGENTS guidance.

## [2025-10-01] Data audit groundwork
- Logged device blueprint schema gaps (placement scope + room eligibility) in ISSUE-0001 for SEC alignment.
- Captured cultivation method blueprint compliance gaps with SEC §7.5 in ISSUE-0002.
- Recorded pricing data violations (per-tick rates, tariff fields) in ISSUE-0003.
- Replaced legacy `roomPurposes` with `allowedRoomPurposes` and added `placementScope=["zone"]` across device blueprints to satisfy SEC placement metadata requirements.

# ADR-0008: Company headquarters location metadata

## Status
Accepted

## Context
The Simulation Engine Contract (SEC v0.2.1) is preparing logistics and
regional compliance features that rely on knowing where a company operates. The
existing domain model lacked explicit location metadata, preventing forthcoming
work from resolving tariff rules, localisation, and spatial planning defaults.
Without a canonical default the façade cannot bootstrap scenarios until the UI
collects the new fields.

## Decision
- Extend the `Company` entity with a mandatory `location` object containing
  longitude, latitude, city, and country metadata.
- Guard the new shape at both schema (Zod) and business-validation layers so
  integrations receive deterministic feedback for missing/invalid data.
- Introduce Hamburg defaults in `simConstants` that seed newly generated worlds
  until the UI surfaces headquarters capture.

## Consequences
- Engine, façade, and documentation updates now assume `company.location`
  exists; existing fixtures and tests were migrated to provide valid metadata.
- Future logistics features can rely on the presence of location data without
  introducing further breaking changes.
- Integrations must supply non-empty locality data and coordinates within the
  [-180, 180]/[-90, 90] ranges or risk validation failures, improving data
  quality ahead of downstream consumption.

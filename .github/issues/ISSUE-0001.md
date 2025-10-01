# ISSUE-0001: Device blueprints missing SEC-mandated placement metadata

## Summary
Device blueprints under `data/blueprints/devices/` still use the legacy `roomPurposes` field and omit both `placementScope` and `allowedRoomPurposes`. The Simulation Engine Contract requires every device blueprint to declare the placement scope (`zone | room | structure`) and the set of allowed room purposes so validation can enforce eligibility.

## SEC references
- SEC §2 hierarchy notes that devices attach via `placementScope` (`zone|room|structure`).【F:docs/SEC.md†L186-L206】
- SEC migration notes explicitly require adding `placementScope` to `devices/*.json` and aligning `allowedRoomPurposes`.【F:docs/SEC.md†L640-L653】
- AGENTS §4 reiterates the requirement for `placementScope` and `allowedRoomPurposes` in every device blueprint.【F:AGENTS.md†L65-L77】

## Affected data
- `data/blueprints/devices/climate_unit_01.json`
- `data/blueprints/devices/co2injector-01.json`
- `data/blueprints/devices/dehumidifier-01.json`
- `data/blueprints/devices/exhaust_fan_01.json`
- `data/blueprints/devices/humidity_control_unit_01.json`
- `data/blueprints/devices/veg_light_01.json`

Each file currently exposes `roomPurposes` but lacks the required fields. Example:
```json
"roomPurposes": ["growroom"]
```

## Expected resolution
- Replace the legacy `roomPurposes` arrays with explicit `allowedRoomPurposes`.
- Add a `placementScope` string to every device blueprint with a valid value.
- Audit downstream validators/tests once the schema is updated.

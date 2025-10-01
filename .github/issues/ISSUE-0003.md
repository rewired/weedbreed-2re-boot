# ISSUE-0003: Pricing data uses forbidden `_per_tick` units and missing tariff fields

## Summary
Multiple price maps in `/data/prices/` violate the SEC economy contract:
- `data/prices/devicePrices.json` encodes recurring maintenance costs as `baseMaintenanceCostPerTick` and `costIncreasePer1000Ticks`.
- `data/blueprints/roomPurposes/growroom.json` exposes `baseRentPerTick`.
- `data/prices/utilityPrices.json` uses `pricePerLiterWater` instead of the mandated `price_water` per cubic meter and adds an unspecified `pricePerGramNutrients` field.

SEC §3.6 and the AGENTS data contract forbid per-tick monetary units and require tariffs to be expressed via `price_electricity` (kWh) and `price_water` (m³).

## SEC references
- SEC migration guidance removes device-embedded pricing and aligns tariffs with explicit `price_electricity` and `price_water` fields.【F:docs/SEC.md†L640-L653】
- AGENTS §5 states that price maps must avoid `*_per_tick` monetary units and that tariffs are expressed as `price_electricity` (per kWh) and `price_water` (per m³).【F:AGENTS.md†L82-L97】

## Affected data
- `data/prices/devicePrices.json`
- `data/prices/utilityPrices.json`
- `data/blueprints/roomPurposes/growroom.json`

## Expected resolution
- Convert all recurring monetary rates to per-hour fields (e.g., `maintenanceCost_per_h`) and remove tick-based naming.
- Update the utility tariff map to expose `price_electricity` and `price_water` with the correct SI units; relocate or justify nutrient pricing per SEC if required.
- Replace `baseRentPerTick` with a per-hour rate (or restructure rent handling per SEC/DD guidance).
- Ensure downstream code/tests read the updated field names.

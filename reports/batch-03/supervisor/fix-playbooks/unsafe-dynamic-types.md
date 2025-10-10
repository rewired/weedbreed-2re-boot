# Unsafe Dynamic Types (Cluster: unsafe-dynamic-types)

## Symptom
- `@typescript-eslint/no-unsafe-*` and `no-explicit-any` violations around blueprint/test fixtures.
- `no-redundant-type-constituents` when unions include `any`/`unknown` sentinels.

```ts
const data: any = loadBlueprint();
return data.payload.temperatureDelta; // flagged member access
```

## Root-Cause
Blueprint loaders and test harnesses still emit `any` because parsing is deferred. Without typed schemas or Zod parsing, downstream code blindly trusts structure, violating SEC determinism and type safety.

## Canonical Fix
- Parse external JSON with Zod schema returning typed DTOs.
- Propagate typed interfaces through helpers (no `Record<string, any>`).
- Replace ad-hoc `any` casts with discriminated unions or result objects.
- For tests, build strongly-typed fixtures via factory helpers instead of object spreads.

```ts
const BlueprintSchema = z.object({ payload: z.object({ temperatureDelta: z.number() }) });
const parsed = BlueprintSchema.parse(raw);
return parsed.payload.temperatureDelta; // typed
```

## Edge-Cases
- When dynamic key iteration is required (e.g. blueprint registries), map to typed tuples `[id, blueprint]` and validate keys.
- Telemetry payloads must remain read-only; expose typed snapshots instead of returning mutable references.

## Regression-Tests
- Add schema coverage tests ensuring every blueprint file passes the stricter parser.
- Extend integration tests for economy/pipeline to assert numeric fields are numbers (no silent coercion).

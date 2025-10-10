# Nullish Guardrails (Cluster: nullish-guards)

## Symptom
- `@typescript-eslint/no-unnecessary-condition` or `no-non-null-assertion` on optional chains that are always defined.
- `prefer-nullish-coalescing` when assignments guard against `undefined` but should use `??=`.

```ts
if (candidate?.experienceYears) {
  total += candidate.experienceYears;
}
``` 

## Root-Cause
Domain models already guarantee presence (e.g. schema validated via Zod before reaching runtime). Residual optional chaining from prototyping hides defects and blocks strict null checks.

## Canonical Fix
- Promote precise types: adjust interfaces to mark fields required once validated.
- Replace defensive conditionals with explicit invariants or `throw` on impossible states.
- Use nullish coalescing (`??`/`??=`) for defaults, never `||` for numeric 0 cases.

```ts
const verified = assertCandidate(candidate); // narrows type
verified.experienceYears ??= 0;
total += verified.experienceYears;
```

## Edge-Cases
- Pipeline stages that legitimately handle optional payloads (e.g. partial persistence). Document and add type guards instead of optional chain cascades.
- Avoid forcing defaults that break SEC economics (e.g. 0 wage vs. missing wage).

## Regression-Tests
- Extend integration tests for workforce/economy to assert rejection of missing mandatory fields.
- Unit tests verifying `assert*` helpers throw on invalid inputs and allow valid ones.

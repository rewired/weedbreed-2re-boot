# Dead Code Hygiene (Cluster: dead-code-hygiene)

## Symptom
- `@typescript-eslint/no-unused-vars`, `prefer-const`, `require-await`, or `no-empty-function` flagged in workforce and blueprint helpers.

```ts
async function queueTask(task: Task) {
  return tasks.push(task); // require-await + confusing void
}
```

## Root-Cause
Legacy scaffolding left behind unused bindings and async wrappers. These hide legitimate invariants (e.g. tasks that must be awaited) and keep noise in diffs, violating DD cleanliness expectations.

## Canonical Fix
- Remove unused destructured values; if needed for future features, capture via `// TODO` in docs not code.
- Convert `let` to `const` after verifying no mutation.
- Drop `async` on synchronous functions or await the actual promises.
- Replace empty callbacks with documented stubs that throw or delegate.

## Edge-Cases
- Some event handlers intentionally ignore a parameter—prefix with `_` to document.
- Ensure conversions to `const` do not break mutation semantics required by pipeline builders (prefer `const { ... } =` and mutate copies).

## Regression-Tests
- Unit tests covering workforce scheduling and pipeline builder flows to confirm behavior unchanged.
- Lint rule `no-unused-vars` should pass with `pnpm -r lint` once changes applied.

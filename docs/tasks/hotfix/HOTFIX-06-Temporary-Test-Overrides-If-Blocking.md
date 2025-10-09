# HOTFIX-06 — Temporäre Test-Overrides (nur falls noch Blocker)

**Goal:** If remaining type-resolution gaps still block linting, temporarily relax a subset of rules **only for tests**.

## Required Changes
1. In root ESLint config, add test-only overrides:
```js
overrides: [
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-non-null-assertion": "off"
    }
  }
]
```
2. Add a comment/TODO: This is temporary and will be removed once HOTFIX-01..05 are fully applied.

## Rationale
Allows progress while the remaining alias/typing edges are fixed. Prevents masking true issues in prod code.

## Acceptance Criteria
- `pnpm -w eslint "packages/**/*.{ts,tsx}"` no longer blocks based on test-only safety rules.
- A follow-up issue is created to remove these overrides after type-resolution is stable.

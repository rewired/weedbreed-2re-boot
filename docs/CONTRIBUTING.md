# Contributing

## Import hygiene guardrails

- TypeScript sources **must not** import local files with a trailing `.js` extension. Use extensionless specifiers (`import './foo'`) so the build output can append `.js` while source tooling resolves `.ts`.
- JSON modules continue to use import attributes (`import data from './foo.json' with { type: 'json' }`). Those remain allowed by the ESLint rule `wb-sim/no-ts-import-js-extension`.
- Run `pnpm lint:imports` to execute the ESLint rule across the workspace. The rule auto-fixes offending specifiers by removing the trailing `.js` segment.
- Use `pnpm lint` for day-to-day ESLint runs (warnings are surfaced but do not fail the command) and `pnpm lint:ci` before publishing to ensure warning-free pipelines.

## Runtime import resolution spec

- `pnpm test:imports` runs a focused Vitest suite (`packages/engine/tests/runtime/importResolution.test.ts`) that dynamically `import()`s engine schemas and pipeline stages. This catches runtime failures like `Failed to load url` that surface when `.ts` sources accidentally reference `.js` artifacts.
- The suite is intentionally lightweight; keep it fast so it can gate pre-commit and CI.

## Pre-commit hooks

- The repo uses [`simple-git-hooks`](https://github.com/toplenboren/simple-git-hooks). `pnpm install` (or `pnpm prepare`) wires up a `pre-commit` hook that runs `pnpm lint:imports` and `pnpm test:imports` before every commit.
- The `pre-push` hook delegates to `pnpm prepush`, which now chains `pnpm typecheck`, `pnpm lint:ci`, and `pnpm test` so warning-free ESLint output is still enforced before sharing work.
- If you need to skip the hook temporarily (e.g. for WIP commits), pass `HUSKY=0`/`SKIP=...` environment overrides intentionally and rerun the checks before pushing.
- Hook output mirrors CI, so fixes applied locally keep the pipeline green.

## Magic number guardrail

- Numeric literals in production TypeScript must live in `packages/engine/src/backend/src/constants/**` (or re-export from `simConstants.ts`).
- ESLint enforces the `@typescript-eslint/no-magic-numbers` rule with a narrow allowlist. A temporary `pnpm run lint:strict` guard runs `pnpm -r lint` through `tools/check-warn-budget.mjs` and fails CI when combined warnings exceed the 30-warning budget while the backlog is burned down; once the warning count returns to zero the helper will be retired as noted in HOTFIX-042.
- Run `pnpm scan:magic` to execute the ripgrep audit locally. The scan ignores tests, schemas, and the constants directory and fails when new literals slip through.
- When introducing a new threshold or default, document it in the appropriate constants module and update `/docs/constants/README.md`.

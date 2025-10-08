# Contributing

## Import hygiene guardrails

- TypeScript sources **must not** import local files with a trailing `.js` extension. Use extensionless specifiers (`import './foo'`) so the build output can append `.js` while source tooling resolves `.ts`.
- JSON modules continue to use import attributes (`import data from './foo.json' with { type: 'json' }`). Those remain allowed by the ESLint rule `wb-sim/no-ts-import-js-extension`.
- Run `pnpm lint:imports` to execute the ESLint rule across the workspace. The rule auto-fixes offending specifiers by removing the trailing `.js` segment.

## Runtime import resolution spec

- `pnpm test:imports` runs a focused Vitest suite (`packages/engine/tests/runtime/importResolution.test.ts`) that dynamically `import()`s engine schemas and pipeline stages. This catches runtime failures like `Failed to load url` that surface when `.ts` sources accidentally reference `.js` artifacts.
- The suite is intentionally lightweight; keep it fast so it can gate pre-commit and CI.

## Pre-commit hooks

- The repo uses [`simple-git-hooks`](https://github.com/toplenboren/simple-git-hooks). `pnpm install` (or `pnpm prepare`) wires up a `pre-commit` hook that runs `pnpm lint:imports` and `pnpm test:imports` before every commit.
- If you need to skip the hook temporarily (e.g. for WIP commits), pass `HUSKY=0`/`SKIP=...` environment overrides intentionally and rerun the checks before pushing.
- Hook output mirrors CI, so fixes applied locally keep the pipeline green.

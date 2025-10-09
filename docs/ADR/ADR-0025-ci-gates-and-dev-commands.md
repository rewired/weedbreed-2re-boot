# ADR-0025 — CI Gates & Developer Command Contracts

## Status
Accepted — 2025-02-15

## Context
Recent hotfixes restored type-aware linting, strict TypeScript configs, and guardrails around unsafe operations. However, the root workspace still lacked a canonical set of developer commands to consistently run type checking, linting, and tests, and the CI workflow executed linting before type analysis without explicitly failing on lint warnings. This made it easy for regressions to slip through local workflows and for warnings to accumulate unnoticed.

## Decision
- Add dedicated `pnpm typecheck`, `pnpm lint`, and `pnpm test` scripts at the workspace root so contributors have a single entry point for regression guards.
- Introduce a `pnpm prepush` script (and corresponding Git hook) that chains `typecheck → lint → test`, mirroring the CI gate order.
- Update the GitHub Actions CI pipeline to execute `pnpm typecheck`, `pnpm lint --max-warnings 0`, and `pnpm test` in sequence, failing immediately if any step reports issues.

## Consequences
- Developers and CI now share the same command contract, reducing drift between local checks and pipeline behaviour.
- ESLint warnings fail both locally (via `pnpm lint`) and in CI, preventing the reintroduction of unsafe patterns blocked by recent hotfixes.
- Future automation (e.g., pre-commit, additional CI jobs) can layer on top of the standardized scripts without duplicating command wiring.

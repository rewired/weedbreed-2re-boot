# CI Pipeline Integration

**ID:** 0038
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, ci, automation, track-6

## Rationale
Contract tests and UI lint/test suites must run in CI to uphold SEC/TDD guarantees. This task wires the new packages and test commands into GitHub Actions (or existing CI) with caching aligned to Node 22 + pnpm.

## Scope
- In: update `.github/workflows/ci.yml` (or create new workflow) to install dependencies, build, lint, and run unit + contract tests across façade, transport, and UI packages.
- In: add caching for pnpm store and Vite build artifacts if applicable.
- Out: deployment scripts or release automation.

## Deliverables
- Workflow file updates ensuring UI lint/test, telemetry tests, and contract suite run on PRs.
- Status badges or README note referencing the new CI coverage.

## Acceptance Criteria
- CI workflow executes commands: `pnpm install`, `pnpm lint`, `pnpm test`, plus contract suite; logs show Node 22 runtime.
- Failures in any new package/test block merges (non-optional job).
- Documentation (README or `docs/tools/dev-stack.md`) mentions CI expectations for frontend tasks.

## References
- [Proposal §7](../../proposals/20251009-mini_frontend.md#7-acceptance-criteria-mvp)
- [TDD §2](../../TDD.md#2-tooling-and-workflow)
- [AGENTS §1](../../AGENTS.md#1-platform-monorepo-must-haves)

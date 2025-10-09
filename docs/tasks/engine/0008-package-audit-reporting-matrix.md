ID: 0008
# Package Audit & Reporting Matrix

**ID:** 0001A
**Status:** In Progress
**Owner:** unassigned
**Priority:** P1
**Tags:** tooling, docs, ci-readiness

## Rationale
Capture the candidate dependency plan in a deterministic report so future refactors can reason about deterministic helpers, CLI wiring, and documentation scope without touching production runtime. This feeds into the broader SEC alignment for determinism and psychrometrics without prematurely integrating behaviour changes.

## Scope
- Include: scanning `package.json` / lockfiles, documenting direct usage, greenlist/review/skip buckets, and emitting CLI parity (`wb report packages`).
- Include: wiring a root script (`pnpm report:packages`) and storing the markdown report under `docs/reports/PACKAGE_AUDIT.md`.
- Out of scope: adding runtime imports of the new helpers; promoting review/skip packages beyond documentation.

## Deliverables
- `docs/reports/PACKAGE_AUDIT.md` capturing the current matrix and no-go criteria.
- `packages/tools` CLI that renders the same matrix on demand.
- CHANGELOG/DD/TDD notes calling out the testing-only nature of the helpers.

## Implementation Steps
1. Parse workspaces & lockfiles, normalise findings into a reusable data structure.
2. Render markdown + CLI table output using the shared data.
3. Categorise packages into Greenlist / Review / Skip with explicit rationale.
4. Document follow-up tasks (determinism helpers, psychro wiring) and expose the CLI via a root script.

## Acceptance Criteria / DoD
- `pnpm report:packages` prints the same matrix stored in `docs/reports/PACKAGE_AUDIT.md`.
- Report lists Greenlist/Review/Skip and cites no-go criteria.
- Docs updated (CHANGELOG, DD, TDD) to reference the scaffolds without implying runtime changes.

## Tests
- Manual: `pnpm report:packages` (ensures CLI + report parity).

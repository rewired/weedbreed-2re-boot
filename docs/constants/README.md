# Constants ownership

All production defaults and SEC-aligned thresholds live under `packages/engine/src/backend/src/constants/`.

- `simConstants.ts` remains the canonical registry for Simulation Engine Contract values. Domain modules may only re-export or derive from these values.
- Domain shims (`time.ts`, `physics.ts`, `climate.ts`, `lighting.ts`, `workforce.ts`, `economy.ts`, `validation.ts`) group related thresholds to keep imports ergonomic.
- `goldenMaster.ts` centralises the deterministic conformance horizons used by the golden master harness (30d/200d).
- Export names use `UPPER_SNAKE_CASE` and include units (`*_PER_H`, `*_M2`, …) to avoid ambiguity.
- When adding a new constant:
  - Define it in the relevant domain module (or `simConstants.ts` if SEC-level) and document the rationale inline.
  - Reference it from calling code instead of embedding numeric literals.
  - Update this README and any domain-specific docs with ownership details.
- Tests, fixtures, and schemas may use literals for clarity, but production code must import from the constants directory.

For quick audits run `pnpm scan:magic` to surface stray literals. The command backs the CI guardrail and fails if new production magic numbers are introduced.

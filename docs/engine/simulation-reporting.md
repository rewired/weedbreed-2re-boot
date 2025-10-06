# Simulation reporting — seed-to-harvest artifacts

> **Source of truth order:** SEC → DD → TDD → this document. When guidance here and SEC disagree, follow the contract first.

## 1) Purpose

`generateSeedToHarvestReport()` composes the deterministic seed-to-harvest orchestrator with the performance harness so teams can
produce shareable JSON artifacts that capture lifecycle stage transitions, perf traces, and harvest telemetry in a single
package. The CLI wrapper writes these reports to `/reporting` at the repository root so downstream analysis tools have a stable
pickup location. The `/reporting` directory is tracked in the root `.gitignore`, ensuring generated artifacts remain local and are
never accidentally committed.

## 2) Inputs & configuration

| Flag | Description | Default | Notes |
| ---- | ----------- | ------- | ----- |
| `--ticks <number>` | Number of traced ticks to capture via the perf harness. | `25` | Must be a finite integer ≥ 1. Mirrors TDD perf baseline guidance. |
| `--scenario <name>` | Free-form label recorded in the report metadata. | `demo-world` | Use scenario slugs from DD/SEC appendices when running canonical worlds. |
| `--output <file>` | Relative path (under `/reporting`) for the JSON artifact. | auto-generated using scenario + ISO timestamp | The CLI rejects absolute paths to keep artifacts scoped to `/reporting`. |

Additional configuration for the orchestrator (e.g. custom world factories or strain overrides) can be supplied when calling
`generateSeedToHarvestReport({ seedToHarvest: { … } })` programmatically. The CLI currently targets the demo world baseline.

## 3) Prerequisites

Set up the workspace before invoking the report generator:

- Use **Node.js 22 (LTS)** so the CLI matches the repository engine baseline.
- Enable pnpm via Corepack with `corepack use pnpm@10.18.0`.
- Install dependencies from the repository root using `pnpm install`.

The workspace `packageManager` metadata in `package.json` pins pnpm and its integrity checksum, so `npm --filter …` and other npm-specific invocations are unsupported for the reporting command.
A root `preinstall` guard now aborts installs if pnpm 10.18.0 is not in use; run `pnpm run verify-pnpm` to check your environment before installing.

## 4) CLI usage

```
# Run from repository root. pnpm passes args to the underlying tsx process after --.
pnpm --filter @wb/engine report:seed-to-harvest -- --ticks 40 --scenario white-widow --output white-widow/seed-to-harvest.json
```

The command ensures `/reporting` exists, normalises the tick count, and writes a prettified JSON artifact. The CLI prints the
absolute path of the generated file on success.

### Troubleshooting

If the command fails with `Cannot find module '@npmcli/config'`, npm handled the execution instead of pnpm/Corepack. Reinstall or repair npm so it respects the Corepack shim, or switch to pnpm with `corepack use pnpm@10.18.0` before running the CLI.

## 5) JSON schema

TypeScript-flavoured pseudo schema describing the artifact shape:

```ts
interface SeedToHarvestReport {
  metadata: {
    scenario: string;           // scenario label recorded for traceability
    generatedAt: string;        // ISO-8601 timestamp when the artifact was produced
  };
  summary: {
    ticksElapsed: number;       // ticks required for the orchestrator run
    totalBiomass_g: number;     // cumulative biomass for the seeded zone at completion
    harvestedLotCount: number;  // count of harvest lots captured from inventory
  };
  stages: {
    transitions: StageTransitionEvent[];          // per-plant lifecycle changes with tick + zone context
    photoperiodTransitions: PhotoperiodTransitionEvent[]; // zone-level light regime flips (veg → flower)
    summary: {
      totalTransitions: number;                   // transitions.length
      transitionsByStage: Partial<Record<PlantLifecycleStage, number>>; // counts grouped by target stage
      photoperiodTransitionCount: number;         // photoperiodTransitions.length
    };
  };
  telemetry: {
    harvestEvents: HarvestTelemetryEvent[];       // filtered telemetry bus events (harvest created)
    summary: {
      totalEvents: number;                        // harvestEvents.length
      byTopic: Record<string, number>;            // aggregate counts per telemetry topic
    };
  };
  performance: {
    tickCount: number;                            // perf harness sample size (matches CLI --ticks)
    totalDurationNs: number;
    averageDurationNs: number;
    maxHeapUsedBytes: number;
    traces: TickTrace[];                          // raw perf trace objects (see engine/trace.ts)
  };
}
```

Consumers can rely on the equality relationships noted in comments (e.g. `totalTransitions === transitions.length`) for
validation. The schema mirrors the structures asserted in `packages/engine/tests/integration/reporting/seedToHarvest.report.test.ts`.

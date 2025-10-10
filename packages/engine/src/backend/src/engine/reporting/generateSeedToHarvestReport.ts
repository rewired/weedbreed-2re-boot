import { runSeedToHarvest, type SeedToHarvestConfig } from '../seedToHarvest.ts';
import { withPerfHarness } from '../testHarness.ts';
import type {
  HarvestTelemetryEvent,
  PhotoperiodTransitionEvent,
  SeedToHarvestResult,
  StageTransitionEvent
} from '../seedToHarvest.ts';
import type { TickTrace } from '../trace.ts';
import type { PlantLifecycleStage } from '../../domain/entities.ts';

export interface SeedToHarvestReportOptions {
  readonly scenario?: string;
  readonly ticks?: number;
  readonly seedToHarvest?: SeedToHarvestConfig;
}

export interface SeedToHarvestReportSummary {
  readonly ticksElapsed: number;
  readonly totalBiomass_g: number;
  readonly harvestedLotCount: number;
}

export interface SeedToHarvestStageSummary {
  readonly totalTransitions: number;
  readonly transitionsByStage: Partial<Record<PlantLifecycleStage, number>>;
  readonly photoperiodTransitionCount: number;
}

export interface SeedToHarvestTelemetrySummary {
  readonly totalEvents: number;
  readonly byTopic: Record<string, number>;
}

export interface SeedToHarvestPerformanceSummary {
  readonly tickCount: number;
  readonly totalDurationNs: number;
  readonly averageDurationNs: number;
  readonly maxHeapUsedBytes: number;
  readonly traces: readonly TickTrace[];
}

export interface SeedToHarvestReportStages {
  readonly transitions: readonly StageTransitionEvent[];
  readonly photoperiodTransitions: readonly PhotoperiodTransitionEvent[];
  readonly summary: SeedToHarvestStageSummary;
}

export interface SeedToHarvestReportTelemetry {
  readonly harvestEvents: readonly HarvestTelemetryEvent[];
  readonly summary: SeedToHarvestTelemetrySummary;
}

export interface SeedToHarvestReport {
  readonly metadata: {
    readonly scenario: string;
    readonly generatedAt: string;
  };
  readonly summary: SeedToHarvestReportSummary;
  readonly stages: SeedToHarvestReportStages;
  readonly telemetry: SeedToHarvestReportTelemetry;
  readonly performance: SeedToHarvestPerformanceSummary;
}

/** Scenario identifier used when a report request omits an explicit name. */
const DEFAULT_SCENARIO_NAME = 'demo-world';

/** Number of ticks sampled when the perf harness runs without overrides. */
const DEFAULT_PERF_TICKS = 25 as const;

export function generateSeedToHarvestReport(
  options: SeedToHarvestReportOptions = {}
): SeedToHarvestReport {
  const scenario = options.scenario?.trim() ?? DEFAULT_SCENARIO_NAME;
  const perfTickBudget = normaliseTickCount(options.ticks ?? DEFAULT_PERF_TICKS);
  const seedToHarvestConfig = options.seedToHarvest;

  const seedToHarvestResult = runSeedToHarvest(seedToHarvestConfig);
  const perfHarnessResult = withPerfHarness({
    ticks: perfTickBudget,
    worldFactory: seedToHarvestConfig?.worldFactory
  });

  const stageSummary = summariseStageTransitions(seedToHarvestResult);
  const telemetrySummary = summariseTelemetry(seedToHarvestResult.harvestTelemetry);

  return {
    metadata: {
      scenario,
      generatedAt: new Date().toISOString()
    },
    summary: {
      ticksElapsed: seedToHarvestResult.ticksElapsed,
      totalBiomass_g: seedToHarvestResult.totalBiomass_g,
      harvestedLotCount: seedToHarvestResult.harvestedLots.length
    },
    stages: {
      transitions: seedToHarvestResult.stageTransitions,
      photoperiodTransitions: seedToHarvestResult.photoperiodTransitions,
      summary: stageSummary
    },
    telemetry: {
      harvestEvents: seedToHarvestResult.harvestTelemetry,
      summary: telemetrySummary
    },
    performance: {
      tickCount: perfTickBudget,
      totalDurationNs: perfHarnessResult.totalDurationNs,
      averageDurationNs: perfHarnessResult.averageDurationNs,
      maxHeapUsedBytes: perfHarnessResult.maxHeapUsedBytes,
      traces: perfHarnessResult.traces
    }
  } satisfies SeedToHarvestReport;
}

function summariseStageTransitions(result: SeedToHarvestResult): SeedToHarvestStageSummary {
  const byStage: Partial<Record<PlantLifecycleStage, number>> = {};

  for (const transition of result.stageTransitions) {
    byStage[transition.to] = (byStage[transition.to] ?? 0) + 1;
  }

  return {
    totalTransitions: result.stageTransitions.length,
    transitionsByStage: byStage,
    photoperiodTransitionCount: result.photoperiodTransitions.length
  } satisfies SeedToHarvestStageSummary;
}

function summariseTelemetry(events: readonly HarvestTelemetryEvent[]): SeedToHarvestTelemetrySummary {
  const byTopic = new Map<string, number>();

  for (const event of events) {
    byTopic.set(event.topic, (byTopic.get(event.topic) ?? 0) + 1);
  }

  return {
    totalEvents: events.length,
    byTopic: Object.fromEntries(byTopic)
  } satisfies SeedToHarvestTelemetrySummary;
}

function normaliseTickCount(value: number): number {
  const ticks = Math.max(1, Math.trunc(value));

  if (!Number.isFinite(ticks)) {
    throw new Error('Tick count must be a finite integer value.');
  }

  return ticks;
}

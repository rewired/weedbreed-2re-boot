import process from 'node:process';

import { BYTES_PER_MEBIBYTE } from '../../src/backend/src/constants/simConstants.ts';
import { withPerfHarness } from '../../src/backend/src/engine/testHarness.ts';
import {
  evaluatePerfBudget,
  PERF_CI_TICK_COUNT,
  PERF_CI_THRESHOLDS,
  PERF_SCENARIO_THRESHOLDS,
  type PerfBudgetThresholds
} from '../../src/backend/src/engine/perf/perfBudget.ts';
import {
  createBaselinePerfWorld,
  createTargetPerfWorld
} from '../../src/backend/src/engine/perf/perfScenarios.ts';

type PerfBudgetThresholdOverrides = {
  -readonly [K in keyof PerfBudgetThresholds]?: PerfBudgetThresholds[K];
};

const NANOSECONDS_PER_MILLISECOND = 1_000_000;
const DECIMAL_PLACES_HIGH = 3;
const DECIMAL_PLACES_STANDARD = 2;
const WHOLE_NUMBER_PRECISION = 0;
const PERCENT_SCALE = 100;

function parseThresholdOverrides(): PerfBudgetThresholdOverrides {
  const overrides: PerfBudgetThresholdOverrides = {};
  const throughput = process.env.PERF_CI_MIN_TICKS_PER_MINUTE;
  const heap = process.env.PERF_CI_MAX_HEAP_MIB;
  const guardBand01 =
    process.env.PERF_CI_WARNING_GUARD_BAND_01 ?? process.env.PERF_CI_WARNING_GUARD_PERCENTAGE;

  if (!process.env.PERF_CI_WARNING_GUARD_BAND_01 && process.env.PERF_CI_WARNING_GUARD_PERCENTAGE) {
    console.warn(
      'PERF_CI_WARNING_GUARD_PERCENTAGE is deprecated; use PERF_CI_WARNING_GUARD_BAND_01 (0-1 scale).'
    );
  }

  if (throughput) {
    const value = Number.parseFloat(throughput);

    if (Number.isFinite(value) && value > 0) {
      overrides.minTicksPerMinute = value;
    }
  }

  if (heap) {
    const value = Number.parseFloat(heap);

    if (Number.isFinite(value) && value > 0) {
      overrides.maxHeapBytes = value * BYTES_PER_MEBIBYTE;
    }
  }

  if (guardBand01) {
    const value = Number.parseFloat(guardBand01);

    if (Number.isFinite(value) && value >= 0 && value < 1) {
      overrides.warningGuard01 = value;
    }
  }

  return overrides;
}

const tickOverride = process.env.PERF_CI_TICK_COUNT;
const tickCount = (() => {
  if (!tickOverride) {
    return PERF_CI_TICK_COUNT;
  }

  const parsed = Number.parseInt(tickOverride, 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return PERF_CI_TICK_COUNT;
})();

const overrides = parseThresholdOverrides();
const thresholds = {
  ...PERF_CI_THRESHOLDS,
  ...overrides
} satisfies PerfBudgetThresholds;

const result = withPerfHarness({ ticks: tickCount });
const evaluation = evaluatePerfBudget(result, overrides);

const scenarioDefinitions = [
  {
    id: 'baseline',
    label: 'Baseline (1 room, 1 zone)',
    worldFactory: createBaselinePerfWorld,
    thresholdMs: PERF_SCENARIO_THRESHOLDS.baseline.maxAverageDurationMs
  },
  {
    id: 'target',
    label: 'Target (1 room, 5 zones, voller Gerätepark)',
    worldFactory: createTargetPerfWorld,
    thresholdMs: PERF_SCENARIO_THRESHOLDS.target.maxAverageDurationMs
  }
] as const;

const scenarioResults = scenarioDefinitions.map((scenario) => {
  const scenarioResult = withPerfHarness({ ticks: tickCount, worldFactory: scenario.worldFactory });
  const averageMs = scenarioResult.averageDurationNs / NANOSECONDS_PER_MILLISECOND;
  const status: 'pass' | 'fail' =
    Number.isFinite(averageMs) && averageMs <= scenario.thresholdMs ? 'pass' : 'fail';

  return {
    id: scenario.id,
    label: scenario.label,
    averageMs,
    thresholdMs: scenario.thresholdMs,
    status
  } as const;
});

const lines = [
  'WeedBreed Engine CI performance budget',
  `Tick samples: ${String(evaluation.metrics.tickCount)} (requested ${String(tickCount)})`,
  `Average duration: ${(evaluation.metrics.averageDurationNs / NANOSECONDS_PER_MILLISECOND).toFixed(DECIMAL_PLACES_HIGH)} ms`,
  `Throughput: ${evaluation.metrics.ticksPerMinute.toFixed(DECIMAL_PLACES_STANDARD)} ticks/min (min ${thresholds.minTicksPerMinute.toFixed(WHOLE_NUMBER_PRECISION)})`,
  `Heap peak: ${evaluation.metrics.maxHeapUsedMiB.toFixed(DECIMAL_PLACES_STANDARD)} MiB (max ${(thresholds.maxHeapBytes / BYTES_PER_MEBIBYTE).toFixed(DECIMAL_PLACES_STANDARD)} MiB)`,
  `Guard band: ${(thresholds.warningGuard01 * PERCENT_SCALE).toFixed(1)}%`
];

for (const scenario of scenarioResults) {
  lines.push(
    `${scenario.label}: ${scenario.averageMs.toFixed(DECIMAL_PLACES_HIGH)} ms avg (budget ${scenario.thresholdMs.toFixed(DECIMAL_PLACES_HIGH)} ms)`
  );
}

for (const line of lines) {
  console.log(line);
}

if (evaluation.failures.length > 0) {
  console.error('\nFailures:');
  for (const message of evaluation.failures) {
    console.error(`- ${message}`);
  }
}

if (evaluation.warnings.length > 0) {
  console.warn('\nWarnings:');
  for (const message of evaluation.warnings) {
    console.warn(`- ${message}`);
  }
}

console.log(`\nResult: ${evaluation.status.toUpperCase()}`);

if (evaluation.status === 'fail') {
  process.exitCode = 1;
}

const failedScenarios = scenarioResults.filter((scenario) => scenario.status === 'fail');

if (failedScenarios.length > 0) {
  console.error('\nScenario regressions:');
  for (const scenario of failedScenarios) {
    console.error(
      `- ${scenario.label} average ${scenario.averageMs.toFixed(DECIMAL_PLACES_HIGH)} ms exceeds ${scenario.thresholdMs.toFixed(DECIMAL_PLACES_HIGH)} ms budget.`
    );
  }
  process.exitCode = 1;
}

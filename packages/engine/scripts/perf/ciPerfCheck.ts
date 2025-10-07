import process from 'node:process';

import { withPerfHarness } from '../../src/backend/src/engine/testHarness.js';
import {
  evaluatePerfBudget,
  PERF_CI_TICK_COUNT,
  PERF_CI_THRESHOLDS,
  type PerfBudgetThresholds
} from '../../src/backend/src/engine/perf/perfBudget.js';

function parseThresholdOverrides(): Partial<PerfBudgetThresholds> {
  const overrides: Partial<PerfBudgetThresholds> = {};
  const throughput = process.env.PERF_CI_MIN_TICKS_PER_MINUTE;
  const heap = process.env.PERF_CI_MAX_HEAP_MIB;
  const guard = process.env.PERF_CI_WARNING_GUARD_PERCENTAGE;

  if (throughput) {
    const value = Number.parseFloat(throughput);

    if (Number.isFinite(value) && value > 0) {
      overrides.minTicksPerMinute = value;
    }
  }

  if (heap) {
    const value = Number.parseFloat(heap);

    if (Number.isFinite(value) && value > 0) {
      overrides.maxHeapBytes = value * 1024 * 1024;
    }
  }

  if (guard) {
    const value = Number.parseFloat(guard);

    if (Number.isFinite(value) && value >= 0 && value < 1) {
      overrides.warningGuardPercentage = value;
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

const lines = [
  'WeedBreed Engine CI performance budget',
  `Tick samples: ${evaluation.metrics.tickCount} (requested ${tickCount})`,
  `Average duration: ${(evaluation.metrics.averageDurationNs / 1_000_000).toFixed(3)} ms`,
  `Throughput: ${evaluation.metrics.ticksPerMinute.toFixed(2)} ticks/min (min ${thresholds.minTicksPerMinute.toFixed(0)})`,
  `Heap peak: ${evaluation.metrics.maxHeapUsedMiB.toFixed(2)} MiB (max ${(thresholds.maxHeapBytes / (1024 * 1024)).toFixed(2)} MiB)`,
  `Guard band: ${(thresholds.warningGuardPercentage * 100).toFixed(1)}%`
];

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

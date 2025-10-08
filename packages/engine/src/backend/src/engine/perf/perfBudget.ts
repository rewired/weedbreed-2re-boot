import { type PerfHarnessResult } from '../testHarness.js';

const NS_PER_SECOND = 1_000_000_000;
const SECONDS_PER_MINUTE = 60;
const BYTES_PER_MIB = 1024 * 1024;

export const PERF_CI_TICK_COUNT = 10_000;
export const PERF_MIN_TICKS_PER_MINUTE = 5_000;
export const PERF_MAX_HEAP_BYTES = 64 * BYTES_PER_MIB;
export const PERF_WARNING_GUARD_PERCENTAGE = 0.05;

export interface PerfBudgetThresholds {
  readonly minTicksPerMinute: number;
  readonly maxHeapBytes: number;
  readonly warningGuardPercentage: number;
}

export interface PerfBudgetMetrics {
  readonly tickCount: number;
  readonly totalDurationNs: number;
  readonly averageDurationNs: number;
  readonly ticksPerMinute: number;
  readonly maxHeapUsedBytes: number;
  readonly maxHeapUsedMiB: number;
}

export interface PerfBudgetEvaluation {
  readonly status: 'pass' | 'warn' | 'fail';
  readonly failures: readonly string[];
  readonly warnings: readonly string[];
  readonly metrics: PerfBudgetMetrics;
  readonly thresholds: PerfBudgetThresholds;
}

export const PERF_CI_THRESHOLDS: PerfBudgetThresholds = {
  minTicksPerMinute: PERF_MIN_TICKS_PER_MINUTE,
  maxHeapBytes: PERF_MAX_HEAP_BYTES,
  warningGuardPercentage: PERF_WARNING_GUARD_PERCENTAGE
} as const;

export interface PerfScenarioThreshold {
  readonly maxAverageDurationMs: number;
}

export const PERF_SCENARIO_THRESHOLDS: {
  readonly baseline: PerfScenarioThreshold;
  readonly target: PerfScenarioThreshold;
} = {
  baseline: { maxAverageDurationMs: 0.2 },
  target: { maxAverageDurationMs: 0.4 }
} as const;

export function evaluatePerfBudget(
  result: PerfHarnessResult,
  overrides?: Partial<PerfBudgetThresholds>
): PerfBudgetEvaluation {
  const thresholds: PerfBudgetThresholds = {
    ...PERF_CI_THRESHOLDS,
    ...overrides
  } satisfies PerfBudgetThresholds;

  const tickCount = result.traces.length;
  const totalDurationNs = result.totalDurationNs;
  const averageDurationNs = result.averageDurationNs;
  const totalDurationMinutes = totalDurationNs / NS_PER_SECOND / SECONDS_PER_MINUTE;
  const ticksPerMinute =
    totalDurationMinutes > 0 ? tickCount / totalDurationMinutes : Number.POSITIVE_INFINITY;
  const maxHeapUsedBytes = result.maxHeapUsedBytes;
  const maxHeapUsedMiB = maxHeapUsedBytes / BYTES_PER_MIB;

  const failures: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(ticksPerMinute) || ticksPerMinute <= 0) {
    failures.push('Perf harness duration produced a non-finite ticks/minute measurement.');
  }

  if (!Number.isFinite(maxHeapUsedBytes) || maxHeapUsedBytes <= 0) {
    failures.push('Perf harness heap metrics must be finite and positive.');
  }

  if (ticksPerMinute < thresholds.minTicksPerMinute) {
    failures.push(
      `Throughput ${ticksPerMinute.toFixed(2)} ticks/min is below the ${thresholds.minTicksPerMinute.toFixed(
        0
      )} ticks/min requirement.`
    );
  } else {
    const throughputWarningFloor = thresholds.minTicksPerMinute * (1 + thresholds.warningGuardPercentage);

    if (ticksPerMinute < throughputWarningFloor) {
      warnings.push(
        `Throughput ${ticksPerMinute.toFixed(2)} ticks/min is within ${(
          thresholds.warningGuardPercentage * 100
        ).toFixed(1)}% of the failure threshold.`
      );
    }
  }

  if (maxHeapUsedBytes > thresholds.maxHeapBytes) {
    failures.push(
      `Heap peak ${(maxHeapUsedMiB).toFixed(2)} MiB exceeds ${(thresholds.maxHeapBytes / BYTES_PER_MIB).toFixed(
        2
      )} MiB budget.`
    );
  } else {
    const heapWarningCeiling = thresholds.maxHeapBytes * (1 - thresholds.warningGuardPercentage);

    if (maxHeapUsedBytes > heapWarningCeiling) {
      warnings.push(
        `Heap peak ${maxHeapUsedMiB.toFixed(2)} MiB is within ${(
          thresholds.warningGuardPercentage * 100
        ).toFixed(1)}% of the budget.`
      );
    }
  }

  const status: PerfBudgetEvaluation['status'] = failures.length
    ? 'fail'
    : warnings.length
      ? 'warn'
      : 'pass';

  return {
    status,
    failures,
    warnings,
    metrics: {
      tickCount,
      totalDurationNs,
      averageDurationNs,
      ticksPerMinute,
      maxHeapUsedBytes,
      maxHeapUsedMiB
    },
    thresholds
  } satisfies PerfBudgetEvaluation;
}

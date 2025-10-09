import { BYTES_PER_MEBIBYTE } from '@/backend/src/constants/simConstants';
import {
  PERF_BUDGET_BASELINE_MAX_AVG_DURATION_MS,
  PERF_BUDGET_CI_TICK_COUNT,
  PERF_BUDGET_MAX_HEAP_MEBIBYTES,
  PERF_BUDGET_MIN_TICKS_PER_MINUTE,
  PERF_BUDGET_NS_PER_SECOND,
  PERF_BUDGET_SECONDS_PER_MINUTE,
  PERF_BUDGET_TARGET_MAX_AVG_DURATION_MS,
  PERF_BUDGET_WARNING_GUARD_BAND_01
} from '@/backend/src/constants/perfBudget';

import { type PerfHarnessResult } from '../testHarness.ts';

export const PERF_CI_TICK_COUNT = PERF_BUDGET_CI_TICK_COUNT;
export const PERF_MIN_TICKS_PER_MINUTE = PERF_BUDGET_MIN_TICKS_PER_MINUTE;
export const PERF_MAX_HEAP_BYTES = PERF_BUDGET_MAX_HEAP_MEBIBYTES * BYTES_PER_MEBIBYTE;
export const PERF_WARNING_GUARD_BAND_01 = PERF_BUDGET_WARNING_GUARD_BAND_01;

export interface PerfBudgetThresholds {
  readonly minTicksPerMinute: number;
  readonly maxHeapBytes: number;
  readonly warningGuard01: number;
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
  warningGuard01: PERF_WARNING_GUARD_BAND_01
} as const;

export interface PerfScenarioThreshold {
  readonly maxAverageDurationMs: number;
}

/** Maximum average ms/tick budget for the baseline perf scenario. */
export const PERF_BASELINE_MAX_AVERAGE_DURATION_MS =
  PERF_BUDGET_BASELINE_MAX_AVG_DURATION_MS;

/** Maximum average ms/tick budget for the fully equipped target perf scenario. */
export const PERF_TARGET_MAX_AVERAGE_DURATION_MS = PERF_BUDGET_TARGET_MAX_AVG_DURATION_MS;

export const PERF_SCENARIO_THRESHOLDS: {
  readonly baseline: PerfScenarioThreshold;
  readonly target: PerfScenarioThreshold;
} = {
  baseline: { maxAverageDurationMs: PERF_BASELINE_MAX_AVERAGE_DURATION_MS },
  target: { maxAverageDurationMs: PERF_TARGET_MAX_AVERAGE_DURATION_MS }
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
  const totalDurationMinutes =
    totalDurationNs / PERF_BUDGET_NS_PER_SECOND / PERF_BUDGET_SECONDS_PER_MINUTE;
  const ticksPerMinute =
    totalDurationMinutes > 0 ? tickCount / totalDurationMinutes : Number.POSITIVE_INFINITY;
  const maxHeapUsedBytes = result.maxHeapUsedBytes;
  const maxHeapUsedMiB = maxHeapUsedBytes / BYTES_PER_MEBIBYTE;

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
    const throughputWarningFloor = thresholds.minTicksPerMinute * (1 + thresholds.warningGuard01);

    if (ticksPerMinute < throughputWarningFloor) {
      warnings.push(
        `Throughput ${ticksPerMinute.toFixed(2)} ticks/min is within ${(
          thresholds.warningGuard01 * 100
        ).toFixed(1)}% of the failure threshold.`
      );
    }
  }

  if (maxHeapUsedBytes > thresholds.maxHeapBytes) {
    failures.push(
      `Heap peak ${(maxHeapUsedMiB).toFixed(2)} MiB exceeds ${(thresholds.maxHeapBytes / BYTES_PER_MEBIBYTE).toFixed(
        2
      )} MiB budget.`
    );
  } else {
    const heapWarningCeiling = thresholds.maxHeapBytes * (1 - thresholds.warningGuard01);

    if (maxHeapUsedBytes > heapWarningCeiling) {
      warnings.push(
        `Heap peak ${maxHeapUsedMiB.toFixed(2)} MiB is within ${(
          thresholds.warningGuard01 * 100
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

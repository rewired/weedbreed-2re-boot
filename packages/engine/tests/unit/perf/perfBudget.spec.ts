import { describe, expect, it } from 'vitest';

import {
  evaluatePerfBudget,
  PERF_CI_THRESHOLDS,
  type PerfBudgetEvaluation
} from '@/backend/src/engine/perf/perfBudget';
import { type PerfHarnessResult } from '@/backend/src/engine/testHarness';
import { type TickTrace } from '@/backend/src/engine/trace';

interface MockPerfInput {
  readonly tickCount: number;
  readonly averageDurationNs: number;
  readonly maxHeapBytes: number;
}

function createTickTrace(durationNs: number, heapBytes: number): TickTrace {
  return {
    startedAtNs: 0,
    endedAtNs: durationNs,
    durationNs,
    steps: [],
    totalHeapUsedDeltaBytes: 0,
    maxHeapUsedBytes: heapBytes
  } satisfies TickTrace;
}

function createPerfHarnessResult(input: MockPerfInput): PerfHarnessResult {
  const traces: TickTrace[] = [];

  for (let index = 0; index < input.tickCount; index += 1) {
    traces.push(createTickTrace(input.averageDurationNs, input.maxHeapBytes));
  }

  const totalDurationNs = input.averageDurationNs * input.tickCount;

  return {
    traces,
    totalDurationNs,
    averageDurationNs: input.averageDurationNs,
    maxHeapUsedBytes: input.maxHeapBytes
  } satisfies PerfHarnessResult;
}

describe('evaluatePerfBudget', () => {
  it('passes when throughput and heap headroom exceed thresholds', () => {
    const result = createPerfHarnessResult({
      tickCount: 100,
      averageDurationNs: 8_000_000,
      maxHeapBytes: 40 * 1024 * 1024
    });

    const evaluation = evaluatePerfBudget(result);

    expect(evaluation.status).toBe('pass');
    expect(evaluation.failures).toHaveLength(0);
    expect(evaluation.warnings).toHaveLength(0);
  });

  it('exposes guard-band thresholds on the 0-1 scale', () => {
    expect(PERF_CI_THRESHOLDS.warningGuard01).toBeGreaterThanOrEqual(0);
    expect(PERF_CI_THRESHOLDS.warningGuard01).toBeLessThan(1);
  });

  it('emits warnings when metrics are inside the guard band', () => {
    const averageDurationNs = Math.round((60 * 1_000_000_000) / 5_100);
    const result = createPerfHarnessResult({
      tickCount: 100,
      averageDurationNs,
      maxHeapBytes: Math.trunc(PERF_CI_THRESHOLDS.maxHeapBytes * 0.975)
    });

    const evaluation = evaluatePerfBudget(result);

    expect(evaluation.status).toBe('warn');
    expect(evaluation.failures).toHaveLength(0);
    expect(evaluation.warnings.length).toBeGreaterThan(0);
  });

  it('fails when throughput or heap exceed the budget', () => {
    const slowResult = createPerfHarnessResult({
      tickCount: 100,
      averageDurationNs: 15_000_000,
      maxHeapBytes: PERF_CI_THRESHOLDS.maxHeapBytes + 1024
    });

    const evaluation: PerfBudgetEvaluation = evaluatePerfBudget(slowResult);

    expect(evaluation.status).toBe('fail');
    expect(evaluation.failures.length).toBeGreaterThan(0);
  });
});

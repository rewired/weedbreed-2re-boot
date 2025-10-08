import { describe, expect, it } from 'vitest';

import { PIPELINE_ORDER } from '@/backend/src/engine/Engine';
import { runOneTickWithTrace } from '@/backend/src/engine/testHarness';

describe('Tick trace schema', () => {
  it('captures monotonic timings and heap deltas for each pipeline step', () => {
    const { trace } = runOneTickWithTrace();

    expect(trace.startedAtNs).toBe(0);
    expect(trace.endedAtNs).toBe(trace.durationNs);
    expect(trace.steps).toHaveLength(PIPELINE_ORDER.length);

    const aggregatedHeapDelta = trace.steps.reduce((sum, step) => {
      expect(step.durationNs).toBeGreaterThanOrEqual(0);
      expect(step.startedAtNs).toBeGreaterThanOrEqual(0);
      expect(step.endedAtNs).toBe(step.startedAtNs + step.durationNs);
      expect(step.heapUsedAfterBytes).toBeGreaterThanOrEqual(0);
      expect(step.heapUsedBeforeBytes).toBeGreaterThanOrEqual(0);
      return sum + step.heapUsedDeltaBytes;
    }, 0);

    expect(trace.totalHeapUsedDeltaBytes).toBe(aggregatedHeapDelta);
    expect(trace.maxHeapUsedBytes).toBeGreaterThanOrEqual(0);
  });
});

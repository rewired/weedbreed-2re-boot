import { describe, expect, it } from 'vitest';

import { withPerfHarness } from '@/backend/src/engine/testHarness.js';

const PERF_TICK_COUNT = 25;
const PERF_MAX_AVERAGE_DURATION_NS = 5_000_000;
const PERF_MAX_HEAP_BYTES = 64 * 1024 * 1024;

describe('Tick performance baseline — deterministic harness', () => {
  it('maintains the baseline throughput and GC budget for the demo world', () => {
    const result = withPerfHarness({ ticks: PERF_TICK_COUNT });

    expect(result.traces).toHaveLength(PERF_TICK_COUNT);
    expect(result.totalDurationNs).toBeGreaterThan(0);
    expect(result.averageDurationNs).toBeLessThan(PERF_MAX_AVERAGE_DURATION_NS);
    expect(result.maxHeapUsedBytes).toBeLessThan(PERF_MAX_HEAP_BYTES);
  });
});

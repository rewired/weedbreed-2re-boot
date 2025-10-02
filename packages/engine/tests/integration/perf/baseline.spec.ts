import { describe, expect, it } from 'vitest';

import { withPerfHarness } from '@/backend/src/engine/testHarness.js';

describe('Tick performance baseline — deterministic harness', () => {
  it('maintains the baseline throughput and GC budget for the demo world', () => {
    const result = withPerfHarness({ ticks: 25 });

    expect(result.traces).toHaveLength(25);
    expect(result.totalDurationNs).toBeGreaterThan(0);
    expect(result.averageDurationNs).toBeLessThan(5_000_000);
    expect(result.maxHeapUsedBytes).toBeLessThan(64 * 1024 * 1024);
  });
});

import { describe, expect, it } from 'vitest';
import { createMonitorMetric } from '../../src/index.js';

describe('createMonitorMetric', () => {
  it('returns an immutable metric representation', () => {
    const metric = createMonitorMetric('power', 'Power Usage', 42.5);

    expect(metric).toEqual({ id: 'power', label: 'Power Usage', value: 42.5 });
  });

  it('rejects non-finite values', () => {
    expect(() => createMonitorMetric('invalid', 'Invalid', Number.POSITIVE_INFINITY)).toThrow(
      /finite number/
    );
  });
});

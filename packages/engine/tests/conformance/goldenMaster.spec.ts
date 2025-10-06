import { describe, expect, it } from 'vitest';
import { PIPELINE_PHASES } from '@/constants/simConstants.js';
import { approximatelyEqual, runDeterministic } from '@/engine/testHarness.js';
import worldSeed from '../fixtures/golden/world_v1.seed.json' assert { type: 'json' };
import expectedSummary30 from '../fixtures/golden/summary_v1_30d.json' assert { type: 'json' };
import expectedDaily30 from '../fixtures/golden/daily_v1_30d.json' assert { type: 'json' };
import expectedSummary7 from '../fixtures/golden/summary_v1_7d.json' assert { type: 'json' };
import expectedDaily7 from '../fixtures/golden/daily_v1_7d.json' assert { type: 'json' };

describe('Golden master conformance suite', () => {
  it('tracks the canonical nine-phase pipeline', () => {
    expect(PIPELINE_PHASES).toHaveLength(9);
    expect(PIPELINE_PHASES[0]).toBe('Initialization');
    expect(PIPELINE_PHASES[PIPELINE_PHASES.length - 1]).toBe('Commit');
  });

  it('matches the golden summary and daily hashes for 7-day run', () => {
    const result = runDeterministic({ days: 7, seed: 'gm-001', world: worldSeed });
    expect(result.summary).toMatchObject(expectedSummary7);
    expect(result.daily).toHaveLength(expectedDaily7.length);
    for (let i = 0; i < expectedDaily7.length; i++) {
      expect(result.daily[i].hash).toBe(expectedDaily7[i].hash);
      expect(result.daily[i].totals).toMatchObject(expectedDaily7[i].totals);
    }
  });

  it('matches the golden summary and daily hashes for 30-day run', () => {
    const result = runDeterministic({ days: 30, seed: 'gm-001', world: worldSeed });
    expect(result.summary).toMatchObject(expectedSummary30);
    expect(result.daily).toHaveLength(expectedDaily30.length);
    for (let i = 0; i < expectedDaily30.length; i++) {
      expect(result.daily[i].hash).toBe(expectedDaily30[i].hash);
      expect(result.daily[i].totals).toMatchObject(expectedDaily30[i].totals);
    }
  });

  it('uses tolerance helper for economic totals', () => {
    const a = 1.0000000005;
    const b = 1.0000000004;
    expect(approximatelyEqual(a, b)).toBe(true);
  });
});

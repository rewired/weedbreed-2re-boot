import { describe, expect, it } from 'vitest';

import { createSensorStub } from '@/backend/src/stubs/SensorStub';
import { createRng } from '@/backend/src/util/rng';

const SENSOR_STUB = createSensorStub('temperature');

describe('Sensors — deterministic noise model', () => {
  it('returns zero noise sample when noise01 is zero', () => {
    const rng = createRng('unit-test', 'sensor:noise-zero');
    const reading = SENSOR_STUB.computeEffect(
      {
        trueValue: 21.5,
        noise01: 0,
        condition01: 0.4
      },
      rng
    );

    expect(reading.measuredValue).toBe(21.5);
    expect(reading.noiseSample).toBe(0);
  });

  it('scales noise sample by noise01 and condition01', () => {
    const rng = createRng('unit-test', 'sensor:noise-scale');
    const baseline = SENSOR_STUB.computeEffect(
      {
        trueValue: 18,
        noise01: 0.5,
        condition01: 0.5
      },
      rng
    );

    const rngAdjusted = createRng('unit-test', 'sensor:noise-scale');
    const adjusted = SENSOR_STUB.computeEffect(
      {
        trueValue: 18,
        noise01: 0.25,
        condition01: 0.75
      },
      rngAdjusted
    );

    expect(Math.abs(baseline.noiseSample)).toBeGreaterThan(Math.abs(adjusted.noiseSample));
  });

  it('remains deterministic for identical seeds and stream ids', () => {
    const rngA = createRng('unit-test', 'sensor:deterministic');
    const rngB = createRng('unit-test', 'sensor:deterministic');

    const readingA = SENSOR_STUB.computeEffect(
      {
        trueValue: 24,
        noise01: 0.3,
        condition01: 0.5
      },
      rngA
    );

    const readingB = SENSOR_STUB.computeEffect(
      {
        trueValue: 24,
        noise01: 0.3,
        condition01: 0.5
      },
      rngB
    );

    expect(readingA.measuredValue).toBe(readingB.measuredValue);
    expect(readingA.noiseSample).toBe(readingB.noiseSample);
  });
});

import { describe, expect, it } from 'vitest';

import { createSensorStub } from '@/backend/src/stubs/SensorStub';
import { createRng } from '@/backend/src/util/rng';

const TEMPERATURE_STUB = createSensorStub('temperature');
const HUMIDITY_STUB = createSensorStub('humidity');
const PPFD_STUB = createSensorStub('ppfd');

describe('SensorStub', () => {
  it('returns true value when noise01 is zero', () => {
    const rng = createRng('test-seed', 'sensor:zero-noise');
    const reading = TEMPERATURE_STUB.computeEffect(
      {
        trueValue: 22.5,
        noise01: 0,
        condition01: 0.9
      },
      rng
    );

    expect(reading.measuredValue).toBe(22.5);
    expect(reading.error).toBe(0);
  });

  it('returns true value when condition01 is 1.0', () => {
    const rng = createRng('test-seed', 'sensor:perfect-condition');
    const reading = HUMIDITY_STUB.computeEffect(
      {
        trueValue: 0.6,
        noise01: 0.5,
        condition01: 1
      },
      rng
    );

    expect(reading.measuredValue).toBeCloseTo(0.6, 6);
    expect(reading.error).toBe(0);
  });

  it('applies Gaussian noise for degraded sensor', () => {
    const rng = createRng('test-seed', 'sensor:noisy');
    const reading = TEMPERATURE_STUB.computeEffect(
      {
        trueValue: 25,
        noise01: 0.2,
        condition01: 0.5
      },
      rng
    );

    expect(reading.measuredValue).not.toBe(25);
    expect(reading.error).toBeGreaterThan(0);
    expect(reading.error).toBeLessThan(5);
  });

  it('produces deterministic results for same seed', () => {
    const rngA = createRng('test-seed', 'sensor:deterministic');
    const rngB = createRng('test-seed', 'sensor:deterministic');

    const readingA = HUMIDITY_STUB.computeEffect(
      {
        trueValue: 0.45,
        noise01: 0.3,
        condition01: 0.4
      },
      rngA
    );
    const readingB = HUMIDITY_STUB.computeEffect(
      {
        trueValue: 0.45,
        noise01: 0.3,
        condition01: 0.4
      },
      rngB
    );

    expect(readingA.measuredValue).toBe(readingB.measuredValue);
    expect(readingA.error).toBe(readingB.error);
  });

  it('produces different results for different seeds', () => {
    const rngA = createRng('test-seed', 'sensor:seed-a');
    const rngB = createRng('test-seed', 'sensor:seed-b');

    const readingA = PPFD_STUB.computeEffect(
      {
        trueValue: 200,
        noise01: 0.4,
        condition01: 0.6
      },
      rngA
    );
    const readingB = PPFD_STUB.computeEffect(
      {
        trueValue: 200,
        noise01: 0.4,
        condition01: 0.6
      },
      rngB
    );

    expect(readingA.measuredValue).not.toBe(readingB.measuredValue);
  });

  it('clamps temperature readings to realistic bounds', () => {
    const rng = createRng('test-seed', 'sensor:temp-clamp');
    const reading = TEMPERATURE_STUB.computeEffect(
      {
        trueValue: 100,
        noise01: 1,
        condition01: 0.1
      },
      rng
    );

    expect(reading.measuredValue).toBeGreaterThanOrEqual(-50);
    expect(reading.measuredValue).toBeLessThanOrEqual(150);
  });

  it('clamps humidity readings to [0, 1]', () => {
    const rng = createRng('test-seed', 'sensor:humidity-clamp');
    const reading = HUMIDITY_STUB.computeEffect(
      {
        trueValue: 0.95,
        noise01: 1,
        condition01: 0.1
      },
      rng
    );

    expect(reading.measuredValue).toBeGreaterThanOrEqual(0);
    expect(reading.measuredValue).toBeLessThanOrEqual(1);
  });

  it('calculates absolute error correctly', () => {
    const rng = createRng('test-seed', 'sensor:error');
    const reading = TEMPERATURE_STUB.computeEffect(
      {
        trueValue: 50,
        noise01: 0.1,
        condition01: 0.8
      },
      rng
    );

    expect(reading.error).toBeCloseTo(Math.abs(reading.measuredValue - 50));
  });

  it('throws when RNG is not provided', () => {
    expect(() =>
      TEMPERATURE_STUB.computeEffect({ trueValue: 20, noise01: 0.2, condition01: 0.5 }, undefined as never)
    ).toThrowError('SensorStub requires a deterministic RNG instance');
  });
});

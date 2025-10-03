import type { ISensor, SensorInputs, SensorOutputs } from '../domain/interfaces/ISensor.js';
import type { SensorMeasurementType } from '../domain/entities.js';
import type { RandomNumberGenerator } from '../util/rng.js';

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function boxMullerTransform(rng: RandomNumberGenerator): number {
  let u1 = 0;
  let u2 = 0;

  // Guard against zero values which would break the logarithm.
  while (u1 === 0) {
    u1 = rng();
  }

  while (u2 === 0) {
    u2 = rng();
  }

  const radius = Math.sqrt(-2.0 * Math.log(u1));
  const theta = 2.0 * Math.PI * u2;
  return radius * Math.cos(theta);
}

function clampMeasuredValue(measurementType: SensorMeasurementType, value: number): number {
  switch (measurementType) {
    case 'temperature':
      return clamp(value, -50, 150);
    case 'humidity':
      return clamp(value, 0, 100);
    case 'ppfd':
    default:
      return Math.max(0, value);
  }
}

function ensureRng(rng: RandomNumberGenerator | null | undefined): asserts rng is RandomNumberGenerator {
  if (typeof rng !== 'function') {
    throw new Error('SensorStub requires a deterministic RNG instance');
  }
}

function ensureNumeric(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

export function createSensorStub(measurementType: SensorMeasurementType): ISensor<number> {
  return {
    computeEffect(inputs: SensorInputs<number>, rng: RandomNumberGenerator | null | undefined): SensorOutputs<number> {
      ensureRng(rng);

      const trueValue = ensureNumeric(inputs.trueValue, 0);
      const noise01 = clamp(ensureNumeric(inputs.noise01, 0), 0, 1);
      const condition01 = clamp(ensureNumeric(inputs.condition01, 1), 0, 1);

      if (noise01 === 0 || condition01 === 1) {
        return {
          measuredValue: clampMeasuredValue(measurementType, trueValue),
          error: 0
        } satisfies SensorOutputs<number>;
      }

      const gaussian = boxMullerTransform(rng);
      const deviation = noise01 * (1 - condition01);
      const measuredValue = clampMeasuredValue(measurementType, trueValue + gaussian * deviation);

      return {
        measuredValue,
        error: Math.abs(measuredValue - trueValue)
      } satisfies SensorOutputs<number>;
    }
  } satisfies ISensor<number>;
}

export default createSensorStub;

import { describe, expect, it } from 'vitest';

import { assertValidSensorReading } from '@/backend/src/engine/pipeline/sensorReadingSchema.js';
import type { SensorReading } from '@/backend/src/domain/interfaces/ISensor.js';

const BASE_READING: SensorReading<number> = {
  measurementType: 'temperature',
  rngStreamId: 'sensor:unit',
  sampledAtSimTimeHours: 0,
  sampledTick: 0,
  tickDurationHours: 1,
  trueValue: 20,
  measuredValue: 20,
  error: 0,
  noise01: 0,
  condition01: 1,
  noiseSample: 0
};

describe('Sensors — schema validation', () => {
  it('returns the reading when values are within range', () => {
    expect(assertValidSensorReading(BASE_READING)).toEqual(BASE_READING);
  });

  it('throws when humidity readings exceed the canonical bounds', () => {
    const humidityReading: SensorReading<number> = {
      ...BASE_READING,
      measurementType: 'humidity',
      measuredValue: 120,
      trueValue: 120
    };

    expect(() => assertValidSensorReading(humidityReading)).toThrowError(
      /Sensor reading measured value falls outside the canonical bounds/
    );
  });

  it('throws when tick duration is non-positive', () => {
    const invalidDuration: SensorReading<number> = {
      ...BASE_READING,
      tickDurationHours: 0
    };

    expect(() => assertValidSensorReading(invalidDuration)).toThrowError(/Number must be greater than 0/);
  });
});

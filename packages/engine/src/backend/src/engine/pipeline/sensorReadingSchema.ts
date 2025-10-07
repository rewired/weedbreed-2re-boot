import { z } from 'zod';

import { SENSOR_MEASUREMENT_TYPES } from '../../domain/entities.js';
import type { SensorReading } from '../../domain/interfaces/ISensor.js';

const finiteNumber = z.number().finite();

const SENSOR_READING_BASE_SCHEMA = z.object({
  measurementType: z.enum(SENSOR_MEASUREMENT_TYPES),
  rngStreamId: z.string().min(1),
  sampledAtSimTimeHours: finiteNumber,
  sampledTick: z.number().int().min(0),
  tickDurationHours: z.number().positive(),
  trueValue: finiteNumber,
  measuredValue: finiteNumber,
  error: z.number().min(0),
  noise01: z.number().min(0).max(1),
  condition01: z.number().min(0).max(1),
  noiseSample: z.number()
});

function isMeasurementWithinRange(
  measurementType: (typeof SENSOR_MEASUREMENT_TYPES)[number],
  value: number
): boolean {
  switch (measurementType) {
    case 'temperature':
      return value >= -50 && value <= 150;
    case 'humidity':
      return value >= 0 && value <= 100;
    case 'co2':
      return value >= 0 && value <= 5_000;
    case 'ppfd':
    default:
      return value >= 0;
  }
}

export const SensorReadingSchema = SENSOR_READING_BASE_SCHEMA.refine(
  (reading) => isMeasurementWithinRange(reading.measurementType, reading.measuredValue),
  {
    message: 'Sensor reading measured value falls outside the canonical bounds for the measurement type.'
  }
);

/**
 * Validates a sensor reading emitted by the pipeline, returning the parsed value on success.
 */
export function assertValidSensorReading<T>(reading: SensorReading<T>): SensorReading<T> {
  return SensorReadingSchema.parse(reading) as SensorReading<T>;
}

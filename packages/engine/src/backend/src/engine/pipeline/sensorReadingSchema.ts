import { z } from 'zod';

import { SAFETY_MAX_CO2_PPM } from '@/backend/src/constants/simConstants';
import {
  HUMIDITY_SENSOR_MAX_PCT,
  HUMIDITY_SENSOR_MIN_PCT,
  TEMPERATURE_SENSOR_MAX_C,
  TEMPERATURE_SENSOR_MIN_C
} from '@/backend/src/constants/climate';
import { createFiniteNumber } from '../../domain/schemas/primitives.ts';
import { SENSOR_MEASUREMENT_TYPES } from '../../domain/entities.ts';
import type { SensorReading } from '../../domain/interfaces/ISensor.ts';

const finiteNumber = createFiniteNumber({ message: 'Number must be finite.' });

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
      return value >= TEMPERATURE_SENSOR_MIN_C && value <= TEMPERATURE_SENSOR_MAX_C;
    case 'humidity':
      return value >= HUMIDITY_SENSOR_MIN_PCT && value <= HUMIDITY_SENSOR_MAX_PCT;
    case 'co2':
      return value >= 0 && value <= SAFETY_MAX_CO2_PPM;
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

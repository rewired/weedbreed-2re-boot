import { z } from 'zod';

import { DEVICE_PLACEMENT_SCOPES, ROOM_PURPOSES } from '../../entities.ts';
import { finiteNumber, nonEmptyString } from '../../schemas/primitives.ts';

export const slugString = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase, digits, hyphen).');

export const placementScopeSchema = z.enum([...DEVICE_PLACEMENT_SCOPES]);
export const roomPurposeSchema = z.enum([...ROOM_PURPOSES]);

export const DEVICE_CLASS_VALUES = [
  'device.climate',
  'device.airflow',
  'device.lighting',
  'device.filtration'
] as const;

export const deviceClassSchema = z.enum(DEVICE_CLASS_VALUES, {
  required_error: 'class is required.',
  invalid_type_error: 'class must be one of the supported device domains.'
});

export const deviceEffectSchema = z.enum([
  'thermal',
  'humidity',
  'lighting',
  'airflow',
  'filtration',
  'sensor',
  'co2'
]);

export const thermalConfigObjectSchema = z.object({
  mode: z.enum(['heat', 'cool', 'auto']),
  max_heat_W: finiteNumber.min(0, 'max_heat_W must be non-negative.').optional(),
  max_cool_W: finiteNumber.min(0, 'max_cool_W must be non-negative.').optional(),
  setpoint_C: finiteNumber.optional()
});

export const humidityConfigObjectSchema = z.object({
  mode: z.enum(['humidify', 'dehumidify']),
  capacity_g_per_h: finiteNumber.min(0, 'capacity_g_per_h must be non-negative.')
});

export const lightingConfigObjectSchema = z.object({
  ppfd_center_umol_m2s: finiteNumber.min(0, 'ppfd_center_umol_m2s must be non-negative.'),
  photonEfficacy_umol_per_J: finiteNumber
    .min(0, 'photonEfficacy_umol_per_J must be non-negative.')
    .optional()
});

export const airflowConfigObjectSchema = z.object({
  mode: z.enum(['recirculation', 'exhaust', 'intake']),
  airflow_m3_per_h: finiteNumber.min(0, 'airflow_m3_per_h must be non-negative.')
});

export const filtrationConfigObjectSchema = z.object({
  filterType: z.enum(['carbon', 'hepa', 'pre-filter']),
  efficiency01: finiteNumber
    .min(0, 'efficiency01 must be >= 0.')
    .max(1, 'efficiency01 must be <= 1.'),
  basePressureDrop_pa: finiteNumber.min(0, 'basePressureDrop_pa must be non-negative.')
});

export const sensorMeasurementTypeSchema = z.enum(['temperature', 'humidity', 'ppfd', 'co2']);
const DEFAULT_SENSOR_NOISE_FRACTION = 0.05;

export const sensorConfigObjectSchema = z.object({
  measurementType: sensorMeasurementTypeSchema,
  noise01: finiteNumber
    .min(0, 'sensor.noise01 must be >= 0.')
    .max(1, 'sensor.noise01 must be <= 1.')
    .default(DEFAULT_SENSOR_NOISE_FRACTION)
});

export const co2ConfigObjectSchema = z.object({
  target_ppm: finiteNumber.min(0, 'co2.target_ppm must be non-negative.'),
  pulse_ppm_per_tick: finiteNumber.min(0, 'co2.pulse_ppm_per_tick must be non-negative.'),
  safetyMax_ppm: finiteNumber.min(0, 'co2.safetyMax_ppm must be non-negative.'),
  min_ppm: finiteNumber.min(0, 'co2.min_ppm must be non-negative.').optional(),
  ambient_ppm: finiteNumber.min(0, 'co2.ambient_ppm must be non-negative.').optional(),
  hysteresis_ppm: finiteNumber.min(0, 'co2.hysteresis_ppm must be non-negative.').optional()
});

export const thermalConfigSchema = thermalConfigObjectSchema.optional();
export const humidityConfigSchema = humidityConfigObjectSchema.optional();
export const lightingConfigSchema = lightingConfigObjectSchema.optional();
export const airflowConfigSchema = airflowConfigObjectSchema.optional();
export const filtrationConfigSchema = filtrationConfigObjectSchema.optional();
export const sensorConfigSchema = sensorConfigObjectSchema.optional();
export const co2ConfigSchema = co2ConfigObjectSchema.optional();

export const deviceBlueprintObjectSchema = z
  .object({
    id: z.string().uuid('Device blueprint id must be a UUID v4.'),
    slug: slugString,
    class: deviceClassSchema,
    name: nonEmptyString,
    placementScope: placementScopeSchema,
    allowedRoomPurposes: z
      .array(roomPurposeSchema, {
        invalid_type_error: 'allowedRoomPurposes must be an array of room purposes.'
      })
      .nonempty('allowedRoomPurposes must contain at least one room purpose.')
      .readonly(),
    power_W: finiteNumber.min(0, 'power_W must be non-negative.'),
    efficiency01: finiteNumber
      .min(0, 'efficiency01 must be >= 0.')
      .max(1, 'efficiency01 must be <= 1.'),
    coverage_m2: finiteNumber.min(0, 'coverage_m2 must be non-negative.').optional(),
    airflow_m3_per_h: finiteNumber
      .min(0, 'airflow_m3_per_h must be non-negative.')
      .optional(),
    effects: z.array(deviceEffectSchema).nonempty('effects must not be empty.').optional(),
    thermal: thermalConfigSchema,
    humidity: humidityConfigSchema,
    lighting: lightingConfigSchema,
    airflow: airflowConfigSchema,
    filtration: filtrationConfigSchema,
    sensor: sensorConfigSchema,
    co2: co2ConfigSchema,
    mode: z.string().optional(),
    subtype: z.string().optional(),
    stage: z.string().optional(),
    media: z.string().optional()
  })
  .passthrough();

const MONETARY_KEYWORDS = ['price', 'tariff', 'fee', 'capex', 'opex', 'expense', 'expenditure'] as const;
const COST_TOKEN_LENGTH = 'cost'.length;
const UPPERCASE_TOKEN_PATTERN = /[A-Z]/u;

export function containsMonetaryToken(key: string): boolean {
  const lower = key.toLowerCase();

  if (MONETARY_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  const costIndex = lower.indexOf('cost');

  if (costIndex !== -1) {
    const nextChar = key.charAt(costIndex + COST_TOKEN_LENGTH);

    if (nextChar === '') {
      return true;
    }

    if (nextChar === '_' || nextChar === '-') {
      return true;
    }

    if (nextChar === 's') {
      return true;
    }

    if (UPPERCASE_TOKEN_PATTERN.test(nextChar)) {
      return true;
    }
  }

  return false;
}

export function assertNoMonetaryFields(
  value: unknown,
  ctx: z.RefinementCtx,
  path: readonly (string | number)[] = []
): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoMonetaryFields(item, ctx, [...path, index]);
    });
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (containsMonetaryToken(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Monetary field "${key}" must be declared in /data/prices maps.`,
        path: [...path, key]
      });
    }

    assertNoMonetaryFields(child, ctx, [...path, key]);
  }
}

export type DeviceEffect = z.infer<typeof deviceEffectSchema>;
export type ThermalConfig = z.infer<typeof thermalConfigObjectSchema>;
export type HumidityConfig = z.infer<typeof humidityConfigObjectSchema>;
export type LightingConfig = z.infer<typeof lightingConfigObjectSchema>;
export type Co2Config = z.infer<typeof co2ConfigObjectSchema>;
export type AirflowConfig = z.infer<typeof airflowConfigObjectSchema>;
export type FiltrationConfig = z.infer<typeof filtrationConfigObjectSchema>;
export type SensorConfig = z.infer<typeof sensorConfigObjectSchema>;

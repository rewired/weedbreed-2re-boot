import { z } from 'zod';

import { DEVICE_PLACEMENT_SCOPES, ROOM_PURPOSES } from '../entities.js';

const nonEmptyString = z.string().trim().min(1, 'String fields must not be empty.');
const finiteNumber = z.number().finite('Value must be a finite number.');
const slugString = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase, digits, hyphen).');

const placementScopeSchema = z.enum([...DEVICE_PLACEMENT_SCOPES]);
const roomPurposeSchema = z.enum([...ROOM_PURPOSES]);
const deviceClassSchema = z.enum([
  'device.climate.cooling',
  'device.climate.co2',
  'device.climate.dehumidifier',
  'device.climate.humidity-controller',
  'device.airflow.exhaust',
  'device.lighting.vegetative'
]);

type DeviceClass = z.infer<typeof deviceClassSchema>;

/**
 * Canonical device blueprint contract enforced for JSON payloads.
 */
const deviceBlueprintObjectSchema = z
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
      .nonempty('allowedRoomPurposes must contain at least one room purpose.'),
    power_W: finiteNumber.min(0, 'power_W must be non-negative.'),
    efficiency01: finiteNumber
      .min(0, 'efficiency01 must be >= 0.')
      .max(1, 'efficiency01 must be <= 1.'),
    coverage_m2: finiteNumber.min(0, 'coverage_m2 must be non-negative.').optional(),
    airflow_m3_per_h: finiteNumber
      .min(0, 'airflow_m3_per_h must be non-negative.')
      .optional()
  })
  .passthrough();

const MONETARY_KEYWORDS = ['price', 'tariff', 'fee', 'capex', 'opex', 'expense', 'expenditure'] as const;

function containsMonetaryToken(key: string): boolean {
  const lower = key.toLowerCase();

  if (MONETARY_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  const costIndex = lower.indexOf('cost');

  if (costIndex !== -1) {
    const nextChar = key[costIndex + 4];

    if (nextChar === undefined) {
      return true;
    }

    if (nextChar === '_' || nextChar === '-') {
      return true;
    }

    if (nextChar === nextChar.toUpperCase()) {
      return true;
    }

    if (lower.startsWith('costs', costIndex)) {
      return true;
    }
  }

  return false;
}

function assertNoMonetaryFields(
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

function ensureNestedField(
  blueprint: Record<string, unknown>,
  path: readonly (string | number)[],
  ctx: z.RefinementCtx,
  message: string
): void {
  let cursor: unknown = blueprint;

  for (const segment of path) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment as string];
    } else {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [...path]
      });
      return;
    }
  }

  if (cursor === undefined || cursor === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: [...path]
    });
  }
}

const classSpecificValidators: Record<DeviceClass, (blueprint: Record<string, unknown>, ctx: z.RefinementCtx) => void> = {
  'device.climate.cooling': (blueprint, ctx) => {
    ensureNestedField(blueprint, ['coverage', 'maxArea_m2'], ctx, 'Cooling units require coverage.maxArea_m2.');
    ensureNestedField(blueprint, ['limits', 'coolingCapacity_kW'], ctx, 'Cooling units require limits.coolingCapacity_kW.');
    ensureNestedField(blueprint, ['settings', 'coolingCapacity'], ctx, 'Cooling units require settings.coolingCapacity.');
    ensureNestedField(blueprint, ['settings', 'targetTemperature'], ctx, 'Cooling units require settings.targetTemperature.');
    ensureNestedField(
      blueprint,
      ['settings', 'targetTemperatureRange'],
      ctx,
      'Cooling units require settings.targetTemperatureRange.'
    );
  },
  'device.climate.co2': (blueprint, ctx) => {
    ensureNestedField(blueprint, ['limits', 'maxCO2_ppm'], ctx, 'CO₂ injectors require limits.maxCO2_ppm.');
    ensureNestedField(blueprint, ['settings', 'targetCO2'], ctx, 'CO₂ injectors require settings.targetCO2.');
    ensureNestedField(blueprint, ['settings', 'pulsePpmPerTick'], ctx, 'CO₂ injectors require settings.pulsePpmPerTick.');
  },
  'device.climate.dehumidifier': (blueprint, ctx) => {
    ensureNestedField(
      blueprint,
      ['limits', 'removalRate_kg_h'],
      ctx,
      'Dehumidifiers require limits.removalRate_kg_h.'
    );
    ensureNestedField(
      blueprint,
      ['settings', 'latentRemovalKgPerTick'],
      ctx,
      'Dehumidifiers require settings.latentRemovalKgPerTick.'
    );
  },
  'device.climate.humidity-controller': (blueprint, ctx) => {
    ensureNestedField(
      blueprint,
      ['settings', 'humidifyRateKgPerTick'],
      ctx,
      'Humidity controllers require settings.humidifyRateKgPerTick.'
    );
    ensureNestedField(
      blueprint,
      ['settings', 'dehumidifyRateKgPerTick'],
      ctx,
      'Humidity controllers require settings.dehumidifyRateKgPerTick.'
    );
  },
  'device.airflow.exhaust': (blueprint, ctx) => {
    ensureNestedField(blueprint, ['airflow_m3_per_h'], ctx, 'Exhaust fans require airflow_m3_per_h.');
    ensureNestedField(blueprint, ['settings', 'airflow'], ctx, 'Exhaust fans require settings.airflow.');
  },
  'device.lighting.vegetative': (blueprint, ctx) => {
    ensureNestedField(blueprint, ['coverage', 'maxArea_m2'], ctx, 'Grow lights require coverage.maxArea_m2.');
    ensureNestedField(blueprint, ['settings', 'ppfd'], ctx, 'Grow lights require settings.ppfd.');
    ensureNestedField(blueprint, ['settings', 'spectralRange'], ctx, 'Grow lights require settings.spectralRange.');
  }
};

export const deviceBlueprintSchema = deviceBlueprintObjectSchema.superRefine((blueprint, ctx) => {
  assertNoMonetaryFields(blueprint, ctx);

  if (!blueprint.coverage_m2 && !blueprint.airflow_m3_per_h) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coverage_m2'],
      message: 'Device blueprint must declare coverage_m2 or airflow_m3_per_h.'
    });
  }

  const validator = classSpecificValidators[blueprint.class as DeviceClass];
  if (validator) {
    validator(blueprint, ctx);
  }
});

export type DeviceBlueprint = z.infer<typeof deviceBlueprintSchema>;

export function parseDeviceBlueprint(input: unknown): DeviceBlueprint {
  return deviceBlueprintSchema.parse(input);
}

export interface DeviceInstanceCapacity {
  readonly powerDraw_W: number;
  readonly efficiency01: number;
  readonly coverage_m2: number;
  readonly airflow_m3_per_h: number;
}

export function toDeviceInstanceCapacity(blueprint: DeviceBlueprint): DeviceInstanceCapacity {
  return {
    powerDraw_W: blueprint.power_W,
    efficiency01: blueprint.efficiency01,
    coverage_m2: blueprint.coverage_m2 ?? 0,
    airflow_m3_per_h: blueprint.airflow_m3_per_h ?? 0
  } satisfies DeviceInstanceCapacity;
}

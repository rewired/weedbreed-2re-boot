import { z } from 'zod';

import { DEVICE_PLACEMENT_SCOPES, ROOM_PURPOSES } from '../entities.js';
import {
  BlueprintClassMismatchError,
  type BlueprintPathOptions,
  deriveBlueprintClassFromPath
} from './taxonomy.js';

const nonEmptyString = z.string().trim().min(1, 'String fields must not be empty.');
const finiteNumber = z.number().finite('Value must be a finite number.');
const slugString = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase, digits, hyphen).');

const placementScopeSchema = z.enum([...DEVICE_PLACEMENT_SCOPES]);
const roomPurposeSchema = z.enum([...ROOM_PURPOSES]);
const TAXONOMY_SEGMENT = '[a-z0-9]+(?:-[a-z0-9]+)*';
const deviceClassSchema = z
  .string({ required_error: 'class is required.' })
  .regex(
    new RegExp(`^device\.${TAXONOMY_SEGMENT}(?:\.${TAXONOMY_SEGMENT})+$`),
    'class must follow the device taxonomy (<domain>.<effect>[.<variant>]).'
  );

/**
 * Canonical device blueprint contract enforced for JSON payloads.
 */
const deviceEffectSchema = z.enum(['thermal', 'humidity', 'lighting', 'airflow', 'filtration']);

const thermalConfigObjectSchema = z.object({
  mode: z.enum(['heat', 'cool', 'auto']),
  max_heat_W: finiteNumber.min(0, 'max_heat_W must be non-negative.').optional(),
  max_cool_W: finiteNumber.min(0, 'max_cool_W must be non-negative.').optional(),
  setpoint_C: finiteNumber.optional()
});

const humidityConfigObjectSchema = z.object({
  mode: z.enum(['humidify', 'dehumidify']),
  capacity_g_per_h: finiteNumber.min(0, 'capacity_g_per_h must be non-negative.')
});

const lightingConfigObjectSchema = z.object({
  ppfd_center_umol_m2s: finiteNumber.min(0, 'ppfd_center_umol_m2s must be non-negative.'),
  photonEfficacy_umol_per_J: finiteNumber
    .min(0, 'photonEfficacy_umol_per_J must be non-negative.')
    .optional()
});

const thermalConfigSchema = thermalConfigObjectSchema.optional();
const humidityConfigSchema = humidityConfigObjectSchema.optional();
const lightingConfigSchema = lightingConfigObjectSchema.optional();

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
      .optional(),
    effects: z.array(deviceEffectSchema).nonempty('effects must not be empty.').optional(),
    thermal: thermalConfigSchema,
    humidity: humidityConfigSchema,
    lighting: lightingConfigSchema
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

const classSpecificValidators: Partial<
  Record<string, (blueprint: Record<string, unknown>, ctx: z.RefinementCtx) => void>
> = {
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

  const effects = blueprint.effects ?? [];

  if (effects.includes('thermal') && !blueprint.thermal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['thermal'],
      message: "thermal config is required when effects include 'thermal'."
    });
  }

  if (effects.includes('humidity') && !blueprint.humidity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['humidity'],
      message: "humidity config is required when effects include 'humidity'."
    });
  }

  if (effects.includes('lighting') && !blueprint.lighting) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lighting'],
      message: "lighting config is required when effects include 'lighting'."
    });
  }

  if (!blueprint.coverage_m2 && !blueprint.airflow_m3_per_h) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coverage_m2'],
      message: 'Device blueprint must declare coverage_m2 or airflow_m3_per_h.'
    });
  }

  const validator =
    classSpecificValidators[blueprint.class as keyof typeof classSpecificValidators];
  if (validator) {
    validator(blueprint, ctx);
  }
});

export type DeviceEffect = z.infer<typeof deviceEffectSchema>;
export type ThermalConfig = z.infer<typeof thermalConfigObjectSchema>;
export type HumidityConfig = z.infer<typeof humidityConfigObjectSchema>;
export type LightingConfig = z.infer<typeof lightingConfigObjectSchema>;
export type DeviceBlueprint = z.infer<typeof deviceBlueprintSchema>;

export interface ParseDeviceBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
  readonly slugRegistry?: Map<string, string>;
}

export function parseDeviceBlueprint(
  input: unknown,
  options: ParseDeviceBlueprintOptions = {}
): DeviceBlueprint {
  const blueprint = deviceBlueprintSchema.parse(input);

  let relativePath: string | undefined;

  if (options.filePath) {
    const derived = deriveBlueprintClassFromPath(options.filePath, options);
    relativePath = derived.relativePath;

    if (derived.className !== blueprint.class) {
      throw new BlueprintClassMismatchError(derived.relativePath, derived.className, blueprint.class);
    }
  }

  if (options.slugRegistry) {
    const registry = options.slugRegistry;
    const key = `${blueprint.class}:${blueprint.slug}`;
    const conflict = registry.get(key);

    if (conflict) {
      const location = relativePath ?? options.filePath ?? blueprint.id;
      throw new Error(
        `Duplicate device slug "${blueprint.slug}" for class "${blueprint.class}" found in ${location}; first defined in ${conflict}.`
      );
    }

    registry.set(key, relativePath ?? options.filePath ?? blueprint.id);
  }

  return blueprint;
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

export interface DeviceEffectConfigs {
  readonly thermal?: ThermalConfig;
  readonly humidity?: HumidityConfig;
  readonly lighting?: LightingConfig;
}

export interface DeviceInstanceEffectConfigProjection {
  readonly effects?: readonly DeviceEffect[];
  readonly effectConfigs?: DeviceEffectConfigs;
}

export function toDeviceInstanceEffectConfigs(
  blueprint: DeviceBlueprint
): DeviceInstanceEffectConfigProjection {
  if (!blueprint.effects || blueprint.effects.length === 0) {
    return { effects: undefined, effectConfigs: undefined };
  }

  const effects = [...blueprint.effects] as readonly DeviceEffect[];
  const configs: DeviceEffectConfigs = {};
  let hasConfig = false;

  if (effects.includes('thermal') && blueprint.thermal) {
    configs.thermal = { ...blueprint.thermal };
    hasConfig = true;
  }

  if (effects.includes('humidity') && blueprint.humidity) {
    configs.humidity = { ...blueprint.humidity };
    hasConfig = true;
  }

  if (effects.includes('lighting') && blueprint.lighting) {
    configs.lighting = { ...blueprint.lighting };
    hasConfig = true;
  }

  return {
    effects,
    effectConfigs: hasConfig ? configs : undefined
  } satisfies DeviceInstanceEffectConfigProjection;
}

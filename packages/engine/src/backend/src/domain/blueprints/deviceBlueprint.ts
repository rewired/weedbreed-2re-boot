import { z } from 'zod';

import { DEVICE_PLACEMENT_SCOPES, ROOM_PURPOSES } from '../entities.ts';
import { finiteNumber, nonEmptyString } from '../schemas/primitives.ts';
import {
  assertBlueprintClassMatchesPath,
  type BlueprintPathOptions,
  deriveBlueprintClassFromPath
} from './taxonomy.ts';
const slugString = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase, digits, hyphen).');

const placementScopeSchema = z.enum([...DEVICE_PLACEMENT_SCOPES]);
const roomPurposeSchema = z.enum([...ROOM_PURPOSES]);
const DEVICE_CLASS_VALUES = [
  'device.climate',
  'device.airflow',
  'device.lighting',
  'device.filtration'
] as const;
const deviceClassSchema = z.enum(DEVICE_CLASS_VALUES, {
  required_error: 'class is required.',
  invalid_type_error: 'class must be one of the supported device domains.'
});

/**
 * Canonical device blueprint contract enforced for JSON payloads.
 */
const deviceEffectSchema = z.enum([
  'thermal',
  'humidity',
  'lighting',
  'airflow',
  'filtration',
  'sensor',
  'co2'
]);

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

const airflowConfigObjectSchema = z.object({
  mode: z.enum(['recirculation', 'exhaust', 'intake']),
  airflow_m3_per_h: finiteNumber.min(0, 'airflow_m3_per_h must be non-negative.')
});

const filtrationConfigObjectSchema = z.object({
  filterType: z.enum(['carbon', 'hepa', 'pre-filter']),
  efficiency01: finiteNumber
    .min(0, 'efficiency01 must be >= 0.')
    .max(1, 'efficiency01 must be <= 1.'),
  basePressureDrop_pa: finiteNumber.min(0, 'basePressureDrop_pa must be non-negative.')
});

const sensorMeasurementTypeSchema = z.enum(['temperature', 'humidity', 'ppfd', 'co2']);

const sensorConfigObjectSchema = z.object({
  measurementType: sensorMeasurementTypeSchema,
  noise01: finiteNumber
    .min(0, 'sensor.noise01 must be >= 0.')
    .max(1, 'sensor.noise01 must be <= 1.')
    .default(0.05)
});

const co2ConfigObjectSchema = z.object({
  target_ppm: finiteNumber.min(0, 'co2.target_ppm must be non-negative.'),
  pulse_ppm_per_tick: finiteNumber.min(0, 'co2.pulse_ppm_per_tick must be non-negative.'),
  safetyMax_ppm: finiteNumber.min(0, 'co2.safetyMax_ppm must be non-negative.'),
  min_ppm: finiteNumber.min(0, 'co2.min_ppm must be non-negative.').optional(),
  ambient_ppm: finiteNumber.min(0, 'co2.ambient_ppm must be non-negative.').optional(),
  hysteresis_ppm: finiteNumber.min(0, 'co2.hysteresis_ppm must be non-negative.').optional()
});

const thermalConfigSchema = thermalConfigObjectSchema.optional();
const humidityConfigSchema = humidityConfigObjectSchema.optional();
const lightingConfigSchema = lightingConfigObjectSchema.optional();
const airflowConfigSchema = airflowConfigObjectSchema.optional();
const filtrationConfigSchema = filtrationConfigObjectSchema.optional();
const sensorConfigSchema = sensorConfigObjectSchema.optional();
const co2ConfigSchema = co2ConfigObjectSchema.optional();

const climateModeSchema = z.enum(['thermal', 'dehumidifier', 'humidity-controller', 'co2']);
const airflowSubtypeSchema = z.enum(['exhaust', 'intake', 'recirculation', 'oscillating']);
const lightingStageSchema = z.enum(['propagation', 'vegetative', 'flowering', 'full-cycle']);
const filtrationMediaSchema = z.enum(['carbon', 'hepa', 'electrostatic', 'uv']);

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

type ClimateValidator = (blueprint: Record<string, unknown>, ctx: z.RefinementCtx) => void;

const climateModeValidators: Partial<Record<z.infer<typeof climateModeSchema>, ClimateValidator>> = {
  thermal: (blueprint, ctx) => {
    ensureNestedField(blueprint, ['coverage', 'maxArea_m2'], ctx, 'Thermal units require coverage.maxArea_m2.');
    ensureNestedField(blueprint, ['limits', 'coolingCapacity_kW'], ctx, 'Thermal units require limits.coolingCapacity_kW.');
    ensureNestedField(blueprint, ['settings', 'coolingCapacity'], ctx, 'Thermal units require settings.coolingCapacity.');
    ensureNestedField(
      blueprint,
      ['settings', 'targetTemperature'],
      ctx,
      'Thermal units require settings.targetTemperature.'
    );
    ensureNestedField(
      blueprint,
      ['settings', 'targetTemperatureRange'],
      ctx,
      'Thermal units require settings.targetTemperatureRange.'
    );
  },
  co2: (blueprint, ctx) => {
    ensureNestedField(blueprint, ['limits', 'maxCO2_ppm'], ctx, 'CO₂ injectors require limits.maxCO2_ppm.');
    ensureNestedField(blueprint, ['settings', 'targetCO2'], ctx, 'CO₂ injectors require settings.targetCO2.');
    ensureNestedField(blueprint, ['settings', 'pulsePpmPerTick'], ctx, 'CO₂ injectors require settings.pulsePpmPerTick.');
  },
  dehumidifier: (blueprint, ctx) => {
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
  'humidity-controller': (blueprint, ctx) => {
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
  }
};

const airflowSubtypeValidators: Partial<Record<z.infer<typeof airflowSubtypeSchema>, ClimateValidator>> = {
  exhaust: (blueprint, ctx) => {
    ensureNestedField(blueprint, ['airflow_m3_per_h'], ctx, 'Exhaust fans require airflow_m3_per_h.');
    ensureNestedField(blueprint, ['settings', 'airflow'], ctx, 'Exhaust fans require settings.airflow.');
  }
};

const lightingValidators: ClimateValidator = (blueprint, ctx) => {
  ensureNestedField(blueprint, ['coverage', 'maxArea_m2'], ctx, 'Lighting devices require coverage.maxArea_m2.');
  ensureNestedField(blueprint, ['settings', 'ppfd'], ctx, 'Lighting devices require settings.ppfd.');
  ensureNestedField(blueprint, ['settings', 'spectralRange'], ctx, 'Lighting devices require settings.spectralRange.');
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

  if (effects.includes('airflow') && !blueprint.airflow) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['airflow'],
      message: "airflow config is required when effects include 'airflow'."
    });
  }

  if (effects.includes('filtration') && !blueprint.filtration) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['filtration'],
      message: "filtration config is required when effects include 'filtration'."
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
    blueprint.class === 'device.climate'
      ? climateModeValidators[blueprint.mode as z.infer<typeof climateModeSchema>]
      : blueprint.class === 'device.airflow'
        ? airflowSubtypeValidators[blueprint.subtype as z.infer<typeof airflowSubtypeSchema>]
        : blueprint.class === 'device.lighting'
          ? lightingValidators
          : undefined;
  if (validator) {
    validator(blueprint, ctx);
  }

  if (blueprint.class === 'device.climate') {
    const parsedMode = climateModeSchema.safeParse(blueprint.mode);

    if (!parsedMode.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mode'],
        message: "mode is required for device.climate and must be one of 'thermal', 'dehumidifier', 'humidity-controller', 'co2'."
      });
    }
  } else if (blueprint.mode !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mode'],
      message: 'mode is only supported for device.climate blueprints.'
    });
  }

  if (blueprint.class === 'device.airflow') {
    const parsedSubtype = airflowSubtypeSchema.safeParse(blueprint.subtype);

    if (!parsedSubtype.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subtype'],
        message: "subtype is required for device.airflow and must be one of 'exhaust', 'intake', 'recirculation', 'oscillating'."
      });
    }
  } else if (blueprint.subtype !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subtype'],
      message: 'subtype is only supported for device.airflow blueprints.'
    });
  }

  if (blueprint.class === 'device.lighting') {
    const parsedStage = lightingStageSchema.safeParse(blueprint.stage);

    if (!parsedStage.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stage'],
        message: "stage is required for device.lighting and must be one of 'propagation', 'vegetative', 'flowering', 'full-cycle'."
      });
    }
  } else if (blueprint.stage !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stage'],
      message: 'stage is only supported for device.lighting blueprints.'
    });
  }

  if (blueprint.class === 'device.filtration') {
    const parsedMedia = filtrationMediaSchema.safeParse(blueprint.media);

    if (!parsedMedia.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['media'],
        message: "media is required for device.filtration and must be one of 'carbon', 'hepa', 'electrostatic', 'uv'."
      });
    }
  } else if (blueprint.media !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['media'],
      message: 'media is only supported for device.filtration blueprints.'
    });
  }
});

export type DeviceEffect = z.infer<typeof deviceEffectSchema>;
export type ThermalConfig = z.infer<typeof thermalConfigObjectSchema>;
export type HumidityConfig = z.infer<typeof humidityConfigObjectSchema>;
export type LightingConfig = z.infer<typeof lightingConfigObjectSchema>;
export type Co2Config = z.infer<typeof co2ConfigObjectSchema>;
export type AirflowConfig = z.infer<typeof airflowConfigObjectSchema>;
export type FiltrationConfig = z.infer<typeof filtrationConfigObjectSchema>;
export type SensorConfig = z.infer<typeof sensorConfigObjectSchema>;
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
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
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
  readonly airflow?: AirflowConfig;
  readonly filtration?: FiltrationConfig;
  readonly sensor?: SensorConfig;
  readonly co2?: Co2Config;
}

export interface DeviceInstanceEffectConfigProjection {
  readonly effects?: readonly DeviceEffect[];
  readonly effectConfigs?: DeviceEffectConfigs;
}

function clampNoise01(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function inferSensorMeasurementType(slug: string): SensorConfig['measurementType'] | null {
  const lower = slug.toLowerCase();

  if (!lower.includes('sensor') && !lower.includes('probe')) {
    return null;
  }

  if (lower.includes('temp') || lower.includes('therm')) {
    return 'temperature';
  }

  if (lower.includes('humid') || lower.includes('rh')) {
    return 'humidity';
  }

  if (lower.includes('ppfd') || lower.includes('par') || lower.includes('light')) {
    return 'ppfd';
  }

  return null;
}

function deriveSensorConfig(blueprint: DeviceBlueprint): SensorConfig | undefined {
  if (blueprint.sensor) {
    return {
      measurementType: blueprint.sensor.measurementType,
      noise01: clampNoise01(blueprint.sensor.noise01, 0.05)
    } satisfies SensorConfig;
  }

  const inferred = inferSensorMeasurementType(blueprint.slug);

  if (!inferred) {
    return undefined;
  }

  return {
    measurementType: inferred,
    noise01: 0.05
  } satisfies SensorConfig;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function deriveCo2Config(blueprint: DeviceBlueprint): Co2Config | null {
  if (blueprint.co2) {
    return { ...blueprint.co2 } satisfies Co2Config;
  }

  const settings = (blueprint as Record<string, unknown>).settings as Record<string, unknown> | undefined;
  const limits = (blueprint as Record<string, unknown>).limits as Record<string, unknown> | undefined;

  const target = toFiniteNumber(settings?.targetCO2);
  const pulse = toFiniteNumber(settings?.pulsePpmPerTick);
  const safetyMax =
    toFiniteNumber(limits?.maxCO2_ppm) ??
    (Array.isArray(settings?.targetCO2Range) ? toFiniteNumber(settings?.targetCO2Range[1]) : null);

  if (target === null || pulse === null || safetyMax === null) {
    return null;
  }

  const config: Co2Config = {
    target_ppm: target,
    pulse_ppm_per_tick: pulse,
    safetyMax_ppm: safetyMax
  } satisfies Co2Config;

  const minCandidate =
    toFiniteNumber(limits?.minCO2_ppm) ??
    (Array.isArray(settings?.targetCO2Range) ? toFiniteNumber(settings?.targetCO2Range[0]) : null);

  if (minCandidate !== null) {
    config.min_ppm = minCandidate;
  }

  const ambientCandidate = toFiniteNumber(limits?.ambientCO2_ppm ?? settings?.ambientCO2);

  if (ambientCandidate !== null) {
    config.ambient_ppm = ambientCandidate;
  }

  const hysteresisCandidate = toFiniteNumber(settings?.hysteresis ?? settings?.hysteresis_ppm);

  if (hysteresisCandidate !== null) {
    config.hysteresis_ppm = hysteresisCandidate;
  }

  return config;
}

export function toDeviceInstanceEffectConfigs(
  blueprint: DeviceBlueprint
): DeviceInstanceEffectConfigProjection {
  const effects: DeviceEffect[] = blueprint.effects ? [...blueprint.effects] : [];
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

  if (effects.includes('airflow') && blueprint.airflow) {
    configs.airflow = { ...blueprint.airflow };
    hasConfig = true;
  }

  if (effects.includes('filtration') && blueprint.filtration) {
    configs.filtration = { ...blueprint.filtration };
    hasConfig = true;
  }

  if (effects.includes('sensor')) {
    const sensorConfig = deriveSensorConfig(blueprint);

    if (sensorConfig) {
      configs.sensor = sensorConfig;
      hasConfig = true;
    }
  }

  const hasCo2Mode = blueprint.mode === 'co2';
  const existingCo2 = effects.includes('co2');

  if (hasCo2Mode && !existingCo2) {
    effects.push('co2');
  }

  if ((existingCo2 || hasCo2Mode) && !configs.co2) {
    const co2Config = deriveCo2Config(blueprint);

    if (co2Config) {
      configs.co2 = co2Config;
      hasConfig = true;
    }
  }

  const nextEffects = effects.length > 0 ? (effects as readonly DeviceEffect[]) : undefined;

  return {
    effects: nextEffects,
    effectConfigs: hasConfig ? configs : undefined
  } satisfies DeviceInstanceEffectConfigProjection;
}

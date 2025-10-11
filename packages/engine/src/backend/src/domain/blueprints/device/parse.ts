import { deviceBlueprintSchema, type DeviceBlueprint } from './schemaByClass.ts';
import { type Co2Config, type DeviceEffect, type SensorConfig } from './schemaBase.ts';
import { guardDeviceBlueprintTaxonomy, type DeviceTaxonomyGuardOptions } from './guardTaxonomy.ts';

interface BlueprintSettingsRecord {
  readonly targetCO2?: unknown;
  readonly targetCO2Range?: unknown;
  readonly pulsePpmPerTick?: unknown;
  readonly ambientCO2?: unknown;
  readonly hysteresis?: unknown;
  readonly hysteresis_ppm?: unknown;
}

interface BlueprintLimitsRecord {
  readonly maxCO2_ppm?: unknown;
  readonly minCO2_ppm?: unknown;
  readonly ambientCO2_ppm?: unknown;
}

const DEFAULT_SENSOR_NOISE01 = 0.05;

export interface ParseDeviceBlueprintOptions extends DeviceTaxonomyGuardOptions {
  readonly slugRegistry?: Map<string, string>;
}

export function parseDeviceBlueprint(
  input: unknown,
  options: ParseDeviceBlueprintOptions = {}
): DeviceBlueprint {
  const blueprint = deviceBlueprintSchema.parse(input);
  const { relativePath } = guardDeviceBlueprintTaxonomy(blueprint.class, options);

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
  readonly thermal?: DeviceBlueprint['thermal'];
  readonly humidity?: DeviceBlueprint['humidity'];
  readonly lighting?: DeviceBlueprint['lighting'];
  readonly airflow?: DeviceBlueprint['airflow'];
  readonly filtration?: DeviceBlueprint['filtration'];
  readonly sensor?: SensorConfig;
  readonly co2?: Co2Config;
}

type MutableDeviceEffectConfigs = {
  -readonly [K in keyof DeviceEffectConfigs]?: DeviceEffectConfigs[K];
};

export interface DeviceInstanceEffectConfigProjection {
  readonly effects?: readonly DeviceEffect[];
  readonly effectConfigs?: DeviceEffectConfigs;
}

function clampNoise01(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
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
      noise01: clampNoise01(blueprint.sensor.noise01, DEFAULT_SENSOR_NOISE01)
    } satisfies SensorConfig;
  }

  const inferred = inferSensorMeasurementType(blueprint.slug);

  if (!inferred) {
    return undefined;
  }

  return {
    measurementType: inferred,
    noise01: DEFAULT_SENSOR_NOISE01
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

  const settings = (blueprint as { settings?: BlueprintSettingsRecord }).settings;
  const limits = (blueprint as { limits?: BlueprintLimitsRecord }).limits;
  const targetRangeValue = settings?.targetCO2Range;
  const targetRange = Array.isArray(targetRangeValue) ? targetRangeValue : null;

  const target = toFiniteNumber(settings?.targetCO2);
  const pulse = toFiniteNumber(settings?.pulsePpmPerTick);
  const safetyMax =
    toFiniteNumber(limits?.maxCO2_ppm) ??
    (targetRange && targetRange.length > 1 ? toFiniteNumber(targetRange[1]) : null);

  if (target === null || pulse === null || safetyMax === null) {
    return null;
  }

  const configBase = {
    target_ppm: target,
    pulse_ppm_per_tick: pulse,
    safetyMax_ppm: safetyMax
  };

  const optionalConfig: Partial<Co2Config> = {};

  const minCandidate =
    toFiniteNumber(limits?.minCO2_ppm) ??
    (targetRange && targetRange.length > 0 ? toFiniteNumber(targetRange[0]) : null);

  if (minCandidate !== null) {
    optionalConfig.min_ppm = minCandidate;
  }

  const ambientCandidate = toFiniteNumber(limits?.ambientCO2_ppm ?? settings?.ambientCO2);

  if (ambientCandidate !== null) {
    optionalConfig.ambient_ppm = ambientCandidate;
  }

  const hysteresisCandidate = toFiniteNumber(settings?.hysteresis ?? settings?.hysteresis_ppm);

  if (hysteresisCandidate !== null) {
    optionalConfig.hysteresis_ppm = hysteresisCandidate;
  }

  return {
    ...configBase,
    ...optionalConfig
  } satisfies Co2Config;
}

export function toDeviceInstanceEffectConfigs(
  blueprint: DeviceBlueprint
): DeviceInstanceEffectConfigProjection {
  const effects: DeviceEffect[] = blueprint.effects ? [...blueprint.effects] : [];
  const configs: MutableDeviceEffectConfigs = {};
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
    effectConfigs: hasConfig ? (configs as DeviceEffectConfigs) : undefined
  } satisfies DeviceInstanceEffectConfigProjection;
}

export { deviceBlueprintSchema };

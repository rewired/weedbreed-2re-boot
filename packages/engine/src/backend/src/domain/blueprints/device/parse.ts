import {
  deviceBlueprintSchema,
  type Co2Config,
  type DeviceBlueprint,
  type DeviceEffect,
  type SensorConfig
} from './schemaByClass.ts';
import { guardDeviceBlueprintTaxonomy, type DeviceTaxonomyGuardOptions } from './guardTaxonomy.ts';

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

export { deviceBlueprintSchema };

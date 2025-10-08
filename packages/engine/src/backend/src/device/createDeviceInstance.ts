import { type DeviceEffectConfigs, type DeviceEffectType } from '../domain/entities.js';
import type { Uuid } from '../domain/schemas/primitives.js';
import {
  toDeviceInstanceEffectConfigs,
  type DeviceBlueprint
} from '../domain/blueprints/deviceBlueprint.js';
import { createRng, type RandomNumberGenerator } from '../util/rng.js';
import { clamp01 } from '../util/math.js';

export interface DeviceQualityPolicy {
  sampleQuality01(rng: RandomNumberGenerator): number;
}

export interface DeviceInstanceSeededAttributes {
  readonly quality01: number;
  readonly effects?: readonly DeviceEffectType[];
  readonly effectConfigs?: DeviceEffectConfigs;
}

export function createDeviceInstance(
  qualityPolicy: DeviceQualityPolicy,
  seed: string,
  id: Uuid,
  blueprint: DeviceBlueprint
): DeviceInstanceSeededAttributes {
  if (!qualityPolicy) {
    throw new Error('qualityPolicy must be provided');
  }

  if (!blueprint) {
    throw new Error('blueprint must be provided');
  }

  const rng = createRng(seed, `device:${id}`);
  const sampledQuality = qualityPolicy.sampleQuality01(rng);
  if (!Number.isFinite(sampledQuality)) {
    throw new Error('quality01 sample must be a finite number');
  }
  const quality01 = clamp01(sampledQuality);
  const { effects, effectConfigs } = toDeviceInstanceEffectConfigs(blueprint);
  const frozenEffects = freezeEffects(effects);
  const frozenConfigs = freezeEffectConfigs(effectConfigs);

  return Object.freeze({
    quality01,
    effects: frozenEffects,
    effectConfigs: frozenConfigs
  }) as DeviceInstanceSeededAttributes;
}

function freezeEffects(effects?: readonly DeviceEffectType[]): readonly DeviceEffectType[] | undefined {
  if (!effects || effects.length === 0) {
    return undefined;
  }

  return Object.freeze([...effects]) as readonly DeviceEffectType[];
}

function freezeEffectConfigs(
  configs?: DeviceEffectConfigs
): DeviceEffectConfigs | undefined {
  if (!configs) {
    return undefined;
  }

  const thermal = configs.thermal ? Object.freeze({ ...configs.thermal }) : undefined;
  const humidity = configs.humidity ? Object.freeze({ ...configs.humidity }) : undefined;
  const lighting = configs.lighting ? Object.freeze({ ...configs.lighting }) : undefined;
  const airflow = configs.airflow ? Object.freeze({ ...configs.airflow }) : undefined;
  const filtration = configs.filtration ? Object.freeze({ ...configs.filtration }) : undefined;
  const sensor = configs.sensor ? Object.freeze({ ...configs.sensor }) : undefined;
  const co2 = configs.co2 ? Object.freeze({ ...configs.co2 }) : undefined;

  if (!thermal && !humidity && !lighting && !airflow && !filtration && !sensor && !co2) {
    return undefined;
  }

  return Object.freeze({
    ...(thermal ? { thermal } : {}),
    ...(humidity ? { humidity } : {}),
    ...(lighting ? { lighting } : {}),
    ...(airflow ? { airflow } : {}),
    ...(filtration ? { filtration } : {}),
    ...(sensor ? { sensor } : {}),
    ...(co2 ? { co2 } : {})
  } satisfies DeviceEffectConfigs);
}

import {
  type DeviceEffectConfigs,
  type DeviceEffectType,
  type Uuid
} from '../domain/entities.js';
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

  const next: DeviceEffectConfigs = {};

  if (configs.thermal) {
    next.thermal = Object.freeze({ ...configs.thermal });
  }

  if (configs.humidity) {
    next.humidity = Object.freeze({ ...configs.humidity });
  }

  if (configs.lighting) {
    next.lighting = Object.freeze({ ...configs.lighting });
  }

  if (configs.airflow) {
    next.airflow = Object.freeze({ ...configs.airflow });
  }

  if (configs.filtration) {
    next.filtration = Object.freeze({ ...configs.filtration });
  }

  if (configs.sensor) {
    next.sensor = Object.freeze({ ...configs.sensor });
  }

  return Object.freeze(next);
}

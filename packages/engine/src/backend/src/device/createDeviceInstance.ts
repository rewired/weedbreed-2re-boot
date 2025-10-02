import type { Uuid } from '../domain/entities.js';
import { createRng, type RandomNumberGenerator } from '../util/rng.js';

export interface DeviceQualityPolicy {
  sampleQuality01(rng: RandomNumberGenerator): number;
}

export interface DeviceInstanceSeededAttributes {
  readonly quality01: number;
}

export function createDeviceInstance(
  qualityPolicy: DeviceQualityPolicy,
  seed: string,
  id: Uuid
): DeviceInstanceSeededAttributes {
  if (!qualityPolicy) {
    throw new Error('qualityPolicy must be provided');
  }

  const rng = createRng(seed, `device:${id}`);
  const sampledQuality = qualityPolicy.sampleQuality01(rng);
  const quality01 = clamp01(sampledQuality);

  return Object.freeze({ quality01 }) as DeviceInstanceSeededAttributes;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('quality01 sample must be a finite number');
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

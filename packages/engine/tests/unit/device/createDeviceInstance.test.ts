import { describe, expect, it } from 'vitest';

import {
  createDeviceInstance,
  type DeviceQualityPolicy,
  type Uuid
} from '@/backend/src/domain/world.js';

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'device-factory-seed';

function uuid(value: string): Uuid {
  return value as Uuid;
}

describe('createDeviceInstance', () => {
  it('returns identical quality for repeated {seed, id} pairs', () => {
    const deviceId = uuid('50000000-0000-0000-0000-000000000001');

    const first = createDeviceInstance(QUALITY_POLICY, WORLD_SEED, deviceId);
    const second = createDeviceInstance(QUALITY_POLICY, WORLD_SEED, deviceId);

    expect(first.quality01).toBe(second.quality01);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('clamps sampled quality to the unit interval', () => {
    const highPolicy: DeviceQualityPolicy = {
      sampleQuality01: () => 1.42
    };

    const lowPolicy: DeviceQualityPolicy = {
      sampleQuality01: () => -0.2
    };

    expect(
      createDeviceInstance(highPolicy, WORLD_SEED, uuid('50000000-0000-0000-0000-000000000002')).quality01
    ).toBe(1);

    expect(
      createDeviceInstance(lowPolicy, WORLD_SEED, uuid('50000000-0000-0000-0000-000000000003')).quality01
    ).toBe(0);
  });
});

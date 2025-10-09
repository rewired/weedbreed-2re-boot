import { describe, expect, it } from 'vitest';

import { expectDefined } from '../../util/expectors';

import {
  createDeviceInstance,
  type DeviceQualityPolicy,
  type Uuid
} from '@/backend/src/domain/world';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint';

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'device-factory-seed';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const BASE_BLUEPRINT: DeviceBlueprint = {
  id: '60000000-0000-0000-0000-000000000000',
  slug: 'unit-test-device',
  class: 'device.test.mock',
  name: 'Unit Test Device',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 500,
  efficiency01: 0.75,
  coverage_m2: 10,
  airflow_m3_per_h: 0
};

function buildBlueprint(overrides: Partial<DeviceBlueprint>): DeviceBlueprint {
  return {
    ...BASE_BLUEPRINT,
    ...overrides,
    allowedRoomPurposes: overrides.allowedRoomPurposes ?? [...BASE_BLUEPRINT.allowedRoomPurposes]
  };
}

describe('createDeviceInstance', () => {
  it('copies effects array from blueprint to device instance', () => {
    const blueprint = buildBlueprint({
      id: '60000000-0000-0000-0000-000000000010',
      slug: 'effect-test-device',
      effects: ['thermal', 'humidity'],
      thermal: { mode: 'heat' },
      humidity: { mode: 'dehumidify', capacity_g_per_h: 400 }
    });

    const device = createDeviceInstance(
      QUALITY_POLICY,
      WORLD_SEED,
      uuid('60000000-0000-0000-0000-000000000001'),
      blueprint
    );

    expect(device.effects).toEqual(['thermal', 'humidity']);
  });

  it('copies thermal config from blueprint to device instance', () => {
    const blueprint = buildBlueprint({
      id: '60000000-0000-0000-0000-000000000011',
      slug: 'thermal-test-device',
      effects: ['thermal'],
      thermal: { mode: 'cool', max_cool_W: 3_000, setpoint_C: 22 }
    });

    const device = createDeviceInstance(
      QUALITY_POLICY,
      WORLD_SEED,
      uuid('60000000-0000-0000-0000-000000000002'),
      blueprint
    );

    expect(device.effectConfigs?.thermal).toEqual({
      mode: 'cool',
      max_cool_W: 3_000,
      setpoint_C: 22
    });
  });

  it('copies humidity config from blueprint to device instance', () => {
    const blueprint = buildBlueprint({
      id: '60000000-0000-0000-0000-000000000012',
      slug: 'humidity-test-device',
      effects: ['humidity'],
      humidity: { mode: 'dehumidify', capacity_g_per_h: 750 }
    });

    const device = createDeviceInstance(
      QUALITY_POLICY,
      WORLD_SEED,
      uuid('60000000-0000-0000-0000-000000000003'),
      blueprint
    );

    expect(device.effectConfigs?.humidity).toEqual({
      mode: 'dehumidify',
      capacity_g_per_h: 750
    });
  });

  it('copies lighting config from blueprint to device instance', () => {
    const blueprint = buildBlueprint({
      id: '60000000-0000-0000-0000-000000000013',
      slug: 'lighting-test-device',
      effects: ['lighting'],
      lighting: { ppfd_center_umol_m2s: 800, photonEfficacy_umol_per_J: 2.4 }
    });

    const device = createDeviceInstance(
      QUALITY_POLICY,
      WORLD_SEED,
      uuid('60000000-0000-0000-0000-000000000004'),
      blueprint
    );

    expect(device.effectConfigs?.lighting).toEqual({
      ppfd_center_umol_m2s: 800,
      photonEfficacy_umol_per_J: 2.4
    });
  });

  it('handles blueprint without effects (backward compatibility)', () => {
    const device = createDeviceInstance(
      QUALITY_POLICY,
      WORLD_SEED,
      uuid('60000000-0000-0000-0000-000000000005'),
      BASE_BLUEPRINT
    );

    expect(device.effects).toBeUndefined();
    expect(device.effectConfigs).toBeUndefined();
  });

  it('deep freezes effect configs to prevent mutation', () => {
    const blueprint = buildBlueprint({
      id: '60000000-0000-0000-0000-000000000014',
      slug: 'freeze-test-device',
      effects: ['thermal'],
      thermal: { mode: 'heat' }
    });

    const device = createDeviceInstance(
      QUALITY_POLICY,
      WORLD_SEED,
      uuid('60000000-0000-0000-0000-000000000006'),
      blueprint
    );

    expect(Object.isFrozen(device)).toBe(true);
    expect(Object.isFrozen(device.effectConfigs)).toBe(true);
    expect(Object.isFrozen(device.effectConfigs?.thermal)).toBe(true);
    expect(Object.isFrozen(device.effects)).toBe(true);
    const effectConfigs = expectDefined(device.effectConfigs);
    const thermalConfig = expectDefined(effectConfigs.thermal);

    expect(() => {
      (thermalConfig as { mode: string }).mode = 'cool';
    }).toThrow(TypeError);
  });

  it('returns identical quality for repeated {seed, id} pairs', () => {
    const deviceId = uuid('50000000-0000-0000-0000-000000000001');

    const first = createDeviceInstance(QUALITY_POLICY, WORLD_SEED, deviceId, BASE_BLUEPRINT);
    const second = createDeviceInstance(QUALITY_POLICY, WORLD_SEED, deviceId, BASE_BLUEPRINT);

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
      createDeviceInstance(
        highPolicy,
        WORLD_SEED,
        uuid('50000000-0000-0000-0000-000000000002'),
        BASE_BLUEPRINT
      ).quality01
    ).toBe(1);

    expect(
      createDeviceInstance(
        lowPolicy,
        WORLD_SEED,
        uuid('50000000-0000-0000-0000-000000000003'),
        BASE_BLUEPRINT
      ).quality01
    ).toBe(0);
  });
});

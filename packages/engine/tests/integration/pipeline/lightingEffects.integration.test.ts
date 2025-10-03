import { describe, expect, it } from 'vitest';

import {
  HOURS_PER_TICK,
  SECONDS_PER_HOUR
} from '@/backend/src/constants/simConstants.js';
import { runTick } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import {
  createDeviceInstance,
  type DeviceQualityPolicy,
  type Uuid,
  type ZoneDeviceInstance
} from '@/backend/src/domain/world.js';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint.js';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'lighting-effects-seed';

const LED_VEG_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000002',
  slug: 'led-veg-light',
  class: 'device.test.lighting',
  name: 'LED Veg Light',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 600,
  efficiency01: 0.7,
  coverage_m2: 1.2,
  airflow_m3_per_h: 0
};

const VEG_LIGHT_A_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000005',
  slug: 'veg-light-a',
  class: 'device.test.lighting',
  name: 'Veg Light A',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 500,
  efficiency01: 0.65,
  coverage_m2: 1,
  airflow_m3_per_h: 0
};

const VEG_LIGHT_B_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000006',
  slug: 'veg-light-b',
  class: 'device.test.lighting',
  name: 'Veg Light B',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 450,
  efficiency01: 0.6,
  coverage_m2: 1,
  airflow_m3_per_h: 0
};

const DIMMED_LIGHT_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000008',
  slug: 'dimmed-light',
  class: 'device.test.lighting',
  name: 'Dimmed Light',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 400,
  efficiency01: 0.6,
  coverage_m2: 1,
  airflow_m3_per_h: 0
};

const INVALID_LIGHT_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000010',
  slug: 'invalid-light',
  class: 'device.test.lighting',
  name: 'Invalid Light',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 500,
  efficiency01: 0.6,
  coverage_m2: 1,
  airflow_m3_per_h: 0
};

function deviceQuality(id: Uuid, blueprint: DeviceBlueprint): number {
  return createDeviceInstance(QUALITY_POLICY, WORLD_SEED, id, blueprint).quality01;
}

describe('Tick pipeline — lighting effects', () => {
  it('accumulates PPFD and DLI from lighting devices', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    const deviceId = uuid('40000000-0000-0000-0000-000000000001');
    const lightingDevice: ZoneDeviceInstance = {
      id: deviceId,
      slug: LED_VEG_BLUEPRINT.slug,
      name: LED_VEG_BLUEPRINT.name,
      blueprintId: uuid(LED_VEG_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(deviceId, LED_VEG_BLUEPRINT),
      condition01: 0.96,
      powerDraw_W: 600,
      dutyCycle01: 1,
      efficiency01: 0.7,
      coverage_m2: 1.2,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [lightingDevice];

    const tickDurationHours = 0.25;
    const { world: nextWorld } = runTick(world, { tickDurationHours });
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const expectedPPFD = lightingDevice.powerDraw_W * lightingDevice.efficiency01 * 2.5;
    const expectedDLI = (expectedPPFD * tickDurationHours * SECONDS_PER_HOUR) / 1_000_000;

    expect(nextZone.ppfd_umol_m2s).toBeCloseTo(expectedPPFD, 5);
    expect(nextZone.dli_mol_m2d_inc).toBeCloseTo(expectedDLI, 5);
  });

  it('accumulates PPFD from multiple lights', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    const deviceAId = uuid('40000000-0000-0000-0000-000000000003');
    const deviceBId = uuid('40000000-0000-0000-0000-000000000004');

    const lightA: ZoneDeviceInstance = {
      id: deviceAId,
      slug: VEG_LIGHT_A_BLUEPRINT.slug,
      name: VEG_LIGHT_A_BLUEPRINT.name,
      blueprintId: uuid(VEG_LIGHT_A_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(deviceAId, VEG_LIGHT_A_BLUEPRINT),
      condition01: 0.94,
      powerDraw_W: 500,
      dutyCycle01: 1,
      efficiency01: 0.65,
      coverage_m2: 1,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    const lightB: ZoneDeviceInstance = {
      id: deviceBId,
      slug: VEG_LIGHT_B_BLUEPRINT.slug,
      name: VEG_LIGHT_B_BLUEPRINT.name,
      blueprintId: uuid(VEG_LIGHT_B_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(deviceBId, VEG_LIGHT_B_BLUEPRINT),
      condition01: 0.93,
      powerDraw_W: 450,
      dutyCycle01: 1,
      efficiency01: 0.6,
      coverage_m2: 1,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [lightA, lightB];

    const { world: nextWorld } = runTick(world, {});
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const expectedPPFD =
      lightA.powerDraw_W * lightA.efficiency01 * 2.5 +
      lightB.powerDraw_W * lightB.efficiency01 * 2.5;
    const expectedDLI = (expectedPPFD * HOURS_PER_TICK * SECONDS_PER_HOUR) / 1_000_000;

    expect(nextZone.ppfd_umol_m2s).toBeCloseTo(expectedPPFD, 5);
    expect(nextZone.dli_mol_m2d_inc).toBeCloseTo(expectedDLI, 5);
  });

  it('respects dimming factor from duty cycle', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    const deviceId = uuid('40000000-0000-0000-0000-000000000007');
    const dimmedLight: ZoneDeviceInstance = {
      id: deviceId,
      slug: DIMMED_LIGHT_BLUEPRINT.slug,
      name: DIMMED_LIGHT_BLUEPRINT.name,
      blueprintId: uuid(DIMMED_LIGHT_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(deviceId, DIMMED_LIGHT_BLUEPRINT),
      condition01: 0.91,
      powerDraw_W: 400,
      dutyCycle01: 0.5,
      efficiency01: 0.6,
      coverage_m2: 1,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [dimmedLight];

    const { world: nextWorld } = runTick(world, {});
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const fullOutput = dimmedLight.powerDraw_W * dimmedLight.efficiency01 * 2.5;
    const expectedPPFD = fullOutput * dimmedLight.dutyCycle01;
    const expectedDLI = (expectedPPFD * HOURS_PER_TICK * SECONDS_PER_HOUR) / 1_000_000;

    expect(nextZone.ppfd_umol_m2s).toBeCloseTo(expectedPPFD, 5);
    expect(nextZone.dli_mol_m2d_inc).toBeCloseTo(expectedDLI, 5);
  });

  it('returns zero effect when coverage is zero', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    const deviceId = uuid('40000000-0000-0000-0000-000000000009');
    const invalidLight: ZoneDeviceInstance = {
      id: deviceId,
      slug: INVALID_LIGHT_BLUEPRINT.slug,
      name: INVALID_LIGHT_BLUEPRINT.name,
      blueprintId: uuid(INVALID_LIGHT_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(deviceId, INVALID_LIGHT_BLUEPRINT),
      condition01: 0.9,
      powerDraw_W: 500,
      dutyCycle01: 1,
      efficiency01: 0.6,
      coverage_m2: 0,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [invalidLight];

    const { world: nextWorld } = runTick(world, {});
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    expect(nextZone.ppfd_umol_m2s).toBe(0);
    expect(nextZone.dli_mol_m2d_inc).toBe(0);
  });
});

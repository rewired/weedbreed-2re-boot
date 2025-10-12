import { describe, expect, it } from 'vitest';

import {
  CP_AIR_J_PER_KG_K,
  HOURS_PER_TICK,
  SECONDS_PER_HOUR
} from '@/backend/src/constants/simConstants';
import type { EngineRunContext } from '@/backend/src/engine/Engine';
import { runTick } from '@/backend/src/engine/Engine';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import { type DeviceQualityPolicy, type Uuid, type ZoneDeviceInstance } from '@/backend/src/domain/world';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint';
import { deviceQuality } from '../../testUtils/deviceHelpers.ts';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'device-thermals-seed';

const LIGHTING_BLUEPRINT: DeviceBlueprint = {
  id: '20000000-0000-0000-0000-000000000002',
  slug: 'veg-light',
  class: 'device.test.lighting',
  name: 'Veg Light',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 600,
  efficiency01: 0.2,
  coverage_m2: 60,
  airflow_m3_per_h: 0
};

const HVAC_BLUEPRINT: DeviceBlueprint = {
  id: '20000000-0000-0000-0000-000000000004',
  slug: 'zone-hvac',
  class: 'device.test.hvac',
  name: 'Zone HVAC',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 800,
  efficiency01: 0.6,
  coverage_m2: 60,
  airflow_m3_per_h: 0
};

describe('Tick pipeline — device thermal effects', () => {
  it('integrates heat additions and HVAC removals across the first two stages', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];
    const initialTemperatureC = zone.environment.airTemperatureC;

    const lightingDeviceId = uuid('20000000-0000-0000-0000-000000000001');
    const lightingDevice: ZoneDeviceInstance = {
      id: lightingDeviceId,
      slug: LIGHTING_BLUEPRINT.slug,
      name: LIGHTING_BLUEPRINT.name,
      blueprintId: uuid(LIGHTING_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, lightingDeviceId, LIGHTING_BLUEPRINT),
      condition01: 0.94,
      powerDraw_W: 600,
      dutyCycle01: 1,
      efficiency01: 0.2,
      coverage_m2: 60,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    const hvacDeviceId = uuid('20000000-0000-0000-0000-000000000003');
    const hvacDevice: ZoneDeviceInstance = {
      id: hvacDeviceId,
      slug: HVAC_BLUEPRINT.slug,
      name: HVAC_BLUEPRINT.name,
      blueprintId: uuid(HVAC_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, hvacDeviceId, HVAC_BLUEPRINT),
      condition01: 0.9,
      powerDraw_W: 800,
      dutyCycle01: 1,
      efficiency01: 0.6,
      coverage_m2: 60,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 500
    } satisfies ZoneDeviceInstance;

    zone.devices = [lightingDevice, hvacDevice];

    const ctx: EngineRunContext = {
      tickDurationHours: 0.5
    } satisfies EngineRunContext;

    const { world: nextWorld } = runTick(world, ctx);

    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];
    const tickHours = ctx.tickDurationHours ?? HOURS_PER_TICK;
    const tickSeconds = tickHours * SECONDS_PER_HOUR;
    const airMassKg = zone.airMass_kg;

    const heating_W = lightingDevice.powerDraw_W * (1 - lightingDevice.efficiency01);
    const hvacCooling_W = Math.min(
      hvacDevice.powerDraw_W * hvacDevice.dutyCycle01 * hvacDevice.efficiency01,
      hvacDevice.sensibleHeatRemovalCapacity_W
    );
    const additionDeltaC = (heating_W * tickSeconds) / (airMassKg * CP_AIR_J_PER_KG_K);
    const removalDeltaC = (hvacCooling_W * tickSeconds) / (airMassKg * CP_AIR_J_PER_KG_K);

    const expectedTemperatureC = initialTemperatureC + additionDeltaC - removalDeltaC;

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(expectedTemperatureC, 10);
    expect((ctx as Record<string, unknown>).__wb_deviceEffects).toBeUndefined();
  });
});

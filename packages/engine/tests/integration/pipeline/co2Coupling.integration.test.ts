import { describe, expect, it } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants';
import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type { ZoneDeviceInstance, Zone, Uuid } from '@/backend/src/domain/world';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint';
import { deviceQuality } from '../../testUtils/deviceHelpers.ts';

function uuid(value: string): Uuid {
  return value as Uuid;
}

describe('Tick pipeline — CO₂ coupling', () => {
  const QUALITY_POLICY = { sampleQuality01: (rng: () => number) => rng() } as const;
  const WORLD_SEED = 'co2-coupling';
  const CO2_TEST_BLUEPRINT: DeviceBlueprint = {
    id: '70000000-0000-0000-0000-000000000000',
    slug: 'test-co2-injector',
    class: 'device.test.co2',
    name: 'Test CO₂ Injector',
    placementScope: 'zone',
    allowedRoomPurposes: ['growroom'],
    power_W: 80,
    efficiency01: 1,
    coverage_m2: 10,
    airflow_m3_per_h: 0
  } as DeviceBlueprint;

  function co2Device(id: string): ZoneDeviceInstance {
    const deviceId = uuid(id);
    return {
      id: deviceId,
      slug: CO2_TEST_BLUEPRINT.slug,
      name: CO2_TEST_BLUEPRINT.name,
      blueprintId: uuid(CO2_TEST_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, deviceId, CO2_TEST_BLUEPRINT),
      condition01: 1,
      powerDraw_W: CO2_TEST_BLUEPRINT.power_W,
      dutyCycle01: 1,
      efficiency01: CO2_TEST_BLUEPRINT.efficiency01,
      coverage_m2: CO2_TEST_BLUEPRINT.coverage_m2 ?? 0,
      airflow_m3_per_h: CO2_TEST_BLUEPRINT.airflow_m3_per_h ?? 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['co2'],
      effectConfigs: {
        co2: {
          target_ppm: 900,
          safetyMax_ppm: 1_000,
          pulse_ppm_per_tick: 200
        }
      }
    } satisfies ZoneDeviceInstance;
  }

  it('adds the injected ppm to the zone environment', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.environment = { ...zone.environment, co2_ppm: 420 };
    zone.devices = [co2Device('70000000-0000-0000-0000-000000000001')];

    const { world: nextWorld } = runTick(world, { tickDurationHours: 1 });
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    expect(nextZone.environment.co2_ppm).toBeCloseTo(620, 6);
  });

  it('ramps towards the target across multiple ticks without exceeding safety max', () => {
    let world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.environment = { ...zone.environment, co2_ppm: 420 };
    zone.devices = [co2Device('70000000-0000-0000-0000-000000000002')];

    const ctx: EngineRunContext = { tickDurationHours: HOURS_PER_TICK };

    for (let i = 0; i < 3; i += 1) {
      const tickResult = runTick(world, ctx);
      world = tickResult.world;
    }

    const nextZone = world.company.structures[0].rooms[0].zones[0];
    expect(nextZone.environment.co2_ppm).toBeCloseTo(900, 6);
    expect(nextZone.environment.co2_ppm).toBeLessThanOrEqual(1_000);
  });
});

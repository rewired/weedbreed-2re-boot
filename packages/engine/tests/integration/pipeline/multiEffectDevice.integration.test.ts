import { describe, expect, it } from 'vitest';

import {
  CP_AIR_J_PER_KG_K,
  HOURS_PER_TICK,
  SECONDS_PER_HOUR
} from '@/backend/src/constants/simConstants.js';
import type { EngineRunContext } from '@/backend/src/engine/Engine.js';
import { runTick } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import {
  createDeviceInstance,
  type DeviceQualityPolicy,
  type Uuid,
  type ZoneDeviceInstance
} from '@/backend/src/domain/world.js';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'multi-effect-seed';

function deviceQuality(id: Uuid): number {
  return createDeviceInstance(QUALITY_POLICY, WORLD_SEED, id).quality01;
}

describe('Tick pipeline — multi-effect devices', () => {
  it('integrates thermal cooling and humidity removal in a single tick', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    const baseFloorArea = zone.floorArea_m2;
    const baseAirMass = zone.airMass_kg;

    zone.floorArea_m2 = 25;
    zone.airMass_kg = (baseAirMass / baseFloorArea) * zone.floorArea_m2;

    zone.environment = {
      ...zone.environment,
      relativeHumidity_pct: 60
    };

    const initialTemperatureC = zone.environment.airTemperatureC;
    const initialHumidity = zone.environment.relativeHumidity_pct;

    const deviceId = uuid('30000000-0000-0000-0000-000000000001');
    const multiEffectDevice: ZoneDeviceInstance = {
      id: deviceId,
      slug: 'cool-air-dehumidifier',
      name: 'Cool Air Dehumidifier',
      blueprintId: uuid('30000000-0000-0000-0000-000000000002'),
      placementScope: 'zone',
      quality01: deviceQuality(deviceId),
      condition01: 0.95,
      powerDraw_W: 1_200,
      dutyCycle01: 1,
      efficiency01: 0.65,
      coverage_m2: 25,
      airflow_m3_per_h: 350,
      sensibleHeatRemovalCapacity_W: 3_000
    } satisfies ZoneDeviceInstance;

    zone.devices = [multiEffectDevice];

    const ctx: EngineRunContext = {
      tickDurationHours: 1
    } satisfies EngineRunContext;

    const { world: nextWorld } = runTick(world, ctx);
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const cooling_W = multiEffectDevice.powerDraw_W * multiEffectDevice.efficiency01;
    const tickSeconds = (ctx.tickDurationHours ?? HOURS_PER_TICK) * SECONDS_PER_HOUR;
    const expectedDeltaC =
      (-cooling_W * tickSeconds) / (zone.airMass_kg * CP_AIR_J_PER_KG_K);

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(
      initialTemperatureC + expectedDeltaC,
      5
    );
    expect(nextZone.environment.relativeHumidity_pct).toBeLessThan(initialHumidity);
    expect((ctx as Record<string, unknown>).__wb_deviceEffects).toBeUndefined();
  });

  it('accumulates effects from multiple devices', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    zone.environment = {
      ...zone.environment,
      relativeHumidity_pct: 65
    };

    const heaterId = uuid('30000000-0000-0000-0000-000000000003');
    const heater: ZoneDeviceInstance = {
      id: heaterId,
      slug: 'resistive-heater',
      name: 'Resistive Heater',
      blueprintId: uuid('30000000-0000-0000-0000-000000000004'),
      placementScope: 'zone',
      quality01: deviceQuality(heaterId),
      condition01: 0.9,
      powerDraw_W: 900,
      dutyCycle01: 1,
      efficiency01: 0.2,
      coverage_m2: 60,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    const dehumidifierId = uuid('30000000-0000-0000-0000-000000000005');
    const dehumidifier: ZoneDeviceInstance = {
      id: dehumidifierId,
      slug: 'smart-dehumidifier',
      name: 'Smart Dehumidifier',
      blueprintId: uuid('30000000-0000-0000-0000-000000000006'),
      placementScope: 'zone',
      quality01: deviceQuality(dehumidifierId),
      condition01: 0.92,
      powerDraw_W: 450,
      dutyCycle01: 1,
      efficiency01: 0.5,
      coverage_m2: 30,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [heater, dehumidifier];

    const { world: nextWorld } = runTick(world, {});
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const tickSeconds = HOURS_PER_TICK * SECONDS_PER_HOUR;
    const heaterWaste_W = heater.powerDraw_W * (1 - heater.efficiency01);
    const expectedTemp =
      zone.environment.airTemperatureC +
      (heaterWaste_W * tickSeconds) / (zone.airMass_kg * CP_AIR_J_PER_KG_K);

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(expectedTemp, 5);
    expect(nextZone.environment.relativeHumidity_pct).toBeLessThan(
      zone.environment.relativeHumidity_pct
    );
  });

  it('applies coverage effectiveness to thermal effects', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    const originalFloorArea = zone.floorArea_m2;
    const originalAirMass = zone.airMass_kg;

    zone.floorArea_m2 = 20;
    zone.airMass_kg = (originalAirMass / originalFloorArea) * zone.floorArea_m2;

    const heaterId = uuid('30000000-0000-0000-0000-000000000007');
    const partialCoverageHeater: ZoneDeviceInstance = {
      id: heaterId,
      slug: 'partial-heater',
      name: 'Partial Coverage Heater',
      blueprintId: uuid('30000000-0000-0000-0000-000000000008'),
      placementScope: 'zone',
      quality01: deviceQuality(heaterId),
      condition01: 0.88,
      powerDraw_W: 1_000,
      dutyCycle01: 1,
      efficiency01: 0.2,
      coverage_m2: 10,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [partialCoverageHeater];

    const { world: nextWorld } = runTick(world, {});
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const effectiveness01 = 0.5;
    const wasteHeat_W = partialCoverageHeater.powerDraw_W * (1 - partialCoverageHeater.efficiency01);
    const tickSeconds = HOURS_PER_TICK * SECONDS_PER_HOUR;
    const unscaledDeltaC =
      (wasteHeat_W * tickSeconds) / (zone.airMass_kg * CP_AIR_J_PER_KG_K);
    const expectedTemp =
      zone.environment.airTemperatureC + unscaledDeltaC * effectiveness01;

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(expectedTemp, 5);
  });
});

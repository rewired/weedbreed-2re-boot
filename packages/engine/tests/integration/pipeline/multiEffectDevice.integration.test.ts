import { describe, expect, it } from 'vitest';

import {
  CP_AIR_J_PER_KG_K,
  HOURS_PER_TICK,
  LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG,
  SECONDS_PER_HOUR
} from '@/backend/src/constants/simConstants';
import type { EngineRunContext } from '@/backend/src/engine/Engine';
import { runTick } from '@/backend/src/engine/Engine';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import { type DeviceQualityPolicy, type Uuid, type ZoneDeviceInstance } from '@/backend/src/domain/world';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint';
import { getDeviceEffectsRuntime } from '@/backend/src/engine/pipeline/applyDeviceEffects';
import { deviceQuality } from '../../testUtils/deviceHelpers.ts';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'multi-effect-seed';

const COOL_AIR_DEHUMIDIFIER_BLUEPRINT: DeviceBlueprint = {
  id: '30000000-0000-0000-0000-000000000002',
  slug: 'cool-air-dehumidifier',
  class: 'device.test.hvac',
  name: 'Cool Air Dehumidifier',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 1_200,
  efficiency01: 0.65,
  coverage_m2: 25,
  airflow_m3_per_h: 350,
  effects: ['thermal', 'humidity', 'airflow'],
  thermal: { mode: 'cool', max_cool_W: 3_000 },
  humidity: { mode: 'dehumidify', capacity_g_per_h: 500 },
  airflow: { mode: 'circulate', airflow_m3_per_h: 350 }
};

const RESISTIVE_HEATER_BLUEPRINT: DeviceBlueprint = {
  id: '30000000-0000-0000-0000-000000000004',
  slug: 'resistive-heater',
  class: 'device.test.heater',
  name: 'Resistive Heater',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 900,
  efficiency01: 0.2,
  coverage_m2: 60,
  airflow_m3_per_h: 0,
  effects: ['thermal'],
  thermal: { mode: 'heat' }
};

const SMART_DEHUMIDIFIER_BLUEPRINT: DeviceBlueprint = {
  id: '30000000-0000-0000-0000-000000000006',
  slug: 'smart-dehumidifier',
  class: 'device.test.dehumidifier',
  name: 'Smart Dehumidifier',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 450,
  efficiency01: 0.5,
  coverage_m2: 30,
  airflow_m3_per_h: 0,
  effects: ['humidity'],
  humidity: { mode: 'dehumidify', capacity_g_per_h: 500 }
};

const PARTIAL_HEATER_BLUEPRINT: DeviceBlueprint = {
  id: '30000000-0000-0000-0000-000000000008',
  slug: 'partial-heater',
  class: 'device.test.heater',
  name: 'Partial Coverage Heater',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 1_000,
  efficiency01: 0.2,
  coverage_m2: 10,
  airflow_m3_per_h: 0,
  effects: ['thermal'],
  thermal: { mode: 'heat' }
};

const PATTERN_A_SPLIT_AC_BLUEPRINT: DeviceBlueprint = {
  id: '30000000-0000-0000-0000-00000000000a',
  slug: 'pattern-a-unit',
  class: 'device.test.hvac',
  name: 'Pattern A Split AC',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 1_200,
  efficiency01: 0.65,
  coverage_m2: 25,
  airflow_m3_per_h: 350,
  effects: ['thermal', 'humidity', 'airflow'],
  thermal: { mode: 'cool', max_cool_W: 3_000 },
  humidity: { mode: 'dehumidify', capacity_g_per_h: 500 },
  airflow: { mode: 'circulate', airflow_m3_per_h: 350 }
};

const PATTERN_B_REHEAT_BLUEPRINT: DeviceBlueprint = {
  id: '30000000-0000-0000-0000-00000000000c',
  slug: 'pattern-b-unit',
  class: 'device.test.dehumidifier',
  name: 'Pattern B Dehumidifier',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 300,
  efficiency01: 0.6,
  coverage_m2: 6.67,
  airflow_m3_per_h: 0,
  effects: ['humidity', 'thermal'],
  humidity: { mode: 'dehumidify', capacity_g_per_h: 1_800 },
  thermal: { mode: 'heat' }
};

const LEGACY_DEHUMIDIFIER_BLUEPRINT: DeviceBlueprint = {
  id: '30000000-0000-0000-0000-00000000000e',
  slug: 'legacy-dehumidifier',
  class: 'device.test.dehumidifier',
  name: 'Legacy Dehumidifier',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 400,
  efficiency01: 0.5,
  coverage_m2: 30,
  airflow_m3_per_h: 0
};

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
      relativeHumidity01: 0.6
    };

    const initialTemperatureC = zone.environment.airTemperatureC;
    const initialHumidity = zone.environment.relativeHumidity01;

    const deviceId = uuid('30000000-0000-0000-0000-000000000001');
    const multiEffectDevice: ZoneDeviceInstance = {
      id: deviceId,
      slug: COOL_AIR_DEHUMIDIFIER_BLUEPRINT.slug,
      name: COOL_AIR_DEHUMIDIFIER_BLUEPRINT.name,
      blueprintId: uuid(COOL_AIR_DEHUMIDIFIER_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, deviceId, COOL_AIR_DEHUMIDIFIER_BLUEPRINT),
      condition01: 0.95,
      powerDraw_W: 1_200,
      dutyCycle01: 1,
      efficiency01: 0.65,
      coverage_m2: 25,
      airflow_m3_per_h: 350,
      sensibleHeatRemovalCapacity_W: 3_000,
      effects: ['thermal', 'humidity', 'airflow'],
      effectConfigs: {
        thermal: { mode: 'cool', max_cool_W: 3_000 },
        humidity: { mode: 'dehumidify', capacity_g_per_h: 500 },
        airflow: { mode: 'circulate', airflow_m3_per_h: 350 }
      }
    } satisfies ZoneDeviceInstance;

    zone.devices = [multiEffectDevice];

    const ctx: EngineRunContext = {
      tickDurationHours: 1
    } satisfies EngineRunContext;

    const { world: nextWorld } = runTick(world, ctx);
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const cooling_W = multiEffectDevice.powerDraw_W * multiEffectDevice.efficiency01;
    const tickHours = ctx.tickDurationHours ?? HOURS_PER_TICK;
    const tickSeconds = tickHours * SECONDS_PER_HOUR;
    const coverageEffectiveness01 = Math.min(
      1,
      multiEffectDevice.coverage_m2 / Math.max(1, zone.floorArea_m2)
    );
    const sensibleDeltaC =
      ((-cooling_W) * tickSeconds * coverageEffectiveness01) /
      (zone.airMass_kg * CP_AIR_J_PER_KG_K);
    const waterRemoved_g =
      (multiEffectDevice.effectConfigs?.humidity?.capacity_g_per_h ?? 0) *
      multiEffectDevice.dutyCycle01 *
      tickHours;
    const latentDeltaC =
      ((-waterRemoved_g / 1_000) * LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG * coverageEffectiveness01) /
      (zone.airMass_kg * CP_AIR_J_PER_KG_K);
    const expectedDeltaC = sensibleDeltaC + latentDeltaC;

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(
      initialTemperatureC + expectedDeltaC,
      5
    );
    expect(nextZone.environment.relativeHumidity01).toBeLessThan(initialHumidity);
    expect((ctx as Record<string, unknown>).__wb_deviceEffects).toBeUndefined();
  });

  it('accumulates effects from multiple devices', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    zone.environment = {
      ...zone.environment,
      relativeHumidity01: 0.65
    };

    const heaterId = uuid('30000000-0000-0000-0000-000000000003');
    const heater: ZoneDeviceInstance = {
      id: heaterId,
      slug: RESISTIVE_HEATER_BLUEPRINT.slug,
      name: RESISTIVE_HEATER_BLUEPRINT.name,
      blueprintId: uuid(RESISTIVE_HEATER_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, heaterId, RESISTIVE_HEATER_BLUEPRINT),
      condition01: 0.9,
      powerDraw_W: 900,
      dutyCycle01: 1,
      efficiency01: 0.2,
      coverage_m2: 60,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['thermal'],
      effectConfigs: { thermal: { mode: 'heat' } }
    } satisfies ZoneDeviceInstance;

    const dehumidifierId = uuid('30000000-0000-0000-0000-000000000005');
    const dehumidifier: ZoneDeviceInstance = {
      id: dehumidifierId,
      slug: SMART_DEHUMIDIFIER_BLUEPRINT.slug,
      name: SMART_DEHUMIDIFIER_BLUEPRINT.name,
      blueprintId: uuid(SMART_DEHUMIDIFIER_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, dehumidifierId, SMART_DEHUMIDIFIER_BLUEPRINT),
      condition01: 0.92,
      powerDraw_W: 450,
      dutyCycle01: 1,
      efficiency01: 0.5,
      coverage_m2: 30,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['humidity'],
      effectConfigs: {
        humidity: { mode: 'dehumidify', capacity_g_per_h: 500 }
      }
    } satisfies ZoneDeviceInstance;

    zone.devices = [heater, dehumidifier];

    const { world: nextWorld } = runTick(world, {});
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const tickSeconds = HOURS_PER_TICK * SECONDS_PER_HOUR;
    const coverageEffectiveness01 = Math.min(
      1,
      (heater.coverage_m2 + dehumidifier.coverage_m2) /
        Math.max(1, zone.floorArea_m2)
    );
    const heaterWaste_W = heater.powerDraw_W * (1 - heater.efficiency01);
    const dehumidifierWaste_W =
      dehumidifier.powerDraw_W * (1 - dehumidifier.efficiency01);
    const sensibleEnergy_J =
      (heaterWaste_W + dehumidifierWaste_W) * tickSeconds * coverageEffectiveness01;
    const waterRemoved_g =
      (dehumidifier.effectConfigs?.humidity?.capacity_g_per_h ?? 0) *
      dehumidifier.dutyCycle01 *
      HOURS_PER_TICK;
    const latentEnergy_J =
      (waterRemoved_g / 1_000) *
      LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG *
      coverageEffectiveness01;
    const totalDeltaC =
      (sensibleEnergy_J + latentEnergy_J) /
      (zone.airMass_kg * CP_AIR_J_PER_KG_K);
    const expectedTemp = zone.environment.airTemperatureC + totalDeltaC;

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(expectedTemp, 5);
    expect(nextZone.environment.relativeHumidity01).toBeLessThan(
      zone.environment.relativeHumidity01
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
      slug: PARTIAL_HEATER_BLUEPRINT.slug,
      name: PARTIAL_HEATER_BLUEPRINT.name,
      blueprintId: uuid(PARTIAL_HEATER_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, heaterId, PARTIAL_HEATER_BLUEPRINT),
      condition01: 0.88,
      powerDraw_W: 1_000,
      dutyCycle01: 1,
      efficiency01: 0.2,
      coverage_m2: 10,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['thermal'],
      effectConfigs: { thermal: { mode: 'heat' } }
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

  it('Pattern A: Split-AC with explicit blueprint configs', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];

    zone.environment = {
      ...zone.environment,
      relativeHumidity01: 0.62
    };

    const initialTemperatureC = zone.environment.airTemperatureC;
    const initialHumidity = zone.environment.relativeHumidity01;

    const deviceId = uuid('30000000-0000-0000-0000-000000000009');
    const splitAC: ZoneDeviceInstance = {
      id: deviceId,
      slug: PATTERN_A_SPLIT_AC_BLUEPRINT.slug,
      name: PATTERN_A_SPLIT_AC_BLUEPRINT.name,
      blueprintId: uuid(PATTERN_A_SPLIT_AC_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, deviceId, PATTERN_A_SPLIT_AC_BLUEPRINT),
      condition01: 0.96,
      powerDraw_W: 1_200,
      dutyCycle01: 1,
      efficiency01: 0.65,
      coverage_m2: 25,
      airflow_m3_per_h: 350,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['thermal', 'humidity', 'airflow'],
      effectConfigs: {
        thermal: { mode: 'cool', max_cool_W: 3_000 },
        humidity: { mode: 'dehumidify', capacity_g_per_h: 500 },
        airflow: { mode: 'circulate', airflow_m3_per_h: 350 }
      }
    } satisfies ZoneDeviceInstance;

    zone.devices = [splitAC];

    const ctx: EngineRunContext = {
      tickDurationHours: 1,
      instrumentation: {
        onStageComplete: (stage) => {
          if (stage === 'applyDeviceEffects') {
            const runtime = getDeviceEffectsRuntime(ctx);
            const zoneId = zone.id;
            const log = {
              thermalDeltaC: runtime?.zoneTemperatureDeltaC.get(zoneId) ?? 0,
              humidityDelta01: runtime?.zoneHumidityDelta01.get(zoneId) ?? 0,
              airflow_m3_per_h: runtime?.zoneAirflowTotals_m3_per_h.get(zoneId) ?? 0,
              coverageEffectiveness01:
                runtime?.zoneCoverageEffectiveness01.get(zoneId) ?? 0
            };
            console.info('[Pattern A] device contributions', JSON.stringify(log));
          }
        }
      }
    } satisfies EngineRunContext;
    const { world: nextWorld } = runTick(world, ctx);
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const coverageEffectiveness01 = Math.min(
      1,
      splitAC.coverage_m2 / Math.max(1, zone.floorArea_m2)
    );
    const cooling_W = Math.min(
      splitAC.powerDraw_W * splitAC.dutyCycle01 * splitAC.efficiency01,
      splitAC.effectConfigs?.thermal?.max_cool_W ?? Number.POSITIVE_INFINITY
    );
    const tickHours = ctx.tickDurationHours ?? HOURS_PER_TICK;
    const tickSeconds = tickHours * SECONDS_PER_HOUR;
    const sensibleDeltaC =
      ((-cooling_W) * tickSeconds * coverageEffectiveness01) /
      (zone.airMass_kg * CP_AIR_J_PER_KG_K);
    const waterRemoved_g =
      (splitAC.effectConfigs?.humidity?.capacity_g_per_h ?? 0) *
      splitAC.dutyCycle01 *
      tickHours;
    const latentDeltaC =
      ((-waterRemoved_g / 1_000) * LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG * coverageEffectiveness01) /
      (zone.airMass_kg * CP_AIR_J_PER_KG_K);
    const expectedDeltaC = sensibleDeltaC + latentDeltaC;

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(
      initialTemperatureC + expectedDeltaC,
      5
    );
    expect(nextZone.environment.relativeHumidity01).toBeLessThan(initialHumidity);
  });

  it('Pattern B: Dehumidifier with reheat', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];

    zone.environment = {
      ...zone.environment,
      relativeHumidity01: 0.68
    };

    const deviceId = uuid('30000000-0000-0000-0000-00000000000b');
    const reheatDehumidifier: ZoneDeviceInstance = {
      id: deviceId,
      slug: PATTERN_B_REHEAT_BLUEPRINT.slug,
      name: PATTERN_B_REHEAT_BLUEPRINT.name,
      blueprintId: uuid(PATTERN_B_REHEAT_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, deviceId, PATTERN_B_REHEAT_BLUEPRINT),
      condition01: 0.9,
      powerDraw_W: 300,
      dutyCycle01: 1,
      efficiency01: 0.6,
      coverage_m2: 6.67,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['humidity', 'thermal'],
      effectConfigs: {
        humidity: { mode: 'dehumidify', capacity_g_per_h: 1_800 },
        thermal: { mode: 'heat' }
      }
    } satisfies ZoneDeviceInstance;

    zone.devices = [reheatDehumidifier];

    const ctx: EngineRunContext = {
      instrumentation: {
        onStageComplete: (stage) => {
          if (stage === 'applyDeviceEffects') {
            const runtime = getDeviceEffectsRuntime(ctx);
            const zoneId = zone.id;
            const log = {
              thermalDeltaC: runtime?.zoneTemperatureDeltaC.get(zoneId) ?? 0,
              humidityDelta01: runtime?.zoneHumidityDelta01.get(zoneId) ?? 0,
              airflow_m3_per_h: runtime?.zoneAirflowTotals_m3_per_h.get(zoneId) ?? 0,
              coverageEffectiveness01:
                runtime?.zoneCoverageEffectiveness01.get(zoneId) ?? 0
            };
            console.info('[Pattern B] device contributions', JSON.stringify(log));
          }
        }
      }
    } satisfies EngineRunContext;

    const { world: nextWorld } = runTick(world, ctx);
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const coverageEffectiveness01 = Math.min(
      1,
      reheatDehumidifier.coverage_m2 / Math.max(1, zone.floorArea_m2)
    );
    const wasteHeat_W =
      reheatDehumidifier.powerDraw_W * (1 - reheatDehumidifier.efficiency01);
    const sensibleEnergy_J =
      wasteHeat_W * HOURS_PER_TICK * SECONDS_PER_HOUR * coverageEffectiveness01;
    const waterRemoved_g =
      (reheatDehumidifier.effectConfigs?.humidity?.capacity_g_per_h ?? 0) *
      reheatDehumidifier.dutyCycle01 *
      HOURS_PER_TICK;
    const latentEnergy_J =
      (waterRemoved_g / 1_000) *
      LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG *
      coverageEffectiveness01;
    const expectedTempIncrease =
      (sensibleEnergy_J + latentEnergy_J) /
      (zone.airMass_kg * CP_AIR_J_PER_KG_K);

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(
      zone.environment.airTemperatureC + expectedTempIncrease,
      5
    );
    expect(nextZone.environment.relativeHumidity01).toBeLessThan(
      zone.environment.relativeHumidity01
    );
  });

  it('retains heuristic behaviour for legacy devices without effects metadata', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];

    zone.environment = {
      ...zone.environment,
      relativeHumidity01: 0.7
    };

    const legacyId = uuid('30000000-0000-0000-0000-00000000000d');
    const legacyDevice: ZoneDeviceInstance = {
      id: legacyId,
      slug: LEGACY_DEHUMIDIFIER_BLUEPRINT.slug,
      name: LEGACY_DEHUMIDIFIER_BLUEPRINT.name,
      blueprintId: uuid(LEGACY_DEHUMIDIFIER_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, legacyId, LEGACY_DEHUMIDIFIER_BLUEPRINT),
      condition01: 0.85,
      powerDraw_W: 400,
      dutyCycle01: 1,
      efficiency01: 0.5,
      coverage_m2: 30,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [legacyDevice];

    const { world: nextWorld } = runTick(world, {});
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    expect(nextZone.environment.relativeHumidity01).toBeLessThan(
      zone.environment.relativeHumidity01
    );
  });
});

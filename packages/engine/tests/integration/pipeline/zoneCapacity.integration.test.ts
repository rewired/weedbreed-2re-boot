import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  HOURS_PER_TICK,
  ROOM_DEFAULT_HEIGHT_M
} from '@/backend/src/constants/simConstants';
import type { EngineDiagnostic, EngineRunContext } from '@/backend/src/engine/Engine';
import {
  applyDeviceEffects,
  getDeviceEffectsRuntime
} from '@/backend/src/engine/pipeline/applyDeviceEffects';
import { updateEnvironment } from '@/backend/src/engine/pipeline/updateEnvironment';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import { applyDeviceHeat } from '@/backend/src/engine/thermo/heat';
import {
  type DeviceQualityPolicy,
  type ZoneDeviceInstance,
  type Uuid
} from '@/backend/src/domain/world';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint';
import { deviceQuality } from '../../testUtils/deviceHelpers.ts';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'zone-capacity-seed';

const COVERAGE_HEATER_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000002',
  slug: 'coverage-test-heater',
  class: 'device.test.heater',
  name: 'Coverage Test Heater',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 1_000,
  efficiency01: 0.5,
  coverage_m2: 10,
  airflow_m3_per_h: 0,
  effects: ['thermal'],
  thermal: { mode: 'heat' }
};

const AIRFLOW_FAN_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000011',
  slug: 'airflow-test-fan',
  class: 'device.test.fan',
  name: 'Airflow Test Fan',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 200,
  efficiency01: 0.8,
  coverage_m2: 10,
  airflow_m3_per_h: 15,
  effects: ['airflow'],
  airflow: { mode: 'circulate' }
};

describe('Phase 1 zone capacity diagnostics', () => {
  it('clamps device effectiveness and emits coverage warnings when undersized', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.floorArea_m2 = 20;
    zone.height_m = ROOM_DEFAULT_HEIGHT_M;
    zone.airMass_kg = zone.floorArea_m2 * zone.height_m * AIR_DENSITY_KG_PER_M3;

    const heaterId = uuid('40000000-0000-0000-0000-000000000001');
    const heater: ZoneDeviceInstance = {
      id: heaterId,
      slug: COVERAGE_HEATER_BLUEPRINT.slug,
      name: COVERAGE_HEATER_BLUEPRINT.name,
      blueprintId: uuid(COVERAGE_HEATER_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, heaterId, COVERAGE_HEATER_BLUEPRINT),
      condition01: 1,
      powerDraw_W: 1_000,
      dutyCycle01: 1,
      efficiency01: 0.5,
      coverage_m2: 10,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [heater];

    const diagnostics: EngineDiagnostic[] = [];
    const ctx: EngineRunContext = {
      diagnostics: {
        emit: (diagnostic) => {
          diagnostics.push(diagnostic);
        }
      }
    } satisfies EngineRunContext;

    applyDeviceEffects(world, ctx);

    const runtime = getDeviceEffectsRuntime(ctx);
    expect(runtime).toBeDefined();

    const rawDeltaC = applyDeviceHeat(zone, heater, HOURS_PER_TICK);
    const recordedDeltaC = runtime!.zoneTemperatureDeltaC.get(zone.id) ?? 0;

    expect(recordedDeltaC).toBeCloseTo(rawDeltaC * 0.5, 6);
    expect(runtime!.zoneCoverageTotals_m2.get(zone.id)).toBeCloseTo(10);
    expect(runtime!.zoneCoverageEffectiveness01.get(zone.id)).toBeCloseTo(0.5);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'zone.capacity.coverage.warn', zoneId: zone.id })
      ])
    );

    const nextWorld = updateEnvironment(world, ctx);
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(
      zone.environment.airTemperatureC + recordedDeltaC,
      6
    );
  });

  it('aggregates airflow and emits ACH warnings when insufficient', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.floorArea_m2 = 10;
    zone.height_m = ROOM_DEFAULT_HEIGHT_M;
    zone.airMass_kg = zone.floorArea_m2 * zone.height_m * AIR_DENSITY_KG_PER_M3;

    const fanId = uuid('40000000-0000-0000-0000-000000000010');
    const fan: ZoneDeviceInstance = {
      id: fanId,
      slug: AIRFLOW_FAN_BLUEPRINT.slug,
      name: AIRFLOW_FAN_BLUEPRINT.name,
      blueprintId: uuid(AIRFLOW_FAN_BLUEPRINT.id),
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, fanId, AIRFLOW_FAN_BLUEPRINT),
      condition01: 1,
      powerDraw_W: 200,
      dutyCycle01: 1,
      efficiency01: 0.8,
      coverage_m2: zone.floorArea_m2,
      airflow_m3_per_h: 15,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [fan];

    const diagnostics: EngineDiagnostic[] = [];
    const ctx: EngineRunContext = {
      diagnostics: {
        emit: (diagnostic) => {
          diagnostics.push(diagnostic);
        }
      }
    } satisfies EngineRunContext;

    applyDeviceEffects(world, ctx);

    const runtime = getDeviceEffectsRuntime(ctx);
    expect(runtime).toBeDefined();

    const expectedAch = 15 / (zone.floorArea_m2 * zone.height_m);

    expect(runtime!.zoneAirflowTotals_m3_per_h.get(zone.id)).toBeCloseTo(15);
    expect(runtime!.zoneAirChangesPerHour.get(zone.id)).toBeCloseTo(expectedAch, 6);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'zone.capacity.airflow.warn', zoneId: zone.id })
      ])
    );

    updateEnvironment(world, ctx);
  });
});

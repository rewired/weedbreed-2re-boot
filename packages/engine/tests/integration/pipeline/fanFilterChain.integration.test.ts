import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  HOURS_PER_TICK,
  ROOM_DEFAULT_HEIGHT_M
} from '@/backend/src/constants/simConstants';
import type { EngineDiagnostic, EngineRunContext } from '@/backend/src/engine/Engine';
import { runTick } from '@/backend/src/engine/Engine';
import { getDeviceEffectsRuntime } from '@/backend/src/engine/pipeline/applyDeviceEffects';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type { ZoneDeviceInstance, Uuid } from '@/backend/src/domain/world';

import { expectDefined } from '../../util/expectors';

function uuid(value: string): Uuid {
  return value as Uuid;
}

function createFanDevice(id: string, airflow_m3_per_h: number, dutyCycle01 = 1): ZoneDeviceInstance {
  return {
    id: uuid(id),
    slug: `fan-${id}`,
    name: `Test Fan ${id}`,
    blueprintId: uuid(`${id}-blueprint`),
    placementScope: 'zone',
    quality01: 0.95,
    condition01: 1,
    powerDraw_W: 150,
    dutyCycle01,
    efficiency01: 0.8,
    coverage_m2: 20,
    airflow_m3_per_h,
    sensibleHeatRemovalCapacity_W: 0,
    effects: ['airflow'],
    effectConfigs: {
      airflow: {
        mode: 'exhaust',
        airflow_m3_per_h
      }
    }
  } satisfies ZoneDeviceInstance;
}

function createFilterDevice(
  id: string,
  filterType: 'carbon' | 'hepa' | 'pre-filter',
  efficiency01: number,
  condition01: number,
  basePressureDrop_pa: number
): ZoneDeviceInstance {
  return {
    id: uuid(id),
    slug: `filter-${id}`,
    name: `Test Filter ${id}`,
    blueprintId: uuid(`${id}-blueprint`),
    placementScope: 'zone',
    quality01: 0.9,
    condition01,
    powerDraw_W: 0,
    dutyCycle01: 1,
    efficiency01,
    coverage_m2: 0,
    airflow_m3_per_h: 0,
    sensibleHeatRemovalCapacity_W: 0,
    effects: ['filtration'],
    effectConfigs: {
      filtration: {
        filterType,
        efficiency01,
        basePressureDrop_pa
      }
    }
  } satisfies ZoneDeviceInstance;
}

describe('Tick pipeline — fan and filter chains', () => {
  it('reduces airflow after filter pressure drops', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.floorArea_m2 = 25;
    zone.height_m = 2;
    zone.airMass_kg = zone.floorArea_m2 * zone.height_m * AIR_DENSITY_KG_PER_M3;

    const fan = createFanDevice('50000000-0000-0000-0000-000000000001', 200);
    const filter = createFilterDevice(
      '50000000-0000-0000-0000-000000000002',
      'carbon',
      0.9,
      1,
      100
    );

    zone.devices = [fan, filter];

    let runtime = undefined as ReturnType<typeof getDeviceEffectsRuntime>;
    const ctx: EngineRunContext = {
      tickDurationHours: HOURS_PER_TICK,
      instrumentation: {
        onStageComplete: (stage) => {
          if (stage === 'applyDeviceEffects') {
            runtime = getDeviceEffectsRuntime(ctx);
          }
        }
      }
    } satisfies EngineRunContext;

    runTick(world, ctx);

    const runtimeSnapshot = expectDefined(runtime);

    const netAirflow = runtimeSnapshot.zoneAirflowTotals_m3_per_h.get(zone.id) ?? 0;
    const netAch = runtimeSnapshot.zoneAirChangesPerHour.get(zone.id) ?? 0;
    const reduction = runtimeSnapshot.zoneAirflowReductions_m3_per_h.get(zone.id) ?? 0;

    expect(netAirflow).toBeGreaterThan(0);
    expect(netAirflow).toBeLessThan(200);
    expect(netAch).toBeLessThan(4);
    expect(reduction).toBeGreaterThan(0);
  });

  it('emits ACH warnings after severe filter reductions', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.floorArea_m2 = 20;
    zone.height_m = ROOM_DEFAULT_HEIGHT_M;
    zone.airMass_kg = zone.floorArea_m2 * zone.height_m * AIR_DENSITY_KG_PER_M3;

    const fan = createFanDevice('50000000-0000-0000-0000-000000000003', 80);
    const filter = createFilterDevice(
      '50000000-0000-0000-0000-000000000004',
      'carbon',
      0.85,
      0.3,
      180
    );

    zone.devices = [fan, filter];

    const diagnostics: EngineDiagnostic[] = [];
    let runtime = undefined as ReturnType<typeof getDeviceEffectsRuntime>;

    const ctx: EngineRunContext = {
      tickDurationHours: HOURS_PER_TICK,
      diagnostics: {
        emit: (diagnostic) => diagnostics.push(diagnostic)
      },
      instrumentation: {
        onStageComplete: (stage) => {
          if (stage === 'applyDeviceEffects') {
            runtime = getDeviceEffectsRuntime(ctx);
          }
        }
      }
    } satisfies EngineRunContext;

    runTick(world, ctx);

    const runtimeSnapshot = expectDefined(runtime);

    const netAch = runtimeSnapshot.zoneAirChangesPerHour.get(zone.id) ?? 0;
    expect(netAch).toBeLessThan(1);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'zone.capacity.airflow.warn', zoneId: zone.id })
      ])
    );
  });

  it('accumulates airflow reductions across multiple fans and filters', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.floorArea_m2 = 30;
    zone.height_m = ROOM_DEFAULT_HEIGHT_M;
    zone.airMass_kg = zone.floorArea_m2 * zone.height_m * AIR_DENSITY_KG_PER_M3;

    const fanA = createFanDevice('50000000-0000-0000-0000-000000000005', 150);
    const fanB = createFanDevice('50000000-0000-0000-0000-000000000006', 150);
    const filterA = createFilterDevice(
      '50000000-0000-0000-0000-000000000007',
      'carbon',
      0.8,
      0.8,
      90
    );
    const filterB = createFilterDevice(
      '50000000-0000-0000-0000-000000000008',
      'hepa',
      0.95,
      0.7,
      140
    );

    zone.devices = [fanA, fanB, filterA, filterB];

    let runtime = undefined as ReturnType<typeof getDeviceEffectsRuntime>;
    const ctx: EngineRunContext = {
      tickDurationHours: HOURS_PER_TICK,
      instrumentation: {
        onStageComplete: (stage) => {
          if (stage === 'applyDeviceEffects') {
            runtime = getDeviceEffectsRuntime(ctx);
          }
        }
      }
    } satisfies EngineRunContext;

    runTick(world, ctx);

    const runtimeSnapshot = expectDefined(runtime);

    const netAirflow = runtimeSnapshot.zoneAirflowTotals_m3_per_h.get(zone.id) ?? 0;
    const reduction = runtimeSnapshot.zoneAirflowReductions_m3_per_h.get(zone.id) ?? 0;
    const grossAirflow = 300;

    expect(netAirflow).toBeGreaterThan(0);
    expect(netAirflow).toBeLessThan(grossAirflow);
    expect(reduction).toBeGreaterThan(0);
    expect(reduction).toBeCloseTo(grossAirflow - netAirflow, 5);
  });

  it('accumulates odor and particulate telemetry from filters', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.floorArea_m2 = 15;
    zone.height_m = ROOM_DEFAULT_HEIGHT_M;
    zone.airMass_kg = zone.floorArea_m2 * zone.height_m * AIR_DENSITY_KG_PER_M3;

    const fan = createFanDevice('50000000-0000-0000-0000-000000000009', 180);
    const filter = createFilterDevice(
      '50000000-0000-0000-0000-000000000010',
      'hepa',
      0.92,
      0.85,
      130
    );

    zone.devices = [fan, filter];

    let runtime = undefined as ReturnType<typeof getDeviceEffectsRuntime>;
    const ctx: EngineRunContext = {
      tickDurationHours: HOURS_PER_TICK,
      instrumentation: {
        onStageComplete: (stage) => {
          if (stage === 'applyDeviceEffects') {
            runtime = getDeviceEffectsRuntime(ctx);
          }
        }
      }
    } satisfies EngineRunContext;

    runTick(world, ctx);

    const runtimeSnapshot = expectDefined(runtime);

    const odorDelta = runtimeSnapshot.zoneOdorDelta.get(zone.id) ?? 0;
    const particulate = runtimeSnapshot.zoneParticulateRemoval01.get(zone.id) ?? 0;

    expect(odorDelta).toBeLessThan(0);
    expect(particulate).toBeGreaterThan(0);
  });

  it('continues to support legacy airflow devices without effects metadata', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.floorArea_m2 = 12;
    zone.height_m = ROOM_DEFAULT_HEIGHT_M;
    zone.airMass_kg = zone.floorArea_m2 * zone.height_m * AIR_DENSITY_KG_PER_M3;

    const legacyFan: ZoneDeviceInstance = {
      id: uuid('50000000-0000-0000-0000-000000000011'),
      slug: 'legacy-fan',
      name: 'Legacy Fan',
      blueprintId: uuid('50000000-0000-0000-0000-000000000012'),
      placementScope: 'zone',
      quality01: 0.9,
      condition01: 1,
      powerDraw_W: 100,
      dutyCycle01: 1,
      efficiency01: 0.75,
      coverage_m2: 30,
      airflow_m3_per_h: 200,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    zone.devices = [legacyFan];

    let runtime = undefined as ReturnType<typeof getDeviceEffectsRuntime>;
    const ctx: EngineRunContext = {
      tickDurationHours: HOURS_PER_TICK,
      instrumentation: {
        onStageComplete: (stage) => {
          if (stage === 'applyDeviceEffects') {
            runtime = getDeviceEffectsRuntime(ctx);
          }
        }
      }
    } satisfies EngineRunContext;

    runTick(world, ctx);

    const runtimeSnapshot = expectDefined(runtime);

    const netAirflow = runtimeSnapshot.zoneAirflowTotals_m3_per_h.get(zone.id) ?? 0;
    expect(netAirflow).toBeCloseTo(legacyFan.airflow_m3_per_h, 5);
  });
});

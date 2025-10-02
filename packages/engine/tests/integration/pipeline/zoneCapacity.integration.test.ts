import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  HOURS_PER_TICK,
  ROOM_DEFAULT_HEIGHT_M
} from '@/backend/src/constants/simConstants.js';
import type { EngineDiagnostic, EngineRunContext } from '@/backend/src/engine/Engine.js';
import {
  applyDeviceEffects,
  getDeviceEffectsRuntime
} from '@/backend/src/engine/pipeline/applyDeviceEffects.js';
import { updateEnvironment } from '@/backend/src/engine/pipeline/updateEnvironment.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import { applyDeviceHeat } from '@/backend/src/engine/thermo/heat.js';
import type { ZoneDeviceInstance } from '@/backend/src/domain/world.js';

describe('Phase 1 zone capacity diagnostics', () => {
  it('clamps device effectiveness and emits coverage warnings when undersized', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];
    zone.floorArea_m2 = 20;
    zone.height_m = ROOM_DEFAULT_HEIGHT_M;
    zone.airMass_kg = zone.floorArea_m2 * zone.height_m * AIR_DENSITY_KG_PER_M3;

    const heater: ZoneDeviceInstance = {
      id: '40000000-0000-0000-0000-000000000001',
      slug: 'coverage-test-heater',
      name: 'Coverage Test Heater',
      blueprintId: '40000000-0000-0000-0000-000000000002',
      placementScope: 'zone',
      quality01: 1,
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

    const fan: ZoneDeviceInstance = {
      id: '40000000-0000-0000-0000-000000000010',
      slug: 'airflow-test-fan',
      name: 'Airflow Test Fan',
      blueprintId: '40000000-0000-0000-0000-000000000011',
      placementScope: 'zone',
      quality01: 1,
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

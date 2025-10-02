import { describe, expect, it } from 'vitest';

import { CP_AIR_J_PER_KG_K, HOURS_PER_TICK } from '@/backend/src/constants/simConstants.js';
import type { EngineRunContext } from '@/backend/src/engine/Engine.js';
import { runTick } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import type { Uuid, ZoneDeviceInstance } from '@/backend/src/domain/world.js';

const SECONDS_PER_HOUR = 3_600;

function uuid(value: string): Uuid {
  return value as Uuid;
}

describe('Tick pipeline — device thermal effects', () => {
  it('integrates heat additions and HVAC removals across the first two stages', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];
    const initialTemperatureC = zone.environment.airTemperatureC;

    const lightingDevice: ZoneDeviceInstance = {
      id: uuid('20000000-0000-0000-0000-000000000001'),
      slug: 'veg-light',
      name: 'Veg Light',
      blueprintId: uuid('20000000-0000-0000-0000-000000000002'),
      placementScope: 'zone',
      quality01: 0.95,
      condition01: 0.94,
      powerDraw_W: 600,
      dutyCycle01: 1,
      efficiency01: 0.2,
      sensibleHeatRemovalCapacity_W: 0
    } satisfies ZoneDeviceInstance;

    const hvacDevice: ZoneDeviceInstance = {
      id: uuid('20000000-0000-0000-0000-000000000003'),
      slug: 'zone-hvac',
      name: 'Zone HVAC',
      blueprintId: uuid('20000000-0000-0000-0000-000000000004'),
      placementScope: 'zone',
      quality01: 0.9,
      condition01: 0.9,
      powerDraw_W: 800,
      dutyCycle01: 1,
      efficiency01: 0.6,
      sensibleHeatRemovalCapacity_W: 500
    } satisfies ZoneDeviceInstance;

    zone.devices = [lightingDevice, hvacDevice];

    const ctx: EngineRunContext = {
      tickDurationHours: 0.5
    } satisfies EngineRunContext;

    const { world: nextWorld } = runTick(world, ctx);

    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];
    const tickHours = (ctx as { tickDurationHours: number }).tickDurationHours ?? HOURS_PER_TICK;
    const tickSeconds = tickHours * SECONDS_PER_HOUR;
    const airMassKg = zone.airMass_kg;

    const wasteLight_W = lightingDevice.powerDraw_W * (1 - lightingDevice.efficiency01);
    const wasteHvac_W = hvacDevice.powerDraw_W * (1 - hvacDevice.efficiency01);
    const additionDeltaC =
      ((wasteLight_W + wasteHvac_W) * tickSeconds) / (airMassKg * CP_AIR_J_PER_KG_K);

    const removalDeltaC =
      (hvacDevice.sensibleHeatRemovalCapacity_W * tickSeconds) /
      (airMassKg * CP_AIR_J_PER_KG_K);

    const expectedTemperatureC = initialTemperatureC + additionDeltaC - removalDeltaC;

    expect(nextZone.environment.airTemperatureC).toBeCloseTo(expectedTemperatureC, 10);
    expect((ctx as Record<string, unknown>).__wb_deviceEffects).toBeUndefined();
  });
});

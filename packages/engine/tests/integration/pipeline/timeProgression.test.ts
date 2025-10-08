import { describe, expect, it } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants.js';
import { runTick } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import type { IrrigationEvent } from '@/backend/src/domain/interfaces/IIrrigationService.js';

describe('Tick pipeline — simulation time progression', () => {
  it('only advances simulation time when the pipeline mutates the world', () => {
    const world = createDemoWorld();

    const initialKpiCount = world.workforce.kpis.length;

    const idleResult = runTick(world, { irrigationEvents: [] });
    expect(idleResult.world).not.toBe(world);
    expect(idleResult.world.simTimeHours).toBe(world.simTimeHours + HOURS_PER_TICK);
    expect(idleResult.world.workforce.kpis).toHaveLength(initialKpiCount + 1);

    const structure = idleResult.world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    const irrigationEvent: IrrigationEvent = {
      water_L: 1,
      concentrations_mg_per_L: { N: 10 },
      targetZoneId: zone.id
    };

    const mutatedResult = runTick(idleResult.world, { irrigationEvents: [irrigationEvent] });
    expect(mutatedResult.world).not.toBe(idleResult.world);
    expect(mutatedResult.world.simTimeHours).toBe(idleResult.world.simTimeHours + HOURS_PER_TICK);
  });
});

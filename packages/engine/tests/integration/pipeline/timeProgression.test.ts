import { describe, expect, it } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants.js';
import { runTick } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import type { IrrigationEvent } from '@/backend/src/domain/interfaces/IIrrigationService.js';

describe('Tick pipeline — simulation time progression', () => {
  it('only advances simulation time when the pipeline mutates the world', () => {
    let world = createDemoWorld();

    const idleResult = runTick(world, { irrigationEvents: [] });
    expect(idleResult.world).toBe(world);
    expect(idleResult.world.simTimeHours).toBe(world.simTimeHours);

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

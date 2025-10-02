import { describe, expect, it } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants.js';
import { runTick } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';

describe('Tick pipeline — simulation time progression', () => {
  it('advances simulation time by one tick per run', () => {
    const world = createDemoWorld();
    const ctx = {};

    runTick(world, ctx);
    expect(world.simTimeHours).toBe(HOURS_PER_TICK);

    runTick(world, ctx);
    expect(world.simTimeHours).toBe(2 * HOURS_PER_TICK);
  });
});

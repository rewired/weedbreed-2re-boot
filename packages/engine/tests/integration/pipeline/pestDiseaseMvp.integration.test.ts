import { describe, it, expect } from 'vitest';
import { Engine, type EngineRunContext } from '../../../../src/backend/src/engine/Engine.js';
import { createDemoWorld } from '../../../../src/backend/src/engine/testHarness.js';
import type { SimulationWorld, WorkforceTaskInstance, WorkforceTaskDefinition } from '../../../../src/backend/src/domain/world.js';

const INSPECT_ZONE_TASK: WorkforceTaskDefinition = {
  taskCode: 'inspect-zone',
  description: 'Inspect a zone for pests and diseases.',
  requiredRoleSlug: 'cultivator',
  priority: 10,
  costModel: {
    basis: 'perAction',
    laborMinutes: 30,
  },
  requiredSkills: [],
};

describe('Pest & Disease MVP', () => {
  it('should accumulate risk and trigger inspection tasks', () => {
    // 1. Create a world
    let world = createDemoWorld();
    world.workforce.taskDefinitions.push(INSPECT_ZONE_TASK);
    
    const engine = new Engine(world);

    // 2. Run the simulation for a few days
    const runContext: EngineRunContext = {
      tickRate: 1,
      ticks: 24 * 5, // 5 days
      telemetry: {
        emit: () => {},
      },
    };
    world = engine.run(runContext);

    // 3. Assertions
    const zone = world.company.structures[0].rooms[0].zones[0];
    const pestDiseaseState = zone.pestDisease;

    // Risk should have accumulated
    expect(pestDiseaseState.risk01).toBeGreaterThan(0);

    // An inspection task should be in the queue
    const taskQueue = world.workforce.taskQueue;
    const inspectionTask = taskQueue.find(task => task.taskCode === 'inspect-zone');
    expect(inspectionTask).toBeDefined();
    expect(inspectionTask?.context?.zoneId).toBe(zone.id);
  });
});

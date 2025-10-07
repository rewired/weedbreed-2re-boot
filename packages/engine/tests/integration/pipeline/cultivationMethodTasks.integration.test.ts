import { describe, expect, it } from 'vitest';

import basicSoilPot from '../../../../../data/blueprints/cultivation-method/basic-soil-pot.json' assert { type: 'json' };
import pot10L from '../../../../../data/blueprints/container/pot-10l.json' assert { type: 'json' };
import soilMultiCycle from '../../../../../data/blueprints/substrate/soil-multi-cycle.json' assert { type: 'json' };

import { PIPELINE_ORDER, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness.js';
import type {
  Plant,
  SimulationWorld,
  Structure,
  Room,
  Zone,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  Uuid,
} from '@/backend/src/domain/world.js';

function createTaskDefinition(taskCode: string, priority = 60): WorkforceTaskDefinition {
  return {
    taskCode,
    description: taskCode,
    requiredRoleSlug: 'cultivator',
    requiredSkills: [],
    priority,
    costModel: { basis: 'perPlant', laborMinutes: 10 },
  } satisfies WorkforceTaskDefinition;
}

function updateZone(
  world: SimulationWorld,
  updater: (structure: Structure, room: Room, zone: Zone) => Zone,
): SimulationWorld {
  const structure = world.company.structures[0];
  const room = structure.rooms[0];
  const zone = room.zones[0];
  const nextZone = updater(structure, room, zone);
  const nextRoom = { ...room, zones: [nextZone] } satisfies typeof room;
  const nextStructure = { ...structure, rooms: [nextRoom] } satisfies typeof structure;
  const nextCompany = { ...world.company, structures: [nextStructure] } satisfies typeof world.company;

  return {
    ...world,
    company: nextCompany,
  } satisfies SimulationWorld;
}

describe('cultivation method task scheduling integration', () => {
  it('queues deterministic maintenance tasks over successive harvest cycles', () => {
    let world = createDemoWorld();
    world = {
      ...world,
      simTimeHours: 24,
    } satisfies SimulationWorld;

    const workforceState: WorkforceState = {
      roles: [],
      employees: [],
      taskDefinitions: [
        createTaskDefinition('cultivation.repot', 80),
        createTaskDefinition(soilMultiCycle.reusePolicy.sterilizationTaskCode ?? 'cultivation.substrate.sterilize', 70),
        createTaskDefinition('cultivation.substrate.dispose', 90),
      ],
      taskQueue: [],
      kpis: [],
      warnings: [],
      payroll: {
        dayIndex: 0,
        totals: { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 },
        byStructure: [],
      },
      market: { structures: [] },
    } satisfies WorkforceState;

    const basePlant: Omit<Plant, 'id'> = {
      name: 'Integration Plant',
      slug: 'integration-plant',
      strainId: '00000000-0000-4000-8000-000000000111' as Uuid,
      lifecycleStage: 'harvest-ready',
      ageHours: 640,
      health01: 0.92,
      biomass_g: 420,
      containerId: pot10L.id as Uuid,
      substrateId: soilMultiCycle.id as Uuid,
      readyForHarvest: false,
      status: 'harvested',
      harvestedAt_tick: 23,
    } satisfies Omit<Plant, 'id'>;

    world = updateZone(world, (_structure, _room, incomingZone) => ({
      ...incomingZone,
      cultivationMethodId: basicSoilPot.id as Uuid,
      containerId: pot10L.id as Uuid,
      substrateId: soilMultiCycle.id as Uuid,
      plants: [
        { ...basePlant, id: '00000000-0000-4000-8000-000000000201' as Uuid },
        { ...basePlant, id: '00000000-0000-4000-8000-000000000202' as Uuid },
      ],
    } satisfies Zone));

    world = {
      ...world,
      workforce: workforceState,
    } satisfies SimulationWorld;

    const ctx: EngineRunContext = { telemetry: { emit: () => {} } };
    let previousQueueLength = 0;

    function extractNewTasks(currentWorld: SimulationWorld): WorkforceTaskInstance[] {
      const queue = currentWorld.workforce?.taskQueue ?? [];
      const newEntries = queue.slice(previousQueueLength);
      previousQueueLength = queue.length;
      return newEntries;
    }

    // Cycle 1 - expect sterilisation task
    world = runStages(world, ctx, PIPELINE_ORDER);
    let newTasks = extractNewTasks(world);
    const steriliseCode = soilMultiCycle.reusePolicy.sterilizationTaskCode ?? 'cultivation.substrate.sterilize';
    expect(newTasks.map((task) => task.taskCode)).toEqual([steriliseCode]);

    // Prepare Cycle 2 - update harvest tick to current cycle
    world = updateZone(world, (_structure, _room, incomingZone) => {
      const updatedPlants = incomingZone.plants.map((plant) => ({
        ...plant,
        harvestedAt_tick: Math.trunc(world.simTimeHours) - 1,
      }));

      return { ...incomingZone, plants: updatedPlants } satisfies Zone;
    });

    world = runStages(world, ctx, PIPELINE_ORDER);
    newTasks = extractNewTasks(world);
    expect(newTasks.map((task) => task.taskCode)).toEqual(['cultivation.substrate.dispose']);

    // Prepare Cycle 3 - container service life reached, expect repot + sterilise
    world = updateZone(world, (_structure, _room, incomingZone) => {
      const updatedPlants = incomingZone.plants.map((plant) => ({
        ...plant,
        harvestedAt_tick: Math.trunc(world.simTimeHours) - 1,
      }));

      return { ...incomingZone, plants: updatedPlants } satisfies Zone;
    });

    world = runStages(world, ctx, PIPELINE_ORDER);
    newTasks = extractNewTasks(world);
    const sortedCodes = newTasks.map((task) => task.taskCode).sort();
    expect(sortedCodes).toEqual(['cultivation.repot', steriliseCode].sort());

    // Ensure contexts carry zone metadata for downstream scheduling
    newTasks.forEach((task) => {
      expect(task.context?.zoneId).toBe(world.company.structures[0]?.rooms[0]?.zones[0]?.id);
      expect(task.context?.structureId).toBe(world.company.structures[0]?.id);
    });
  });
});


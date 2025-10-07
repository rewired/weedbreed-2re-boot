import { describe, expect, it } from 'vitest';

import basicSoilPot from '../../../../../data/blueprints/cultivation-method/basic-soil-pot.json' assert { type: 'json' };
import pot10L from '../../../../../data/blueprints/container/pot-10l.json' assert { type: 'json' };
import soilMultiCycle from '../../../../../data/blueprints/substrate/soil-multi-cycle.json' assert { type: 'json' };

import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import {
  ensureCultivationTaskRuntime,
  getCultivationMethodCatalog,
  scheduleCultivationTasksForZone,
} from '@/backend/src/cultivation/methodRuntime.js';
import type {
  EngineRunContext as EngineContext,
} from '@/backend/src/engine/Engine.js';
import type {
  Plant,
  SimulationWorld,
  WorkforceState,
  WorkforceTaskDefinition,
  Zone,
  Structure,
  Room,
  Uuid,
} from '@/backend/src/domain/world.js';

function createTaskDefinition(taskCode: string): WorkforceTaskDefinition {
  return {
    taskCode,
    description: taskCode,
    requiredRoleSlug: 'cultivator',
    requiredSkills: [],
    priority: 50,
    costModel: { basis: 'perPlant', laborMinutes: 12 },
  } satisfies WorkforceTaskDefinition;
}

function cloneWorldWithZone(
  world: SimulationWorld,
  zoneUpdater: (zone: Zone) => Zone,
): { world: SimulationWorld; structure: Structure; room: Room; zone: Zone } {
  const structure = world.company.structures[0];
  const room = structure.rooms[0];
  const zone = room.zones[0];
  const updatedZone = zoneUpdater(zone);
  const updatedRoom = { ...room, zones: [updatedZone] } satisfies typeof room;
  const updatedStructure = { ...structure, rooms: [updatedRoom] } satisfies typeof structure;
  const updatedCompany = {
    ...world.company,
    structures: [updatedStructure],
  } satisfies typeof world.company;
  const updatedWorld = {
    ...world,
    company: updatedCompany,
  } satisfies SimulationWorld;

  return {
    world: updatedWorld,
    structure: updatedStructure,
    room: updatedRoom,
    zone: updatedZone,
  };
}

describe('cultivation method runtime task scheduling', () => {
  it('emits sterilisation, disposal, and repot tasks according to policy cycles', () => {
    let baseWorld = createDemoWorld();
    baseWorld = {
      ...baseWorld,
      simTimeHours: 48,
    } satisfies SimulationWorld;

    const { world, structure, room, zone } = cloneWorldWithZone(baseWorld, (incomingZone) => {
      const containerId = pot10L.id as Uuid;
      const substrateId = soilMultiCycle.id as Uuid;
      const cultivationMethodId = basicSoilPot.id as Uuid;
      const plantTemplate: Omit<Plant, 'id'> = {
        name: 'Test plant',
        slug: 'test-plant',
        strainId: '00000000-0000-4000-8000-000000000011' as Uuid,
        lifecycleStage: 'harvest-ready',
        ageHours: 720,
        health01: 0.9,
        biomass_g: 450,
        containerId,
        substrateId,
        readyForHarvest: false,
        status: 'harvested',
        harvestedAt_tick: 47,
      } satisfies Omit<Plant, 'id'>;

      const plants: Plant[] = [
        { ...plantTemplate, id: ('00000000-0000-4000-8000-000000000101' as Uuid) },
        { ...plantTemplate, id: ('00000000-0000-4000-8000-000000000102' as Uuid) },
      ];

      return {
        ...incomingZone,
        cultivationMethodId,
        containerId,
        substrateId,
        plants,
      } satisfies Zone;
    });

    const workforceState: WorkforceState = {
      roles: [],
      employees: [],
      taskDefinitions: [
        createTaskDefinition('cultivation.repot'),
        createTaskDefinition(soilMultiCycle.reusePolicy.sterilizationTaskCode ?? 'cultivation.substrate.sterilize'),
        createTaskDefinition('cultivation.substrate.dispose'),
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

    const worldWithWorkforce = {
      ...world,
      workforce: workforceState,
    } satisfies SimulationWorld;

    const ctx: EngineContext = {};
    const runtime = ensureCultivationTaskRuntime(ctx);
    const catalog = getCultivationMethodCatalog();
    const currentTick = Math.trunc(worldWithWorkforce.simTimeHours);

    const firstPassTasks = scheduleCultivationTasksForZone({
      world: worldWithWorkforce,
      structure,
      room,
      zone,
      workforce: workforceState,
      runtime,
      currentTick,
      methodCatalog: catalog,
    });

    const steriliseCode = soilMultiCycle.reusePolicy.sterilizationTaskCode ?? 'cultivation.substrate.sterilize';
    expect(firstPassTasks, 'first harvest schedules sterilisation').toHaveLength(1);
    expect(firstPassTasks[0]?.taskCode).toBe(steriliseCode);

    // Second cycle should trigger substrate disposal (maxCycles = 2)
    const secondCyclePlants: Plant[] = zone.plants.map((plant) => ({
      ...plant,
      harvestedAt_tick: currentTick,
    }));
    const secondCycleZone: Zone = { ...zone, plants: secondCyclePlants } satisfies Zone;
    const secondCycleWorld = {
      ...worldWithWorkforce,
      simTimeHours: worldWithWorkforce.simTimeHours + 1,
    } satisfies SimulationWorld;

    const secondPassTasks = scheduleCultivationTasksForZone({
      world: secondCycleWorld,
      structure,
      room,
      zone: secondCycleZone,
      workforce: workforceState,
      runtime,
      currentTick: Math.trunc(secondCycleWorld.simTimeHours),
      methodCatalog: catalog,
    });

    expect(secondPassTasks, 'second harvest schedules disposal').toHaveLength(1);
    expect(secondPassTasks[0]?.taskCode).toBe('cultivation.substrate.dispose');

    // Third cycle should trigger container repot (service life 3) and another sterilisation.
    const thirdCyclePlants: Plant[] = zone.plants.map((plant) => ({
      ...plant,
      harvestedAt_tick: Math.trunc(secondCycleWorld.simTimeHours),
    }));
    const thirdCycleZone: Zone = { ...zone, plants: thirdCyclePlants } satisfies Zone;
    const thirdCycleWorld = {
      ...secondCycleWorld,
      simTimeHours: secondCycleWorld.simTimeHours + 1,
    } satisfies SimulationWorld;

    const thirdPassTasks = scheduleCultivationTasksForZone({
      world: thirdCycleWorld,
      structure,
      room,
      zone: thirdCycleZone,
      workforce: workforceState,
      runtime,
      currentTick: Math.trunc(thirdCycleWorld.simTimeHours),
      methodCatalog: catalog,
    });

    const taskCodes = thirdPassTasks.map((task) => task.taskCode).sort();
    expect(taskCodes).toEqual(['cultivation.repot', steriliseCode].sort());

    const contexts = thirdPassTasks.map((task) => task.context ?? {}) as Record<string, unknown>[];
    contexts.forEach((context) => {
      expect(context.zoneId).toBe(zone.id);
      expect(context.structureId).toBe(structure.id);
    });
  });
});


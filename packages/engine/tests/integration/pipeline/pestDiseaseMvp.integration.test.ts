import { describe, expect, it } from 'vitest';

import { PIPELINE_ORDER, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness.js';
import {
  PEST_INSPECTION_TASK_CODE,
  PEST_TREATMENT_TASK_CODE,
} from '@/backend/src/health/pestDiseaseSystem.js';
import type {
  EmployeeRole,
  HealthState,
  SimulationWorld,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  Zone,
} from '@/backend/src/domain/world.js';

function createRole(): EmployeeRole {
  return {
    id: '00000000-0000-0000-0000-00000000d001' as EmployeeRole['id'],
    slug: 'biosecurity_specialist',
    name: 'Biosecurity Specialist',
    coreSkills: [{ skillKey: 'cleanliness', minSkill01: 0.5 }],
  } satisfies EmployeeRole;
}

function createInspectionDefinition(): WorkforceTaskDefinition {
  return {
    taskCode: PEST_INSPECTION_TASK_CODE,
    description: 'Inspect grow zone for pest activity',
    requiredRoleSlug: 'biosecurity_specialist',
    requiredSkills: [{ skillKey: 'cleanliness', minSkill01: 0.4 }],
    priority: 85,
    costModel: { basis: 'perSquareMeter', laborMinutes: 24 },
  } satisfies WorkforceTaskDefinition;
}

function createTreatmentDefinition(): WorkforceTaskDefinition {
  return {
    taskCode: PEST_TREATMENT_TASK_CODE,
    description: 'Apply integrated pest management treatment',
    requiredRoleSlug: 'biosecurity_specialist',
    requiredSkills: [{ skillKey: 'gardening', minSkill01: 0.5 }],
    priority: 95,
    costModel: { basis: 'perSquareMeter', laborMinutes: 36 },
  } satisfies WorkforceTaskDefinition;
}

function rebuildWorldForScenario(baseWorld: SimulationWorld): SimulationWorld {
  const structure = baseWorld.company.structures[0];
  const room = structure.rooms[0];
  const zone = room.zones[0];

  const updatedZone: Zone = {
    ...zone,
    environment: {
      ...zone.environment,
      airTemperatureC: 31,
      relativeHumidity_pct: 85,
    },
  };

  const updatedRoom = {
    ...room,
    zones: room.zones.map((entry) => (entry.id === zone.id ? updatedZone : entry)),
  } satisfies typeof room;

  const updatedStructure = {
    ...structure,
    rooms: structure.rooms.map((entry) => (entry.id === room.id ? updatedRoom : entry)),
  } satisfies typeof structure;

  const updatedCompany = {
    ...baseWorld.company,
    structures: baseWorld.company.structures.map((entry) =>
      entry.id === structure.id ? updatedStructure : entry,
    ),
  } satisfies typeof baseWorld.company;

  const workforceRole = createRole();
  const inspectionDefinition = createInspectionDefinition();
  const treatmentDefinition = createTreatmentDefinition();

  const baseWorkforce = baseWorld.workforce;
  const workforce: WorkforceState = {
    ...baseWorkforce,
    roles: [workforceRole],
    employees: [],
    taskDefinitions: [inspectionDefinition, treatmentDefinition],
    taskQueue: [],
    kpis: [],
    warnings: [],
  } satisfies WorkforceState;

  const health: HealthState = {
    pestDisease: {
      zoneRisks: [],
      hygieneSignals: [
        {
          roomId: room.id,
          hygieneScore01: 0.35,
          updatedTick: baseWorld.simTimeHours,
        },
      ],
    },
  } satisfies HealthState;

  return {
    ...baseWorld,
    company: updatedCompany,
    workforce,
    health,
  } satisfies SimulationWorld;
}

describe('pest & disease system MVP integration', () => {
  it('accumulates risk, emits tasks, and enforces quarantine windows', () => {
    let world = rebuildWorldForScenario(createDemoWorld());
    const maybeZoneId = world.company.structures[0]?.rooms[0]?.zones[0]?.id;
    expect(maybeZoneId).toBeDefined();
    const targetZoneId = maybeZoneId as Zone['id'];
    const telemetryEvents: { topic: string; payload: any }[] = [];
    const ctx: EngineRunContext = {
      telemetry: {
        emit(topic, payload) {
          telemetryEvents.push({ topic, payload });
        },
      },
    } satisfies EngineRunContext;

    const queueSizes: number[] = [];
    const riskLevels: string[] = [];
    const riskValues: number[] = [];

    for (let tick = 0; tick < 3; tick += 1) {
      world = runStages(world, ctx, PIPELINE_ORDER);
      queueSizes.push(world.workforce.taskQueue.length);

      const riskState = world.health?.pestDisease.zoneRisks.find(
        (entry) => entry.zoneId === targetZoneId,
      );
      expect(riskState).toBeDefined();
      riskLevels.push(riskState?.riskLevel ?? 'low');
      riskValues.push(riskState?.risk01 ?? 0);

      if (tick === 1) {
        expect(riskState?.quarantineUntilTick).toBeGreaterThan(world.simTimeHours);
      }
    }

    expect(riskLevels[0]).toBe('moderate');
    expect(riskLevels[1]).toBe('high');
    expect(riskLevels[2]).toBe('high');
    expect(queueSizes[0]).toBe(1);
    expect(queueSizes[1]).toBe(2);
    expect(queueSizes[2]).toBe(2);
    expect(riskValues[1]).toBeGreaterThan(riskValues[0]);

    const inspectionTask = world.workforce.taskQueue.find(
      (task) => task.taskCode === PEST_INSPECTION_TASK_CODE,
    ) as WorkforceTaskInstance | undefined;
    const treatmentTask = world.workforce.taskQueue.find(
      (task) => task.taskCode === PEST_TREATMENT_TASK_CODE,
    ) as WorkforceTaskInstance | undefined;

    expect(inspectionTask).toBeDefined();
    expect(treatmentTask).toBeDefined();
    expect(treatmentTask?.dueTick).toBeGreaterThanOrEqual(treatmentTask?.createdAtTick ?? 0);

    const riskEvents = telemetryEvents.filter(
      (entry) => entry.topic === 'telemetry.health.pest_disease.risk.v1',
    );
    const taskEvents = telemetryEvents.filter(
      (entry) => entry.topic === 'telemetry.health.pest_disease.task_emitted.v1',
    );

    expect(riskEvents.length).toBeGreaterThanOrEqual(3);
    expect(taskEvents.length).toBe(2);

    const firstRiskLevel = riskEvents[0]?.payload.warnings[0]?.riskLevel;
    const secondRiskLevel = riskEvents[1]?.payload.warnings[0]?.riskLevel;
    expect(firstRiskLevel).toBe('moderate');
    expect(secondRiskLevel).toBe('high');

    const emittedTaskCodes = taskEvents.flatMap((entry) =>
      entry.payload.events.map((event: any) => event.taskCode),
    );
    expect(emittedTaskCodes).toEqual([
      PEST_INSPECTION_TASK_CODE,
      PEST_TREATMENT_TASK_CODE,
    ]);
  });
});

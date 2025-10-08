import {
  DEFAULT_HEALTH_STATE,
  type HealthState,
  type PestDiseaseRiskLevel,
  type PestDiseaseZoneRiskState
} from '../domain/health/pestDisease.js';
import type {
  Room,
  SimulationWorld,
  Structure,
  WorkforceState,
  WorkforceTaskInstance,
  Zone,
} from '../domain/world.js';
import { evaluatePestDiseaseRisk, resolveRiskLevel } from './pestDiseaseRisk.js';
import { deterministicUuid } from '../util/uuid.js';

export const PEST_INSPECTION_TASK_CODE = 'task.pest.inspection';
export const PEST_TREATMENT_TASK_CODE = 'task.pest.treatment';
export const INSPECTION_COOLDOWN_HOURS = 24;
export const TREATMENT_COOLDOWN_HOURS = 72;
export const QUARANTINE_DURATION_HOURS = 72;
export const INSPECTION_DUE_OFFSET_HOURS = 12;
export const TREATMENT_DUE_OFFSET_HOURS = 6;
export const DEFAULT_ROOM_HYGIENE_SCORE01 = 0.85;

export interface PestDiseaseRiskWarning {
  readonly structureId: Structure['id'];
  readonly roomId: Room['id'];
  readonly zoneId: Zone['id'];
  readonly riskLevel: PestDiseaseRiskLevel;
  readonly risk01: number;
  readonly tick: number;
}

export interface PestDiseaseTaskEvent {
  readonly taskId: WorkforceTaskInstance['id'];
  readonly taskCode: WorkforceTaskInstance['taskCode'];
  readonly structureId: Structure['id'];
  readonly roomId: Room['id'];
  readonly zoneId: Zone['id'];
  readonly tick: number;
  readonly riskLevel: PestDiseaseRiskLevel;
  readonly risk01: number;
}

export interface PestDiseaseEvaluationResult {
  readonly health: HealthState;
  readonly scheduledTasks: readonly WorkforceTaskInstance[];
  readonly warnings: readonly PestDiseaseRiskWarning[];
  readonly taskEvents: readonly PestDiseaseTaskEvent[];
}

interface HygieneSignalLookup {
  readonly hygieneScore01: number;
  readonly updatedTick: number;
}

function collectHygieneSignals(world: SimulationWorld): Map<Room['id'], HygieneSignalLookup> {
  const signals = new Map<Room['id'], HygieneSignalLookup>();
  const health = world.health ?? DEFAULT_HEALTH_STATE;
  for (const entry of health.pestDisease.hygieneSignals) {
    signals.set(entry.roomId, { hygieneScore01: entry.hygieneScore01, updatedTick: entry.updatedTick });
  }
  return signals;
}

function resolveHygieneScore(roomId: Room['id'], hygieneSignals: Map<Room['id'], HygieneSignalLookup>): number {
  const signal = hygieneSignals.get(roomId);
  if (!signal) {
    return DEFAULT_ROOM_HYGIENE_SCORE01;
  }
  return signal.hygieneScore01;
}

function indexExistingTasks(tasks: readonly WorkforceTaskInstance[]): Set<WorkforceTaskInstance['id']> {
  return new Set(tasks.map((task) => task.id));
}

function findDefinition(
  workforce: WorkforceState | undefined,
  taskCode: string,
): WorkforceTaskInstance['taskCode'] | undefined {
  const definition = workforce?.taskDefinitions.find((entry) => entry.taskCode === taskCode);
  return definition?.taskCode;
}

function shouldSchedule(
  lastTick: number | undefined,
  currentTick: number,
  cooldown: number,
): boolean {
  if (!Number.isFinite(currentTick)) {
    return false;
  }
  if (lastTick === undefined) {
    return true;
  }
  return currentTick - lastTick >= cooldown;
}

function isQuarantined(quarantineUntilTick: number | undefined, currentTick: number): boolean {
  return quarantineUntilTick !== undefined && quarantineUntilTick > currentTick;
}

function createTaskId(
  worldSeed: string,
  taskCode: WorkforceTaskInstance['taskCode'],
  zoneId: Zone['id'],
  currentTick: number,
): WorkforceTaskInstance['id'] {
  return deterministicUuid(worldSeed, `pest:${taskCode}:${zoneId}:${currentTick}`);
}

function buildTask(
  worldSeed: string,
  taskCode: WorkforceTaskInstance['taskCode'],
  zone: Zone,
  room: Room,
  structure: Structure,
  currentTick: number,
  riskLevel: PestDiseaseRiskLevel,
  risk01: number,
  dueOffset: number,
): WorkforceTaskInstance {
  const id = createTaskId(worldSeed, taskCode, zone.id, currentTick);
  const dueTick = Math.max(currentTick, currentTick + dueOffset);
  return {
    id,
    taskCode,
    status: 'queued',
    createdAtTick: currentTick,
    dueTick,
    context: {
      structureId: structure.id,
      roomId: room.id,
      zoneId: zone.id,
      riskLevel,
      risk01,
    },
  } satisfies WorkforceTaskInstance;
}

export function evaluatePestDiseaseSystem(
  world: SimulationWorld,
  currentTick: number,
): PestDiseaseEvaluationResult {
  const health = world.health ?? DEFAULT_HEALTH_STATE;
  const hygieneSignals = collectHygieneSignals(world);
  const previousRiskStates = new Map(
    health.pestDisease.zoneRisks.map((entry) => [entry.zoneId, entry]),
  );
  const existingTaskIds = indexExistingTasks(world.workforce?.taskQueue ?? []);
  const supportsInspection = Boolean(findDefinition(world.workforce, PEST_INSPECTION_TASK_CODE));
  const supportsTreatment = Boolean(findDefinition(world.workforce, PEST_TREATMENT_TASK_CODE));

  const scheduledTasks: WorkforceTaskInstance[] = [];
  const warnings: PestDiseaseRiskWarning[] = [];
  const taskEvents: PestDiseaseTaskEvent[] = [];
  const updatedRiskStates: PestDiseaseZoneRiskState[] = [];

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        const previous = previousRiskStates.get(zone.id);
        const previousRisk01 = previous?.risk01 ?? 0;
        const quarantineUntilTick = previous?.quarantineUntilTick;
        const zoneIsQuarantined = isQuarantined(quarantineUntilTick, currentTick);
        const hygieneScore01 = resolveHygieneScore(room.id, hygieneSignals);

        const evaluation = evaluatePestDiseaseRisk({
          environment: zone.environment,
          hygieneScore01,
          previousRisk01,
          isQuarantined: zoneIsQuarantined,
        });

        const riskLevel = resolveRiskLevel(evaluation.risk01);
        let nextInspectionTick = previous?.lastInspectionTick;
        let nextTreatmentTick = previous?.lastTreatmentTick;
        let nextQuarantineUntilTick = quarantineUntilTick;

        if (riskLevel !== 'low') {
          warnings.push({
            structureId: structure.id,
            roomId: room.id,
            zoneId: zone.id,
            riskLevel,
            risk01: evaluation.risk01,
            tick: currentTick,
          });
        }

        if (
          supportsInspection &&
          riskLevel !== 'low' &&
          shouldSchedule(nextInspectionTick, currentTick, INSPECTION_COOLDOWN_HOURS)
        ) {
          const task = buildTask(
            world.seed,
            PEST_INSPECTION_TASK_CODE,
            zone,
            room,
            structure,
            currentTick,
            riskLevel,
            evaluation.risk01,
            INSPECTION_DUE_OFFSET_HOURS,
          );

          if (!existingTaskIds.has(task.id)) {
            scheduledTasks.push(task);
            existingTaskIds.add(task.id);
            taskEvents.push({
              taskId: task.id,
              taskCode: task.taskCode,
              structureId: structure.id,
              roomId: room.id,
              zoneId: zone.id,
              tick: currentTick,
              riskLevel,
              risk01: evaluation.risk01,
            });
          }

          nextInspectionTick = currentTick;
        }

        if (
          supportsTreatment &&
          riskLevel === 'high' &&
          !zoneIsQuarantined &&
          shouldSchedule(nextTreatmentTick, currentTick, TREATMENT_COOLDOWN_HOURS)
        ) {
          const task = buildTask(
            world.seed,
            PEST_TREATMENT_TASK_CODE,
            zone,
            room,
            structure,
            currentTick,
            riskLevel,
            evaluation.risk01,
            TREATMENT_DUE_OFFSET_HOURS,
          );

          if (!existingTaskIds.has(task.id)) {
            scheduledTasks.push(task);
            existingTaskIds.add(task.id);
            taskEvents.push({
              taskId: task.id,
              taskCode: task.taskCode,
              structureId: structure.id,
              roomId: room.id,
              zoneId: zone.id,
              tick: currentTick,
              riskLevel,
              risk01: evaluation.risk01,
            });
          }

          nextTreatmentTick = currentTick;
          nextQuarantineUntilTick = currentTick + QUARANTINE_DURATION_HOURS;
        }

        updatedRiskStates.push({
          zoneId: zone.id,
          roomId: room.id,
          structureId: structure.id,
          risk01: evaluation.risk01,
          riskLevel,
          hygieneScore01,
          updatedTick: currentTick,
          lastInspectionTick: nextInspectionTick,
          lastTreatmentTick: nextTreatmentTick,
          quarantineUntilTick: nextQuarantineUntilTick,
        });
      }
    }
  }

  const immutableRiskStates = Object.freeze([...updatedRiskStates]);
  const immutableTasks = Object.freeze([...scheduledTasks]);
  const immutableWarnings = Object.freeze([...warnings]);
  const immutableEvents = Object.freeze([...taskEvents]);

  const nextHealth = Object.freeze({
    pestDisease: Object.freeze({
      zoneRisks: immutableRiskStates,
      hygieneSignals: health.pestDisease.hygieneSignals,
    }),
  } satisfies HealthState) as HealthState;

  return Object.freeze({
    health: nextHealth,
    scheduledTasks: immutableTasks,
    warnings: immutableWarnings,
    taskEvents: immutableEvents,
  } satisfies PestDiseaseEvaluationResult);
}

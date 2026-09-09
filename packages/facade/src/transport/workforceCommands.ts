/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { SimulationWorld, Uuid, WorkforceIntent } from '@wb/engine';
import type { TransportAck, TransportIntentEnvelope } from './adapter.js';
import { hiringMarketScanSchema, hiringMarketHireSchema, workforceRaiseAcceptSchema,
  workforceRaiseBonusSchema, workforceRaiseIgnoreSchema, hrAssignSchema,
  pestZoneIntentSchema, maintenanceTaskSchema, workforceTerminationSchema,
} from './lifecycleCommandValidation.js';

type AssignmentScope = 'structure' | 'room' | 'zone';

export interface WorkforceAckOverlay extends TransportAck {
  readonly result?: unknown;
}

function resolveAssignmentTarget(
  world: SimulationWorld,
  targetId: Uuid,
): { readonly structureId: Uuid; readonly scope: AssignmentScope } | null {
  for (const structure of world.company.structures) {
    if (structure.id === targetId) {
      return { structureId: structure.id, scope: 'structure' };
    }

    for (const room of structure.rooms) {
      if (room.id === targetId) {
        return { structureId: structure.id, scope: 'room' };
      }

      for (const zone of room.zones) {
        if (zone.id === targetId) {
          return { structureId: structure.id, scope: 'zone' };
        }
      }
    }
  }

  return null;
}

export function createWorkforceAckOverlay(
  world: SimulationWorld,
  intent: WorkforceIntent,
): WorkforceAckOverlay | undefined {
  switch (intent.type) {
    case 'hr.assign': {
      const employee = world.workforce.employees.find((entry) => entry.id === intent.employeeId);

      if (!employee) {
        throw new Error(`Employee ${intent.employeeId} not found for hr.assign intent.`);
      }

      const target = resolveAssignmentTarget(world, intent.targetId);

      if (!target) {
        throw new Error(`Assignment target ${intent.targetId} not found in company structures.`);
      }

      return {
        ok: true,
        status: 'queued',
        result: {
          workforce: {
            type: intent.type,
            employeeId: intent.employeeId,
            previousStructureId: employee.assignedStructureId,
            nextStructureId: target.structureId,
            targetScope: target.scope,
            targetId: intent.targetId,
          },
        },
      } satisfies WorkforceAckOverlay;
    }

    default:
      return undefined;
  }
}

export function toWorkforceIntent(envelope: TransportIntentEnvelope): WorkforceIntent | null {
  switch (envelope.type) {
    case 'hiring.market.scan': {
      const { structureId } = hiringMarketScanSchema.parse(envelope);
      return { type: 'hiring.market.scan', structureId } satisfies WorkforceIntent;
    }

    case 'hiring.market.hire': {
      const { candidate } = hiringMarketHireSchema.parse(envelope);
      return { type: 'hiring.market.hire', candidate } satisfies WorkforceIntent;
    }

    case 'workforce.raise.accept': {
      const { employeeId, rateIncreaseFactor, moraleBoost01 } = workforceRaiseAcceptSchema.parse(envelope);
      return {
        type: 'workforce.raise.accept',
        employeeId,
        rateIncreaseFactor,
        moraleBoost01,
      } satisfies WorkforceIntent;
    }

    case 'workforce.raise.bonus': {
      const {
        employeeId,
        bonusAmount_cc: bonusAmountCc,
        rateIncreaseFactor,
        moraleBoost01,
      } = workforceRaiseBonusSchema.parse(envelope);

      return {
        type: 'workforce.raise.bonus',
        employeeId,
        bonusAmount_cc: bonusAmountCc,
        rateIncreaseFactor,
        moraleBoost01,
      } satisfies WorkforceIntent;
    }

    case 'workforce.raise.ignore': {
      const { employeeId, moralePenalty01 } = workforceRaiseIgnoreSchema.parse(envelope);
      return {
        type: 'workforce.raise.ignore',
        employeeId,
        moralePenalty01,
      } satisfies WorkforceIntent;
    }

    case 'hr.assign': {
      const { employeeId, target } = hrAssignSchema.parse(envelope);
      return { type: 'hr.assign', employeeId, targetId: target } satisfies WorkforceIntent;
    }

    case 'pest.inspect.start': {
      const { zoneId } = pestZoneIntentSchema.parse(envelope);
      return { type: 'pest.inspect.start', zoneId } satisfies WorkforceIntent;
    }

    case 'pest.inspect.complete': {
      const { zoneId } = pestZoneIntentSchema.parse(envelope);
      return { type: 'pest.inspect.complete', zoneId } satisfies WorkforceIntent;
    }

    case 'pest.treat.start': {
      const { zoneId } = pestZoneIntentSchema.parse(envelope);
      return { type: 'pest.treat.start', zoneId } satisfies WorkforceIntent;
    }

    case 'pest.treat.complete': {
      const { zoneId } = pestZoneIntentSchema.parse(envelope);
      return { type: 'pest.treat.complete', zoneId } satisfies WorkforceIntent;
    }

    case 'maintenance.start': {
      const { deviceId } = maintenanceTaskSchema.parse(envelope);
      return { type: 'maintenance.start', deviceId } satisfies WorkforceIntent;
    }

    case 'maintenance.complete': {
      const { deviceId } = maintenanceTaskSchema.parse(envelope);
      return { type: 'maintenance.complete', deviceId } satisfies WorkforceIntent;
    }

    case 'workforce.employee.terminate': {
      const {
        employeeId,
        reasonSlug,
        severanceCc,
        moraleRipple01,
      } = workforceTerminationSchema.parse(envelope);
      return {
        type: 'workforce.employee.terminate',
        employeeId,
        reasonSlug,
        severanceCc,
        moraleRipple01,
      } satisfies WorkforceIntent;
    }

    default:
      return null;
  }
}

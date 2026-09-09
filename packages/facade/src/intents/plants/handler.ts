/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  executePlantsHarvest,
  executePlantsSow,
  type DeferredSeedCost,
  type SimulationWorld,
} from '@wb/engine';
import { TELEMETRY_HARVEST_CREATED_V1 } from '@/backend/src/telemetry/topics.js';
import type { TransportAck, TransportIntentEnvelope } from '../../transport/adapter.js';
import {
  plantsHarvestIntentSchema,
  plantsSowIntentSchema,
  type PlantsHarvestIntent,
  type PlantsSowIntent,
} from './schemas.js';

/** Successful sow acknowledgement emitted after the new world is authoritative. */
export interface PlantsSowAck extends TransportAck {
  readonly ok: true;
  readonly status: 'applied';
  readonly result: {
    readonly command: 'plants.sow';
    readonly plantIds: readonly string[];
    readonly strainId: string;
    readonly count: number;
    readonly replayed: boolean;
    readonly seedCost: DeferredSeedCost;
  };
  readonly stateAfter: { readonly simTimeHours: number };
}

/** Successful harvest acknowledgement emitted after lots and plants are committed. */
export interface PlantsHarvestAck extends TransportAck {
  readonly ok: true;
  readonly status: 'applied';
  readonly result: {
    readonly command: 'plants.harvest';
    readonly lotIds: readonly string[];
    readonly plantIds: readonly string[];
    readonly replayed: boolean;
  };
  readonly stateAfter: { readonly simTimeHours: number };
}

/** World boundary used by the plants command adapter. */
export interface PlantsWorldAccess {
  readonly get: () => SimulationWorld;
  readonly set: (world: SimulationWorld) => void;
  /** Emits read-only post-commit domain telemetry. */
  readonly emitTelemetry?: (topic: string, payload: Record<string, unknown>) => void;
}

interface CachedSowSubmission {
  readonly fingerprint: string;
  readonly acknowledgement: PlantsSowAck;
}

interface CachedHarvestSubmission {
  readonly fingerprint: string;
  readonly acknowledgement: PlantsHarvestAck;
}

function fingerprint(intent: PlantsSowIntent): string {
  const command = { ...intent } as Record<string, unknown>;
  delete command.correlationId;
  return JSON.stringify(command);
}

function harvestFingerprint(intent: PlantsHarvestIntent): string {
  const command = { ...intent, plantIds: [...intent.plantIds].sort() } as Record<string, unknown>;
  delete command.correlationId;
  return JSON.stringify(command);
}

/** Creates the idempotent façade adapter for the engine's sow command. */
export function createPlantsIntentHandler(worldAccess: PlantsWorldAccess) {
  const submissions = new Map<string, CachedSowSubmission>();
  const harvestSubmissions = new Map<string, CachedHarvestSubmission>();

  return async (envelope: TransportIntentEnvelope): Promise<PlantsSowAck | PlantsHarvestAck> => {
    if (envelope.type === 'plants.harvest.v1') {
      const intent = plantsHarvestIntentSchema.parse(envelope);
      const intentFingerprint = harvestFingerprint(intent);
      const cached = harvestSubmissions.get(intent.intentId);
      if (cached) {
        if (cached.fingerprint !== intentFingerprint) {
          throw new Error(`Intent id ${intent.intentId} was already used with a different payload.`);
        }
        return cached.acknowledgement;
      }

      const result = executePlantsHarvest(worldAccess.get(), {
        intentId: intent.intentId,
        structureId: intent.structureId,
        roomId: intent.roomId,
        zoneId: intent.zoneId,
        plantIds: intent.plantIds,
      });
      if (!result.ok) throw new Error(`${result.code}: ${result.message}`);

      worldAccess.set(result.world);
      if (!result.replayed) {
        for (const lot of result.lots) {
          worldAccess.emitTelemetry?.(TELEMETRY_HARVEST_CREATED_V1, {
            structureId: lot.structureId,
            roomId: lot.roomId,
            strainId: lot.strainId,
            plantId: lot.source.plantId,
            zoneId: lot.source.zoneId,
            lotId: lot.id,
            createdAt_tick: lot.createdAt_tick,
            freshWeight_kg: lot.freshWeight_kg,
            moisture01: lot.moisture01,
            quality01: lot.quality01,
          });
        }
      }
      const acknowledgement = {
        ok: true,
        status: 'applied',
        appliedTick: result.world.simTimeHours,
        result: {
          command: 'plants.harvest',
          lotIds: result.lotIds,
          plantIds: intent.plantIds,
          replayed: result.replayed,
        },
        stateAfter: { simTimeHours: result.world.simTimeHours },
      } satisfies PlantsHarvestAck;
      harvestSubmissions.set(intent.intentId, { fingerprint: intentFingerprint, acknowledgement });
      return acknowledgement;
    }

    const intent = plantsSowIntentSchema.parse(envelope);
    const intentFingerprint = fingerprint(intent);
    const cached = submissions.get(intent.intentId);

    if (cached) {
      if (cached.fingerprint !== intentFingerprint) {
        throw new Error(`Intent id ${intent.intentId} was already used with a different payload.`);
      }
      return cached.acknowledgement;
    }

    const result = executePlantsSow(worldAccess.get(), {
      intentId: intent.intentId,
      structureId: intent.structureId,
      roomId: intent.roomId,
      zoneId: intent.zoneId,
      strainId: intent.strainId,
      count: intent.count,
    });
    if (!result.ok) {
      throw new Error(`${result.code}: ${result.message}`);
    }

    worldAccess.set(result.world);
    const acknowledgement = {
      ok: true,
      status: 'applied',
      appliedTick: result.world.simTimeHours,
      result: {
        command: 'plants.sow',
        plantIds: result.plantIds,
        strainId: intent.strainId,
        count: intent.count,
        replayed: result.replayed,
        seedCost: result.seedCost,
      },
      stateAfter: { simTimeHours: result.world.simTimeHours },
    } satisfies PlantsSowAck;
    submissions.set(intent.intentId, { fingerprint: intentFingerprint, acknowledgement });
    return acknowledgement;
  };
}

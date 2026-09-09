/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  executeDevicePurchaseInstall,
  executeRoomCreate,
  executeZoneCreate,
  type DeviceCoverageResult,
  type DeferredPurchaseCost,
  type FacilityMutationResult,
  type SimulationWorld,
} from '@wb/engine';
import type { TransportAck, TransportIntentEnvelope } from '../../transport/adapter.js';
import { parseFacilityIntent, type FacilityIntent } from './schemas.js';

type FacilityCommandName = 'room.create' | 'zone.create' | 'device.purchaseInstall';

/** Ack returned only after the engine result has replaced the authoritative world. */
export interface FacilityAck extends TransportAck {
  readonly ok: true;
  readonly status: 'applied';
  readonly result: {
    readonly command: FacilityCommandName;
    readonly entityId: string;
    readonly replayed: boolean;
    readonly purchaseCost?: DeferredPurchaseCost;
    readonly coverage?: DeviceCoverageResult;
  };
  readonly stateAfter: {
    readonly simTimeHours: number;
  };
}

/** Mutable world boundary owned by the façade runtime. */
export interface FacilityWorldAccess {
  readonly get: () => SimulationWorld;
  readonly set: (world: SimulationWorld) => void;
}

interface CachedFacilitySubmission {
  readonly fingerprint: string;
  readonly acknowledgement: FacilityAck;
}

function fingerprint(intent: FacilityIntent): string {
  const command = { ...intent } as Record<string, unknown>;
  delete command.correlationId;
  return JSON.stringify(command);
}

function commandName(intent: FacilityIntent): FacilityCommandName {
  switch (intent.type) {
    case 'room.create.v1':
      return 'room.create';
    case 'zone.create.v1':
      return 'zone.create';
    case 'device.purchaseInstall.v1':
      return 'device.purchaseInstall';
  }
}

function execute(world: SimulationWorld, intent: FacilityIntent) {
  switch (intent.type) {
    case 'room.create.v1': {
      return executeRoomCreate(world, {
        intentId: intent.intentId,
        structureId: intent.structureId,
        name: intent.name,
        purpose: intent.purpose,
        floorArea_m2: intent.floorArea_m2,
        height_m: intent.height_m,
      });
    }
    case 'zone.create.v1': {
      return executeZoneCreate(world, {
        intentId: intent.intentId,
        structureId: intent.structureId,
        roomId: intent.roomId,
        name: intent.name,
        floorArea_m2: intent.floorArea_m2,
        cultivationMethodId: intent.cultivationMethodId,
        containerId: intent.containerId,
        substrateId: intent.substrateId,
        irrigationMethodId: intent.irrigationMethodId,
      });
    }
    case 'device.purchaseInstall.v1': {
      return executeDevicePurchaseInstall(world, {
        intentId: intent.intentId,
        structureId: intent.structureId,
        roomId: intent.roomId,
        zoneId: intent.zoneId,
        deviceBlueprintId: intent.deviceBlueprintId,
      });
    }
  }
}

function toAcknowledgement(
  intent: FacilityIntent,
  result: Extract<FacilityMutationResult, { readonly ok: true }> & {
    readonly purchaseCost?: DeferredPurchaseCost;
    readonly coverage?: DeviceCoverageResult;
  },
): FacilityAck {
  return {
    ok: true,
    status: 'applied',
    appliedTick: result.world.simTimeHours,
    result: {
      command: commandName(intent),
      entityId: result.entityId,
      replayed: result.replayed,
      ...(result.purchaseCost ? { purchaseCost: result.purchaseCost } : {}),
      ...(result.coverage ? { coverage: result.coverage } : {}),
    },
    stateAfter: { simTimeHours: result.world.simTimeHours },
  } satisfies FacilityAck;
}

/** Creates an idempotent adapter around the engine's authoritative facility commands. */
export function createFacilityIntentHandler(worldAccess: FacilityWorldAccess) {
  const submissions = new Map<string, CachedFacilitySubmission>();

  return async (envelope: TransportIntentEnvelope): Promise<FacilityAck> => {
    const intent = parseFacilityIntent(envelope);
    const intentFingerprint = fingerprint(intent);
    const cached = submissions.get(intent.intentId);

    if (cached) {
      if (cached.fingerprint !== intentFingerprint) {
        throw new Error(`Intent id ${intent.intentId} was already used with a different payload.`);
      }

      return cached.acknowledgement;
    }

    const result = execute(worldAccess.get(), intent);
    if (!result.ok) {
      throw new Error(`${result.code}: ${result.message}`);
    }

    worldAccess.set(result.world);
    const acknowledgement = toAcknowledgement(intent, result);
    submissions.set(intent.intentId, { fingerprint: intentFingerprint, acknowledgement });
    return acknowledgement;
  };
}

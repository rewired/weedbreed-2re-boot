/* eslint-disable wb-sim/no-ts-import-js-extension */

import { executeInventorySell, type HarvestSaleQuote, type SimulationWorld } from '@wb/engine';
import type { TransportAck, TransportIntentEnvelope } from '../../transport/adapter.js';
import { inventorySellIntentSchema, type InventorySellIntent } from './schemas.js';

/** Successful sale acknowledgement returned only after its world and ledger are authoritative. */
export interface InventorySellAck extends TransportAck {
  readonly ok: true;
  readonly status: 'applied';
  readonly result: {
    readonly command: 'inventory.sell';
    readonly lotId: string;
    readonly ledgerEntryId: string;
    readonly quote: HarvestSaleQuote;
    readonly balanceBeforeCc: number;
    readonly balanceAfterCc: number;
    readonly replayed: boolean;
  };
  readonly stateAfter: { readonly simTimeHours: number };
}

/** Mutable world boundary owned by the façade runtime. */
export interface InventoryWorldAccess {
  readonly get: () => SimulationWorld;
  readonly set: (world: SimulationWorld) => void;
}

interface CachedSubmission {
  readonly fingerprint: string;
  readonly acknowledgement: InventorySellAck;
}

function fingerprint(intent: InventorySellIntent): string {
  const command = { ...intent } as Record<string, unknown>;
  delete command.correlationId;
  return JSON.stringify(command);
}

/** Creates the idempotent façade adapter for authoritative partial and complete lot sales. */
export function createInventoryIntentHandler(worldAccess: InventoryWorldAccess) {
  const submissions = new Map<string, CachedSubmission>();

  return async (envelope: TransportIntentEnvelope): Promise<InventorySellAck> => {
    const intent = inventorySellIntentSchema.parse(envelope);
    const intentFingerprint = fingerprint(intent);
    const cached = submissions.get(intent.intentId);
    if (cached) {
      if (cached.fingerprint !== intentFingerprint) {
        throw new Error(`Intent id ${intent.intentId} was already used with a different payload.`);
      }
      return cached.acknowledgement;
    }

    const result = executeInventorySell(worldAccess.get(), {
      intentId: intent.intentId,
      lotId: intent.lotId,
      fraction01: intent.fraction01,
    });
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);

    worldAccess.set(result.world);
    const acknowledgement = {
      ok: true,
      status: 'applied',
      appliedTick: result.world.simTimeHours,
      result: {
        command: 'inventory.sell',
        lotId: intent.lotId,
        ledgerEntryId: result.ledgerEntryId,
        quote: result.quote,
        balanceBeforeCc: result.balanceBeforeCc,
        balanceAfterCc: result.balanceAfterCc,
        replayed: result.replayed,
      },
      stateAfter: { simTimeHours: result.world.simTimeHours },
    } satisfies InventorySellAck;
    submissions.set(intent.intentId, { fingerprint: intentFingerprint, acknowledgement });
    return acknowledgement;
  };
}

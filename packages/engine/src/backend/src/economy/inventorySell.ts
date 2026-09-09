import { z } from 'zod';
import strainPricesJson from '../../../../../../data/prices/strainPrices.json' with { type: 'json' };

import type { SimulationWorld, Uuid } from '../domain/entities.ts';
import { parseCompanyWorld } from '../domain/schemas/company.ts';
import { InventorySchema } from '../domain/schemas/InventorySchema.ts';
import { uuidSchema } from '../domain/schemas/primitives.ts';
import { parseStrainPriceMap } from '../domain/pricing/strainPriceMap.ts';
import { postEconomyCredit } from './state.ts';
import { quoteHarvestLotSale, type HarvestSaleQuote } from './sale.ts';

const commandSchema = z.object({
  intentId: uuidSchema,
  lotId: uuidSchema,
  fraction01: z.number().finite().gt(0).max(1),
}).strict();
const STRAIN_PRICES = parseStrainPriceMap(strainPricesJson).strainPrices;

/** Input for the authoritative `inventory.sell.v1` command. */
export interface InventorySellCommand {
  readonly intentId: string;
  readonly lotId: string;
  readonly fraction01: number;
}

/** Stable rejections emitted by inventory sale execution. */
export type InventorySellErrorCode =
  | 'invalid_command'
  | 'intent_conflict'
  | 'lot_not_found'
  | 'no_available_amount'
  | 'price_unavailable'
  | 'economy_unavailable';

/** Successful inventory sale, including values needed for a player-facing preview. */
export interface InventorySellSuccess {
  readonly ok: true;
  readonly world: SimulationWorld;
  readonly ledgerEntryId: Uuid;
  readonly quote: HarvestSaleQuote;
  readonly balanceBeforeCc: number;
  readonly balanceAfterCc: number;
  readonly replayed: boolean;
}

/** Rejected inventory sale with the unchanged input world. */
export interface InventorySellRejection {
  readonly ok: false;
  readonly world: SimulationWorld;
  readonly code: InventorySellErrorCode;
  readonly message: string;
}

/** Result of executing `inventory.sell.v1`. */
export type InventorySellResult = InventorySellSuccess | InventorySellRejection;

function reject(
  world: SimulationWorld,
  code: InventorySellErrorCode,
  message: string,
): InventorySellRejection {
  return { ok: false, world, code, message };
}

/** Executes an atomic, immutable and replay-safe partial or complete lot sale. */
export function executeInventorySell(
  world: SimulationWorld,
  command: InventorySellCommand,
): InventorySellResult {
  const parsed = commandSchema.safeParse(command);
  if (!parsed.success) {
    return reject(world, 'invalid_command', parsed.error.issues[0]?.message ?? 'Invalid sale command.');
  }
  const input = parsed.data;
  const previousEntry = world.economy?.ledger.find((entry) => entry.intentId === input.intentId);
  if (previousEntry) {
    if (previousEntry.category !== 'sale' || previousEntry.referenceId !== input.lotId) {
      return reject(world, 'intent_conflict', 'intentId was already used for another transaction.');
    }
    const fraction = previousEntry.metadata?.fraction01;
    if (fraction !== input.fraction01) {
      return reject(world, 'intent_conflict', 'intentId was already used with a different sale fraction.');
    }
    const balanceBeforeCc = previousEntry.balanceAfterCc - previousEntry.amountCc;
    return {
      ok: true,
      world,
      ledgerEntryId: previousEntry.id,
      quote: {
        fraction01: input.fraction01,
        soldFreshWeightKg: Number(previousEntry.metadata?.soldFreshWeightKg),
        soldDryWeightKg: Number(previousEntry.metadata?.soldDryWeightKg),
        priceCcPerDryGram: Number(previousEntry.metadata?.priceCcPerDryGram),
        qualityFactor: Number(previousEntry.metadata?.qualityFactor),
        proceedsCc: previousEntry.amountCc,
      },
      balanceBeforeCc,
      balanceAfterCc: previousEntry.balanceAfterCc,
      replayed: true,
    };
  }
  if (!world.economy) return reject(world, 'economy_unavailable', 'World has no economy account.');

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      const inventory = room.inventory;
      const lot = inventory?.lots.find((entry) => entry.id === input.lotId);
      if (!lot) continue;
      if (!inventory) continue;
      if (lot.freshWeight_kg <= 0 || lot.moisture01 >= 1) {
        return reject(world, 'no_available_amount', 'Harvest lot has no sellable dry weight.');
      }
      const price = STRAIN_PRICES[lot.strainId];
      if (!price) return reject(world, 'price_unavailable', 'Lot strain has no authoritative harvest price.');
      const quote = quoteHarvestLotSale(lot, input.fraction01, price.harvestPricePerGram);
      const intentId = uuidSchema.parse(input.intentId);
      const posting = postEconomyCredit(world, {
        intentId,
        category: 'sale',
        amountCc: quote.proceedsCc,
        referenceId: lot.id,
        identity: `sale:${intentId}`,
        description: 'Harvest inventory sale',
        metadata: {
          fraction01: quote.fraction01,
          soldFreshWeightKg: quote.soldFreshWeightKg,
          soldDryWeightKg: quote.soldDryWeightKg,
          priceCcPerDryGram: quote.priceCcPerDryGram,
          qualityFactor: quote.qualityFactor,
          strainId: lot.strainId,
        },
      });
      if (!posting.ok) return reject(world, 'economy_unavailable', 'World has no economy account.');

      const remainingFreshWeightKg = lot.freshWeight_kg - quote.soldFreshWeightKg;
      const nextLots = input.fraction01 === 1
        ? inventory.lots.filter((entry) => entry.id !== lot.id)
        : inventory.lots.map((entry) => entry.id === lot.id
          ? { ...entry, freshWeight_kg: remainingFreshWeightKg }
          : entry);
      const nextRoom = { ...room, inventory: InventorySchema.parse({ lots: nextLots }) };
      const nextStructure = {
        ...structure,
        rooms: structure.rooms.map((entry) => entry.id === room.id ? nextRoom : entry),
      };
      const company = parseCompanyWorld({
        ...world.company,
        structures: world.company.structures.map((entry) =>
          entry.id === structure.id ? nextStructure : entry),
      });
      return {
        ok: true,
        world: { ...world, company, economy: posting.economy },
        ledgerEntryId: posting.entry.id,
        quote,
        balanceBeforeCc: world.economy.balanceCc,
        balanceAfterCc: posting.entry.balanceAfterCc,
        replayed: false,
      };
    }
  }
  return reject(world, 'lot_not_found', 'Harvest lot does not exist or has already been sold.');
}

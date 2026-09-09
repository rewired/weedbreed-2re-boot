/* eslint-disable wb-sim/no-ts-import-js-extension */

import { quoteHarvestLotSale, resolveStrain, type SimulationWorld } from '@wb/engine';
import type { InventoryReadModel } from '../readModels/snapshot.js';
import { roundTo, STRAIN_PRICE_MAP } from './readModelShared.js';

/** Projects canonical storage lots with their complete harvest provenance. */
export function mapInventoryReadModel(world: SimulationWorld): InventoryReadModel {
  const balanceBeforeCc = world.economy?.balanceCc ?? 0;
  const cycleContributionMarginCc = (world.economy?.ledger ?? []).reduce(
    (margin, entry) => margin + (entry.direction === 'credit' ? entry.amountCc : -entry.amountCc),
    0,
  );
  const lots = world.company.structures.flatMap((structure) =>
    structure.rooms.flatMap((room) => (room.inventory?.lots ?? []).map((lot) => {
      const priceCcPerDryGram = STRAIN_PRICE_MAP[lot.strainId]?.harvestPricePerGram;
      const quote = world.economy && typeof priceCcPerDryGram === 'number'
        ? quoteHarvestLotSale(lot, 0.5, priceCcPerDryGram)
        : null;
      return {
        lotId: lot.id,
        strainId: lot.strainId,
        strainName: resolveStrain(world, lot.strainId)?.blueprint.name ?? 'Unknown strain',
        quality01: lot.quality01,
        freshWeightKg: roundTo(lot.freshWeight_kg, 6),
        remainingFreshWeightKg: roundTo(lot.freshWeight_kg, 6),
        remainingDryWeightKg: roundTo(lot.freshWeight_kg * (1 - lot.moisture01), 6),
        moisture01: lot.moisture01,
        structureId: lot.structureId,
        storageRoomId: lot.roomId,
        source: {
          plantId: lot.source.plantId,
          zoneId: lot.source.zoneId,
          harvestIntentId: lot.source.harvestIntentId,
        },
        createdAtTick: lot.createdAt_tick,
        salePreview: quote ? {
          ...quote,
          soldFreshWeightKg: roundTo(quote.soldFreshWeightKg, 6),
          soldDryWeightKg: roundTo(quote.soldDryWeightKg, 6),
          proceedsCc: roundTo(quote.proceedsCc, 6),
          balanceBeforeCc: roundTo(balanceBeforeCc, 6),
          balanceAfterCc: roundTo(balanceBeforeCc + quote.proceedsCc, 6),
          cycleContributionMarginAfterCc: roundTo(
            cycleContributionMarginCc + quote.proceedsCc,
            6,
          ),
        } : null,
      };
    })),
  ).sort((left, right) => left.lotId.localeCompare(right.lotId));

  return {
    lots,
    totalFreshWeightKg: roundTo(
      world.company.structures.reduce((structureTotal, structure) =>
        structureTotal + structure.rooms.reduce((roomTotal, room) =>
          roomTotal + (room.inventory?.lots ?? []).reduce(
            (lotTotal, lot) => lotTotal + lot.freshWeight_kg,
            0,
          ),
        0),
      0),
      6,
    ),
  };
}

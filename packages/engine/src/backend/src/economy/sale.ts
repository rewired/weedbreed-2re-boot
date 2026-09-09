import { z } from 'zod';

import type { HarvestLot } from '../domain/types/HarvestLot.ts';

const saleInputSchema = z.object({
  freshWeightKg: z.number().finite().min(0),
  moisture01: z.number().finite().min(0).max(1),
  quality01: z.number().finite().min(0).max(1),
  fraction01: z.number().finite().gt(0).max(1),
  priceCcPerDryGram: z.number().finite().min(0),
}).strict();

/** Pure, fully expanded quote for a harvest-lot sale. */
export interface HarvestSaleQuote {
  readonly fraction01: number;
  readonly soldFreshWeightKg: number;
  readonly soldDryWeightKg: number;
  readonly priceCcPerDryGram: number;
  readonly qualityFactor: number;
  readonly proceedsCc: number;
}

/**
 * Maps canonical quality to a stable market multiplier.
 * Zero quality receives 50% of the strain price and perfect quality receives 100%.
 */
export function computeSaleQualityFactor(quality01: number): number {
  if (!Number.isFinite(quality01) || quality01 < 0 || quality01 > 1) {
    throw new RangeError('quality01 must be finite and within [0,1].');
  }
  return 0.5 + quality01 * 0.5;
}

/**
 * Quotes a sale from dry-weight-normalised inventory.
 * `dry kg = fresh kg × (1 − moisture01)` and proceeds use dry grams.
 */
export function quoteHarvestSale(input: {
  readonly freshWeightKg: number;
  readonly moisture01: number;
  readonly quality01: number;
  readonly fraction01: number;
  readonly priceCcPerDryGram: number;
}): HarvestSaleQuote {
  const value = saleInputSchema.parse(input);
  const soldFreshWeightKg = value.freshWeightKg * value.fraction01;
  const soldDryWeightKg = soldFreshWeightKg * (1 - value.moisture01);
  const qualityFactor = computeSaleQualityFactor(value.quality01);
  return {
    fraction01: value.fraction01,
    soldFreshWeightKg,
    soldDryWeightKg,
    priceCcPerDryGram: value.priceCcPerDryGram,
    qualityFactor,
    proceedsCc: soldDryWeightKg * 1_000 * value.priceCcPerDryGram * qualityFactor,
  };
}

/** Quotes a specific inventory lot at its strain market price. */
export function quoteHarvestLotSale(
  lot: HarvestLot,
  fraction01: number,
  priceCcPerDryGram: number,
): HarvestSaleQuote {
  return quoteHarvestSale({
    freshWeightKg: lot.freshWeight_kg,
    moisture01: lot.moisture01,
    quality01: lot.quality01,
    fraction01,
    priceCcPerDryGram,
  });
}

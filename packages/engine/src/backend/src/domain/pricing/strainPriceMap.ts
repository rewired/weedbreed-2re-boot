import { z } from 'zod';

const nonNegativePrice = z.number().finite().min(0);
const strainPriceEntrySchema = z.object({
  seedPrice: nonNegativePrice,
  harvestPricePerGram: nonNegativePrice,
}).strict();
const strainPriceMapSchema = z.object({
  strainPrices: z.record(z.string().uuid(), strainPriceEntrySchema),
}).strict();

/** Canonical price fields for one static strain blueprint. */
export type StrainPriceEntry = z.infer<typeof strainPriceEntrySchema>;

/** Canonical strain price-map payload. */
export type StrainPriceMap = z.infer<typeof strainPriceMapSchema>;

/** Parses the read-only strain price map used for seed purchase quotes. */
export function parseStrainPriceMap(input: unknown): StrainPriceMap {
  return strainPriceMapSchema.parse(input);
}

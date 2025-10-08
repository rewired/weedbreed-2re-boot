import { z } from 'zod';

import { finiteNumber, nonNegativeNumber, unitIntervalNumber, uuidSchema } from './primitives.js';
import type { HarvestLot } from '../types/HarvestLot.js';

const createdAtTickSchema = finiteNumber
  .min(0, 'createdAt_tick must be greater than or equal to zero.')
  .transform((value) => Math.trunc(value));

export const HarvestLotSchema: z.ZodType<HarvestLot> = z
  .object({
    id: uuidSchema,
    structureId: uuidSchema,
    roomId: uuidSchema,
    source: z
      .object({
        plantId: uuidSchema,
        zoneId: uuidSchema
      })
      .strict(),
    freshWeight_kg: nonNegativeNumber,
    moisture01: unitIntervalNumber,
    quality01: unitIntervalNumber,
    createdAt_tick: createdAtTickSchema
  })
  .strict()
  .transform((lot) => ({ ...lot }) satisfies HarvestLot);

export function isHarvestLot(input: unknown): input is HarvestLot {
  return HarvestLotSchema.safeParse(input).success;
}

import { z } from 'zod';

import type { HarvestLot } from '../types/HarvestLot.js';
import type { Uuid } from '../entities.js';

const uuidSchema: z.ZodType<Uuid> = z.string().uuid().brand<'Uuid'>();

const finiteNumber = z
  .number({ invalid_type_error: 'Expected a number.' })
  .finite({ message: 'Value must be finite.' });
const nonNegativeNumber = finiteNumber.min(0, 'Value must be greater than or equal to zero.');
const unitIntervalNumber = finiteNumber
  .min(0, 'Value must be greater than or equal to zero.')
  .max(1, 'Value must be less than or equal to one.');
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

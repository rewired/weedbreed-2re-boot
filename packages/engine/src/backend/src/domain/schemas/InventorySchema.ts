import { z } from 'zod';

import { HarvestLotSchema } from './HarvestLotSchema.js';

export const InventorySchema = z
  .object({
    lots: z.array(HarvestLotSchema).readonly().default([])
  })
  .strip();

export type Inventory = z.infer<typeof InventorySchema>;

export function isInventory(input: unknown): input is Inventory {
  return InventorySchema.safeParse(input).success;
}

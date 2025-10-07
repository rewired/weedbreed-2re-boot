import { z } from 'zod';

import type { Inventory } from '../types/Inventory.js';
import { HarvestLotSchema } from './HarvestLotSchema.js';

export const InventorySchema: z.ZodType<Inventory> = z
  .object({
    lots: z.array(HarvestLotSchema).readonly()
  })
  .strict();

export function isInventory(input: unknown): input is Inventory {
  return InventorySchema.safeParse(input).success;
}

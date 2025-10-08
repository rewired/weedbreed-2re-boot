import { z } from 'zod';

// Leaf schema: always import sibling schemas directly to avoid barrel cycles.
import { HarvestLotSchema } from './HarvestLotSchema.ts';

export const InventorySchema = z
  .object({
    lots: z.array(HarvestLotSchema).readonly().default([])
  })
  .strip();

export type Inventory = z.infer<typeof InventorySchema>;

export function isInventory(input: unknown): input is Inventory {
  return InventorySchema.safeParse(input).success;
}

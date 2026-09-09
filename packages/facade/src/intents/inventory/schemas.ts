/* eslint-disable wb-sim/no-ts-import-js-extension */

import { z } from 'zod';
import { uuidSchema } from '@wb/engine';

/** Validated transport contract for selling a fraction of one available harvest lot. */
export const inventorySellIntentSchema = z
  .object({
    type: z.literal('inventory.sell.v1'),
    intentId: uuidSchema,
    correlationId: z.string().trim().min(1).optional(),
    lotId: uuidSchema,
    fraction01: z.number().finite().gt(0).max(1),
  })
  .strict();

/** Schema-normalised `inventory.sell.v1` intent. */
export type InventorySellIntent = z.infer<typeof inventorySellIntentSchema>;

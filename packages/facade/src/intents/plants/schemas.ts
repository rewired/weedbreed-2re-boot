/* eslint-disable wb-sim/no-ts-import-js-extension */

import { z } from 'zod';
import { uuidSchema } from '@wb/engine';

/** Validated transport contract for sowing one strain into one empty zone. */
export const plantsSowIntentSchema = z
  .object({
    type: z.literal('plants.sow.v1'),
    intentId: uuidSchema,
    correlationId: z.string().trim().min(1).optional(),
    structureId: uuidSchema,
    roomId: uuidSchema,
    zoneId: uuidSchema,
    strainId: uuidSchema,
    count: z.number().int().positive(),
  })
  .strict();

/** Schema-normalised plants.sow.v1 intent. */
export type PlantsSowIntent = z.infer<typeof plantsSowIntentSchema>;

/** Validated transport contract for manually harvesting ready plants from one zone. */
export const plantsHarvestIntentSchema = z
  .object({
    type: z.literal('plants.harvest.v1'),
    intentId: uuidSchema,
    correlationId: z.string().trim().min(1).optional(),
    structureId: uuidSchema,
    roomId: uuidSchema,
    zoneId: uuidSchema,
    plantIds: z.array(uuidSchema).min(1).refine(
      (plantIds) => new Set(plantIds).size === plantIds.length,
      'plantIds must not contain duplicates.',
    ),
  })
  .strict();

/** Schema-normalised plants.harvest.v1 intent. */
export type PlantsHarvestIntent = z.infer<typeof plantsHarvestIntentSchema>;

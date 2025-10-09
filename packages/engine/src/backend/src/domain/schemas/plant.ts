import { z } from 'zod';

import { PLANT_LIFECYCLE_STAGES, type Plant } from '../entities.ts';
import { finiteNumber, uuidSchema } from './primitives.ts';
import { domainEntitySchema, sluggedEntitySchema, zeroToOneNumber } from './base.ts';

export const plantSchema: z.ZodType<Plant> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .extend({
    strainId: uuidSchema,
    lifecycleStage: z.enum([...PLANT_LIFECYCLE_STAGES]),
    ageHours: finiteNumber.min(0, 'ageHours cannot be negative.'),
    health01: zeroToOneNumber,
    biomass_g: finiteNumber.min(0, 'biomass_g cannot be negative.'),
    containerId: uuidSchema,
    substrateId: uuidSchema,
    readyForHarvest: z.boolean().optional(),
    harvestedAt_tick: finiteNumber
      .min(0, 'harvestedAt_tick cannot be negative.')
      .transform((value) => Math.trunc(value))
      .optional(),
    status: z.enum(['active', 'harvested']).optional(),
    moisture01: zeroToOneNumber.optional(),
    quality01: zeroToOneNumber.optional(),
  });

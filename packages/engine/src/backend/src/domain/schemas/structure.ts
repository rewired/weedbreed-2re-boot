import { z } from 'zod';

import { type Structure } from '../entities.ts';
import { domainEntitySchema, sluggedEntitySchema, spatialEntitySchema } from './base.ts';
import { structureDeviceSchema } from './zone.ts';
import { roomSchema } from './room.ts';

export const structureSchema: z.ZodType<Structure> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .merge(spatialEntitySchema)
  .extend({
    rooms: z.array(roomSchema).readonly(),
    devices: z.array(structureDeviceSchema).readonly(),
  });

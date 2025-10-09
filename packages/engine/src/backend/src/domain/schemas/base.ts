import { z } from 'zod';

import { ROOM_DEFAULT_HEIGHT_M } from '../../constants/simConstants.ts';
import { finiteNumber, nonEmptyString, unitIntervalNumber, uuidSchema } from './primitives.ts';

export const zeroToOneNumber = unitIntervalNumber;

export const domainEntitySchema = z.object({
  id: uuidSchema,
  name: nonEmptyString
});

export const sluggedEntitySchema = z.object({
  slug: nonEmptyString
});

export const spatialEntitySchema = z.object({
  floorArea_m2: finiteNumber.positive('floorArea_m2 must be positive.'),
  height_m: finiteNumber.positive('height_m must be positive.').default(ROOM_DEFAULT_HEIGHT_M)
});

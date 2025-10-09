import { z } from 'zod';

import { ROOM_PURPOSES, type Room } from '../entities.ts';
import { InventorySchema } from './InventorySchema.ts';
import { domainEntitySchema, sluggedEntitySchema, spatialEntitySchema } from './base.ts';
import { nonEmptyString } from './primitives.ts';
import { roomDeviceSchema, zoneSchema } from './zone.ts';

export const roomSchema: z.ZodType<Room> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .merge(spatialEntitySchema)
  .extend({
    purpose: z.enum([...ROOM_PURPOSES]),
    zones: z.array(zoneSchema).readonly(),
    devices: z.array(roomDeviceSchema).readonly(),
    class: nonEmptyString.optional(),
    tags: z.array(nonEmptyString).readonly().optional(),
    inventory: InventorySchema.optional(),
  })
  .superRefine((room, ctx) => {
    if (room.purpose !== 'growroom' && room.zones.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only growrooms may contain zones.',
        path: ['zones'],
      });
    }

    if (room.purpose === 'growroom' && room.zones.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Growrooms must define at least one zone.',
        path: ['zones'],
      });
    }
  })
  .transform((room) => {
    const tags = room.tags ?? [];
    const isStorageClass = room.class === 'room.storage';
    const hasStorageTag = tags.includes('storage');
    const isStoragePurpose = room.purpose === 'storageroom';
    const shouldHaveInventory = isStorageClass || hasStorageTag || isStoragePurpose;

    return {
      ...room,
      inventory: shouldHaveInventory ? room.inventory ?? { lots: [] } : room.inventory,
    } satisfies Room;
  });

/* eslint-disable wb-sim/no-ts-import-js-extension */

import { z } from 'zod';
import { uuidSchema } from '@wb/engine';

const intentMetadataSchema = z.object({
  intentId: uuidSchema,
  correlationId: z.string().trim().min(1).optional(),
});

const roomPurposeSchema = z.enum([
  'growroom',
  'breakroom',
  'laboratory',
  'storageroom',
  'salesroom',
  'workshop',
]);

const nameSchema = z.string().trim().min(1).max(80);
const areaSchema = z.number().finite().positive();

/** Validated intent for creating one room in an existing structure. */
export const roomCreateIntentSchema = intentMetadataSchema
  .extend({
    type: z.literal('room.create.v1'),
    structureId: uuidSchema,
    name: nameSchema,
    purpose: roomPurposeSchema,
    floorArea_m2: areaSchema,
    height_m: z.number().finite().positive().optional(),
  })
  .strict();

/** Validated intent for creating one configured grow zone. */
export const zoneCreateIntentSchema = intentMetadataSchema
  .extend({
    type: z.literal('zone.create.v1'),
    structureId: uuidSchema,
    roomId: uuidSchema,
    name: nameSchema.optional(),
    floorArea_m2: areaSchema,
    cultivationMethodId: uuidSchema,
    containerId: uuidSchema,
    substrateId: uuidSchema,
    irrigationMethodId: uuidSchema,
  })
  .strict();

/** Validated intent for purchasing and installing one device into a grow zone. */
export const devicePurchaseInstallIntentSchema = intentMetadataSchema
  .extend({
    type: z.literal('device.purchaseInstall.v1'),
    structureId: uuidSchema,
    roomId: uuidSchema,
    zoneId: uuidSchema,
    deviceBlueprintId: uuidSchema,
  })
  .strict();

/** Schema-normalised room creation intent. */
export type RoomCreateIntent = z.infer<typeof roomCreateIntentSchema>;
/** Schema-normalised zone creation intent. */
export type ZoneCreateIntent = z.infer<typeof zoneCreateIntentSchema>;
/** Schema-normalised device purchase/install intent. */
export type DevicePurchaseInstallIntent = z.infer<typeof devicePurchaseInstallIntentSchema>;

/** Union of facility intents accepted by the façade facility handler. */
export type FacilityIntent =
  | RoomCreateIntent
  | ZoneCreateIntent
  | DevicePurchaseInstallIntent;

/** Parses any supported facility intent without applying world mutations. */
export function parseFacilityIntent(input: unknown): FacilityIntent {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('Facility intent must be an object.');
  }

  switch ((input as { type?: unknown }).type) {
    case 'room.create.v1':
      return roomCreateIntentSchema.parse(input);
    case 'zone.create.v1':
      return zoneCreateIntentSchema.parse(input);
    case 'device.purchaseInstall.v1':
      return devicePurchaseInstallIntentSchema.parse(input);
    default:
      throw new Error('Unsupported facility intent type.');
  }
}

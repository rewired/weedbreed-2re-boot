/* eslint-disable wb-sim/no-ts-import-js-extension */
import { describe, expect, it } from 'vitest';

import {
  devicePurchaseInstallIntentSchema,
  roomCreateIntentSchema,
  zoneCreateIntentSchema,
} from '../../../src/intents/facility/index.js';

const INTENT_ID = '10000000-0000-4000-8000-000000000001';
const STRUCTURE_ID = '20000000-0000-4000-8000-000000000001';
const ROOM_ID = '30000000-0000-4000-8000-000000000001';
const ZONE_ID = '40000000-0000-4000-8000-000000000001';
const BLUEPRINT_ID = '50000000-0000-4000-8000-000000000001';

describe('facility intent schemas', () => {
  it('normalises valid room, zone and device payloads', () => {
    expect(roomCreateIntentSchema.parse({
      type: 'room.create.v1', intentId: INTENT_ID, structureId: STRUCTURE_ID,
      name: '  Propagation  ', purpose: 'growroom', floorArea_m2: 5,
    })).toMatchObject({ name: 'Propagation', floorArea_m2: 5 });

    expect(zoneCreateIntentSchema.parse({
      type: 'zone.create.v1', intentId: INTENT_ID, structureId: STRUCTURE_ID,
      roomId: ROOM_ID, floorArea_m2: 2.5, cultivationMethodId: BLUEPRINT_ID,
      containerId: BLUEPRINT_ID, substrateId: BLUEPRINT_ID, irrigationMethodId: BLUEPRINT_ID,
    })).toMatchObject({ roomId: ROOM_ID, floorArea_m2: 2.5 });

    expect(devicePurchaseInstallIntentSchema.parse({
      type: 'device.purchaseInstall.v1', intentId: INTENT_ID, structureId: STRUCTURE_ID,
      roomId: ROOM_ID, zoneId: ZONE_ID, deviceBlueprintId: BLUEPRINT_ID,
    })).toMatchObject({ zoneId: ZONE_ID, deviceBlueprintId: BLUEPRINT_ID });
  });

  it('rejects missing cultivation configuration and malformed placement ids', () => {
    expect(() => zoneCreateIntentSchema.parse({
      type: 'zone.create.v1', intentId: INTENT_ID, structureId: STRUCTURE_ID,
      roomId: ROOM_ID, floorArea_m2: 2.5,
    })).toThrow();
    expect(() => devicePurchaseInstallIntentSchema.parse({
      type: 'device.purchaseInstall.v1', intentId: INTENT_ID, structureId: STRUCTURE_ID,
      roomId: ROOM_ID, zoneId: 'not-a-uuid', deviceBlueprintId: BLUEPRINT_ID,
    })).toThrow();
  });
});

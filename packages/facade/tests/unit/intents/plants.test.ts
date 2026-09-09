/* eslint-disable wb-sim/no-ts-import-js-extension */
import { describe, expect, it } from 'vitest';

import { plantsHarvestIntentSchema, plantsSowIntentSchema } from '../../../src/intents/plants/index.js';

const UUIDS = {
  intentId: '10000000-0000-4000-8000-000000000001',
  structureId: '20000000-0000-4000-8000-000000000001',
  roomId: '30000000-0000-4000-8000-000000000001',
  zoneId: '40000000-0000-4000-8000-000000000001',
  strainId: '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7',
} as const;

describe('plants.sow.v1 schema', () => {
  it('accepts the complete scoped sow intent', () => {
    expect(plantsSowIntentSchema.parse({
      type: 'plants.sow.v1',
      ...UUIDS,
      count: 4,
    })).toMatchObject({ type: 'plants.sow.v1', count: 4, strainId: UUIDS.strainId });
  });

  it.each([0, -1, 1.5])('rejects invalid plant count %s', (count) => {
    expect(() => plantsSowIntentSchema.parse({
      type: 'plants.sow.v1',
      ...UUIDS,
      count,
    })).toThrow();
  });

  it('rejects malformed entity ids', () => {
    expect(() => plantsSowIntentSchema.parse({
      type: 'plants.sow.v1',
      ...UUIDS,
      zoneId: 'not-a-uuid',
      count: 1,
    })).toThrow();
  });
});

describe('plants.harvest.v1 schema', () => {
  it('accepts a scoped non-empty unique plant selection', () => {
    expect(plantsHarvestIntentSchema.parse({
      type: 'plants.harvest.v1',
      intentId: UUIDS.intentId,
      structureId: UUIDS.structureId,
      roomId: UUIDS.roomId,
      zoneId: UUIDS.zoneId,
      plantIds: [UUIDS.strainId],
    }).plantIds).toEqual([UUIDS.strainId]);
  });

  it.each([[], [UUIDS.strainId, UUIDS.strainId]])(
    'rejects an empty or duplicate plant selection',
    (plantIds) => {
      expect(() => plantsHarvestIntentSchema.parse({
        type: 'plants.harvest.v1',
        intentId: UUIDS.intentId,
        structureId: UUIDS.structureId,
        roomId: UUIDS.roomId,
        zoneId: UUIDS.zoneId,
        plantIds,
      })).toThrow();
    },
  );
});

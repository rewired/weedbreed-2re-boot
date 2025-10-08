import { describe, expect, it } from 'vitest';

import { HarvestLotSchema } from '@/backend/src/domain/schemas/HarvestLotSchema';
import type { HarvestLot } from '@/backend/src/domain/world';

const BASE_LOT: HarvestLot = {
  id: '00000000-0000-0000-0000-000000000a00' as HarvestLot['id'],
  structureId: '00000000-0000-0000-0000-000000000b00' as HarvestLot['structureId'],
  roomId: '00000000-0000-0000-0000-000000000c00' as HarvestLot['roomId'],
  source: {
    plantId: '00000000-0000-0000-0000-000000000d00' as HarvestLot['source']['plantId'],
    zoneId: '00000000-0000-0000-0000-000000000e00' as HarvestLot['source']['zoneId']
  },
  freshWeight_kg: 1.25,
  moisture01: 0.65,
  quality01: 0.82,
  createdAt_tick: 12
};

describe('HarvestLotSchema', () => {
  it('parses a valid harvest lot', () => {
    const result = HarvestLotSchema.safeParse(BASE_LOT);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toEqual(BASE_LOT);
  });

  it('coerces createdAt_tick to an integer', () => {
    const result = HarvestLotSchema.parse({
      ...BASE_LOT,
      createdAt_tick: 12.8
    });

    expect(result.createdAt_tick).toBe(12);
  });

  it('rejects non-finite weights', () => {
    const result = HarvestLotSchema.safeParse({
      ...BASE_LOT,
      freshWeight_kg: Number.POSITIVE_INFINITY
    });

    expect(result.success).toBe(false);
  });

  it('rejects moisture outside the unit interval', () => {
    const high = HarvestLotSchema.safeParse({
      ...BASE_LOT,
      moisture01: 1.5
    });
    const low = HarvestLotSchema.safeParse({
      ...BASE_LOT,
      moisture01: -0.1
    });

    expect(high.success).toBe(false);
    expect(low.success).toBe(false);
  });

  it('rejects quality outside the unit interval', () => {
    const high = HarvestLotSchema.safeParse({
      ...BASE_LOT,
      quality01: 1.2
    });
    const low = HarvestLotSchema.safeParse({
      ...BASE_LOT,
      quality01: -0.4
    });

    expect(high.success).toBe(false);
    expect(low.success).toBe(false);
  });

  it('rejects negative weights', () => {
    const result = HarvestLotSchema.safeParse({
      ...BASE_LOT,
      freshWeight_kg: -0.1
    });

    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { InventorySchema } from '@/backend/src/domain/schemas/InventorySchema.js';
import type { HarvestLot, Inventory } from '@/backend/src/domain/world.js';

const LOT: HarvestLot = {
  id: '00000000-0000-0000-0000-000000000f00' as HarvestLot['id'],
  structureId: '00000000-0000-0000-0000-000000000b00' as HarvestLot['structureId'],
  roomId: '00000000-0000-0000-0000-000000000c00' as HarvestLot['roomId'],
  source: {
    plantId: '00000000-0000-0000-0000-000000000d00' as HarvestLot['source']['plantId'],
    zoneId: '00000000-0000-0000-0000-000000000e00' as HarvestLot['source']['zoneId']
  },
  freshWeight_kg: 1.1,
  moisture01: 0.6,
  quality01: 0.9,
  createdAt_tick: 4
};

describe('InventorySchema', () => {
  it('accepts inventories containing valid harvest lots', () => {
    const inventory: Inventory = { lots: [LOT] };
    const result = InventorySchema.safeParse(inventory);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.lots).toHaveLength(1);
  });

  it('rejects inventories containing invalid lots', () => {
    const result = InventorySchema.safeParse({
      lots: [
        {
          ...LOT,
          moisture01: 2
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it('defaults to an empty lots array when omitted', () => {
    const result = InventorySchema.safeParse({});

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.lots).toHaveLength(0);
  });
});

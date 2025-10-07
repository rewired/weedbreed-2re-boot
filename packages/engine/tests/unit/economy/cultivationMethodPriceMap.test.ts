import { describe, expect, it } from 'vitest';

import { parseCultivationMethodPriceMap } from '@/backend/src/domain/pricing/cultivationMethodPriceMap.js';

describe('parseCultivationMethodPriceMap', () => {
  it('normalises setupCost to per-hour units', () => {
    const methodId = '85cc0916-0e8a-495e-af8f-50291abe6855';
    const map = parseCultivationMethodPriceMap({
      version: 'test',
      cultivationMethodPrices: {
        [methodId]: { setupCost: 4.5 }
      }
    });

    const entry = map.cultivationMethodPrices.get(methodId as typeof methodId);
    expect(entry).toEqual({ setupCost_per_h: 4.5 });
  });

  it('rejects negative setup costs', () => {
    expect(() =>
      parseCultivationMethodPriceMap({
        cultivationMethodPrices: {
          '659ba4d7-a5fc-482e-98d4-b614341883ac': { setupCost: -1 }
        }
      })
    ).toThrowError();
  });
});

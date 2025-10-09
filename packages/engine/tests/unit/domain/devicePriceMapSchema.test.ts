import { describe, expect, it } from 'vitest';

import { devicePriceMapSchema, parseDevicePriceMap } from '@/backend/src/domain/world';
import { unwrapErr } from '../../util/expectors';

import devicePriceMap from '../../../../../data/prices/devicePrices.json' with { type: 'json' };

describe('devicePriceMapSchema', () => {
  it('parses repository device price map', () => {
    expect(() => parseDevicePriceMap(devicePriceMap)).not.toThrow();
  });

  it('requires maintenanceServiceCost on each entry', () => {
    const invalid = {
      devicePrices: {
        '00000000-0000-4000-8000-000000000111': {
          capitalExpenditure: 100,
          baseMaintenanceCostPerHour: 0.002,
          costIncreasePer1000Hours: 0.001
        }
      }
    } satisfies unknown;

    const result = devicePriceMapSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected missing maintenanceServiceCost to fail validation');
    }

    const issuePaths = unwrapErr(result).issues.map((issue) => issue.path.join('.'));
    expect(issuePaths).toContain('devicePrices.00000000-0000-4000-8000-000000000111.maintenanceServiceCost');
  });

  it('exposes maintenance service cost for canonical devices', () => {
    const parsed = parseDevicePriceMap(devicePriceMap);

    expect(parsed.devicePrices['c701efa6-1e90-4f28-8934-ea9c584596e4'].maintenanceServiceCost).toBe(25);
  });
});

import { describe, expect, it } from 'vitest';

import {
  createHiringMarketView,
  type HiringMarketViewOptions,
} from '../../../src/readModels/hiringMarketView.ts';
import { uuidSchema, type Structure, type WorkforceState } from '@wb/engine';

function createStructure(id: string, name: string): Structure {
  return {
    id: uuidSchema.parse(id),
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    floorArea_m2: 100,
    height_m: 3,
    rooms: [],
    devices: [],
  } satisfies Structure;
}

describe('createHiringMarketView', () => {
  it('projects market pools and resolves structure metadata', () => {
    const structure = createStructure('00000000-0000-0000-0000-000000000010', 'HQ');
    const workforce: WorkforceState = {
      roles: [],
      employees: [],
      taskDefinitions: [],
      taskQueue: [],
      kpis: [],
      warnings: [],
      payroll: {
        dayIndex: 0,
        totals: { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 },
        byStructure: [],
      },
      market: {
        structures: [
          {
            structureId: structure.id,
            lastScanDay: 5,
            scanCounter: 2,
            pool: [
              {
                id: uuidSchema.parse('00000000-0000-0000-0000-00000000c0ad'),
                structureId: structure.id,
                roleSlug: 'gardener',
                skills3: {
                  main: { slug: 'gardening', value01: 0.4 },
                  secondary: [
                    { slug: 'maintenance', value01: 0.2 },
                    { slug: 'logistics', value01: 0.15 },
                  ],
                },
                traits: [{ id: 'trait_green_thumb', strength01: 0.5 }],
                expectedBaseRate_per_h: 8.5,
                validUntilScanCounter: 2,
                scanCounter: 2,
              },
            ],
          },
        ],
      },
    } satisfies WorkforceState;

    const options: HiringMarketViewOptions = {
      structures: [structure],
      simDay: 40,
      config: { scanCooldown_days: 30, poolSize: 16, scanCost_cc: 1000 },
    } satisfies HiringMarketViewOptions;

    const view = createHiringMarketView(workforce, options);

    expect(view.config).toEqual({
      scanCooldownDays: 30,
      poolSize: 16,
      scanCostCc: 1000,
    });

    expect(view.structures).toHaveLength(1);
    const [entry] = view.structures;
    expect(entry.structureName).toBe('HQ');
    expect(entry.scanCounter).toBe(2);
    expect(entry.cooldownRemainingDays).toBe(0);
    expect(entry.pool[0]?.skills).toEqual([
      { slug: 'gardening', value01: 0.4, valuePercent: 40, kind: 'main' },
      { slug: 'maintenance', value01: 0.2, valuePercent: 20, kind: 'secondary' },
      { slug: 'logistics', value01: 0.15, valuePercent: 15, kind: 'secondary' },
    ]);
    expect(entry.pool[0]?.traits[0]).toEqual({
      id: 'trait_green_thumb',
      strength01: 0.5,
      strengthPercent: 50,
    });
  });
});

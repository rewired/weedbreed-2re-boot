import { describe, expect, it } from 'vitest';

import {
  performMarketHire,
  performMarketScan,
  type PerformMarketHireOptions,
  type PerformMarketScanOptions,
} from '@/backend/src/services/workforce/market.js';
import { HOURS_PER_DAY } from '@/backend/src/constants/simConstants.js';
import type {
  EmployeeRole,
  WorkforceMarketState,
  WorkforceState,
} from '@/backend/src/domain/workforce/WorkforceState.js';
import type { WorkforceConfig } from '@/backend/src/config/workforce.js';

const baseRoles: EmployeeRole[] = [
  {
    id: '00000000-0000-0000-0000-00000000role' as EmployeeRole['id'],
    slug: 'gardener',
    name: 'Gardener',
    coreSkills: [
      { skillKey: 'gardening', minSkill01: 0.4 },
      { skillKey: 'cleanliness', minSkill01: 0.3 },
    ],
  },
];

const baseConfig: WorkforceConfig['market'] = {
  scanCooldown_days: 30,
  poolSize: 4,
  scanCost_cc: 1000,
};

function createMarketState(): WorkforceMarketState {
  return { structures: [] } satisfies WorkforceMarketState;
}

describe('workforce market services', () => {
  it('generates deterministic candidate pools for identical seeds and counters', () => {
    const options: PerformMarketScanOptions = {
      market: createMarketState(),
      config: baseConfig,
      worldSeed: 'seed-123',
      structureId: '00000000-0000-0000-0000-000000000100' as WorkforceState['employees'][number]['assignedStructureId'],
      currentSimHours: 0,
      roles: baseRoles,
    } satisfies PerformMarketScanOptions;

    const first = performMarketScan(options);
    const second = performMarketScan(options);

    expect(first.didScan).toBe(true);
    expect(second.didScan).toBe(true);
    expect(first.pool).toEqual(second.pool);
  });

  it('respects scan cooldowns before generating a new pool', () => {
    const structureId = '00000000-0000-0000-0000-000000000200' as WorkforceState['employees'][number]['assignedStructureId'];
    const initial = performMarketScan({
      market: createMarketState(),
      config: baseConfig,
      worldSeed: 'seed-200',
      structureId,
      currentSimHours: 0,
      roles: baseRoles,
    });

    expect(initial.didScan).toBe(true);
    const market = initial.market;

    const second = performMarketScan({
      market,
      config: baseConfig,
      worldSeed: 'seed-200',
      structureId,
      currentSimHours: 10 * HOURS_PER_DAY,
      roles: baseRoles,
    });

    expect(second.didScan).toBe(false);
    expect(second.market).toEqual(market);
  });

  it('removes hired candidates from the market pool', () => {
    const structureId = '00000000-0000-0000-0000-000000000300' as WorkforceState['employees'][number]['assignedStructureId'];
    const scan = performMarketScan({
      market: createMarketState(),
      config: baseConfig,
      worldSeed: 'seed-300',
      structureId,
      currentSimHours: 0,
      roles: baseRoles,
    });

    const candidate = scan.pool?.[0];
    expect(candidate).toBeDefined();

    const hireOptions: PerformMarketHireOptions = {
      market: scan.market,
      structureId,
      candidateId: candidate!.id,
    } satisfies PerformMarketHireOptions;

    const hire = performMarketHire(hireOptions);
    expect(hire.candidate?.id).toBe(candidate!.id);
    expect(hire.market.structures[0]?.pool).not.toContain(candidate);
  });
});

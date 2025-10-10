import { describe, expect, it } from 'vitest';
import { initializeFacade } from '../../src/index.ts';

describe('initializeFacade', () => {
  it('composes the engine bootstrap configuration using shared path aliases', () => {
    const world = {
      id: '30bd7f5e-1c8d-4f5f-9a5b-8b9e5821fd52',
      slug: 'integration-company',
      name: 'Integration Company',
      location: {
        lon: 9.9937,
        lat: 53.5511,
        cityName: 'Hamburg',
        countryName: 'Deutschland'
      },
      structures: []
    };

    const result = initializeFacade({ scenarioId: 'integration', verbose: true, world });

    expect(result.engineConfig).toEqual({
      scenarioId: 'integration',
      verbose: true,
      tariffs: {
        price_electricity: 0.35,
        price_water: 2
      },
      workforce: {
        market: {
          poolSize: 16,
          scanCooldown_days: 30,
          scanCost_cc: 1000
        }
      }
    });
    expect(result.companyWorld).toEqual(world);
  });
});

import { describe, expect, it } from 'vitest';
import { createEngineBootstrapConfig } from '../../src/index.js';

describe('createEngineBootstrapConfig', () => {
  it('creates a deterministic configuration when provided with a scenario id', () => {
    const config = createEngineBootstrapConfig('demo');

    expect(config).toEqual({
      scenarioId: 'demo',
      verbose: false,
      tariffs: {
        price_electricity: 0.35,
        price_water: 2
      },
      workforce: {
        market: {
          scanCooldown_days: 30,
          poolSize: 16,
          scanCost_cc: 1000,
        },
      },
    });
  });

  it('throws when the scenario id is missing', () => {
    expect(() => createEngineBootstrapConfig('')).toThrowError(
      /scenarioId must be a non-empty string/
    );
  });

  it('honours difficulty overrides when they exist', () => {
    const config = createEngineBootstrapConfig('hard');

    expect(config.tariffs).toEqual({
      price_electricity: 0.35 * 1.25,
      price_water: 2.5
    });
  });

  it('reuses cached tariffs for repeated difficulty lookups', () => {
    const first = createEngineBootstrapConfig('hard');
    const second = createEngineBootstrapConfig('hard');

    expect(second.tariffs).toBe(first.tariffs);
  });
});

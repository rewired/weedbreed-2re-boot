import { describe, expect, it } from 'vitest';

import { resolveEffectiveTariffs } from '@/backend/src/economy/tariffs';
import type { EngineRunContext } from '@/backend/src/engine/Engine';
import utilityPrices from '../../../../../data/prices/utilityPrices.json' with { type: 'json' };

describe('resolveEffectiveTariffs', () => {
  it('returns fallback tariffs when context does not provide overrides', () => {
    const ctx: EngineRunContext = {};

    expect(resolveEffectiveTariffs(ctx)).toEqual({
      price_electricity: ensureUtilityPrice(utilityPrices.price_electricity, 'price_electricity'),
      price_water: ensureUtilityPrice(utilityPrices.price_water, 'price_water')
    });
  });

  it('prefers tariffs embedded in the run context', () => {
    const ctx: EngineRunContext = {
      tariffs: Object.freeze({ price_electricity: 0.42, price_water: 1.8 })
    };

    expect(resolveEffectiveTariffs(ctx)).toEqual({
      price_electricity: 0.42,
      price_water: 1.8
    });
  });
});

function ensureUtilityPrice(
  value: unknown,
  field: 'price_electricity' | 'price_water'
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`utilityPrices.${field} must be a finite number.`);
  }

  if (value < 0) {
    throw new RangeError(`utilityPrices.${field} must be non-negative.`);
  }

  return value;
}

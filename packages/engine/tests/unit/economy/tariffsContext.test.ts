import { describe, expect, it } from 'vitest';

import { resolveEffectiveTariffs } from '@/backend/src/economy/tariffs.js';
import type { EngineRunContext } from '@/backend/src/engine/Engine.js';
import utilityPrices from '../../../../../data/prices/utilityPrices.json' with { type: 'json' };

describe('resolveEffectiveTariffs', () => {
  it('returns fallback tariffs when context does not provide overrides', () => {
    const ctx: EngineRunContext = {};

    expect(resolveEffectiveTariffs(ctx)).toEqual({
      price_electricity: Number(utilityPrices.price_electricity),
      price_water: Number(utilityPrices.price_water)
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

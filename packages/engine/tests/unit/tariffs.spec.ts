import { describe, expect, it } from 'vitest';

import {
  resolveTariffs,
  tariffDifficultySchema
} from '@/backend/src/util/tariffs.js';

describe('resolveTariffs', () => {
  it('returns base tariffs when no difficulty modifiers are provided', () => {
    const tariffs = resolveTariffs({
      price_electricity: 0.35,
      price_water: 2
    });

    expect(tariffs).toEqual({
      price_electricity: 0.35,
      price_water: 2
    });
    expect(Object.isFrozen(tariffs)).toBe(true);
  });

  it('applies multiplicative factors when overrides are not specified', () => {
    const tariffs = resolveTariffs({
      price_electricity: 0.35,
      price_water: 2,
      difficulty: {
        energyPriceFactor: 1.5,
        waterPriceFactor: 2
      }
    });

    expect(tariffs.price_electricity).toBeCloseTo(0.525, 10);
    expect(tariffs.price_water).toBeCloseTo(4, 10);
  });

  it('prefers overrides over base prices when provided without factors', () => {
    const tariffs = resolveTariffs({
      price_electricity: 0.35,
      price_water: 2,
      difficulty: {
        energyPriceOverride: 0.42,
        waterPriceOverride: 1.8
      }
    });

    expect(tariffs).toEqual({
      price_electricity: 0.42,
      price_water: 1.8
    });
  });

  it('ignores factors when overrides are also supplied', () => {
    const modifiers = tariffDifficultySchema.parse({
      energyPriceFactor: 1.5,
      energyPriceOverride: 0.4,
      waterPriceFactor: 2.2,
      waterPriceOverride: 1.9
    });

    expect(modifiers.energyPriceFactor).toBeUndefined();
    expect(modifiers.waterPriceFactor).toBeUndefined();

    const tariffs = resolveTariffs({
      price_electricity: 0.35,
      price_water: 2,
      difficulty: modifiers
    });

    expect(tariffs).toEqual({
      price_electricity: 0.4,
      price_water: 1.9
    });
  });
});

import { z } from 'zod';

/**
 * Describes difficulty-driven tariff modifiers extracted from scenario configuration.
 */
export interface TariffDifficultyModifiers {
  /** Optional scalar that adjusts the base electricity price. */
  readonly energyPriceFactor?: number;
  /** Absolute override applied to the electricity tariff when provided. */
  readonly energyPriceOverride?: number;
  /** Optional scalar that adjusts the base water price. */
  readonly waterPriceFactor?: number;
  /** Absolute override applied to the water tariff when provided. */
  readonly waterPriceOverride?: number;
}

/**
 * Canonical tariff configuration consumed by the resolver.
 */
export interface TariffConfig {
  /** Baseline electricity price sourced from the utility price map. */
  readonly price_electricity: number;
  /** Baseline water price sourced from the utility price map. */
  readonly price_water: number;
  /** Optional difficulty modifiers that may override or scale the base prices. */
  readonly difficulty?: TariffDifficultyModifiers;
}

/**
 * Immutable effective tariffs emitted by the resolver.
 */
export interface ResolvedTariffs {
  /** Effective electricity price expressed per kWh. */
  readonly price_electricity: number;
  /** Effective water price expressed per m³. */
  readonly price_water: number;
}

const nonNegativeNumberSchema = z
  .number()
  .finite('Tariff values must be finite numbers.')
  .min(0, 'Tariff values must be non-negative.');

const positiveNumberSchema = z
  .number()
  .finite('Tariff factors must be finite numbers.')
  .positive('Tariff factors must be positive.');

type MutableTariffDifficulty = {
  energyPriceFactor?: number;
  energyPriceOverride?: number;
  waterPriceFactor?: number;
  waterPriceOverride?: number;
};

/**
 * Zod schema that sanitises tariff difficulty modifiers so overrides take precedence
 * over multiplicative factors.
 */
export const tariffDifficultySchema: z.ZodType<TariffDifficultyModifiers> = z
  .object({
    energyPriceFactor: positiveNumberSchema.optional(),
    energyPriceOverride: nonNegativeNumberSchema.optional(),
    waterPriceFactor: positiveNumberSchema.optional(),
    waterPriceOverride: nonNegativeNumberSchema.optional()
  })
  .transform((modifiers) => {
    const sanitised: MutableTariffDifficulty = { ...modifiers };

    if (sanitised.energyPriceOverride !== undefined) {
      delete sanitised.energyPriceFactor;
    }

    if (sanitised.waterPriceOverride !== undefined) {
      delete sanitised.waterPriceFactor;
    }

    return sanitised as TariffDifficultyModifiers;
  });

/**
 * Zod schema validating the resolver input configuration before computing tariffs.
 */
export const tariffConfigSchema: z.ZodType<TariffConfig> = z.object({
  price_electricity: nonNegativeNumberSchema,
  price_water: nonNegativeNumberSchema,
  difficulty: tariffDifficultySchema.optional()
});

/**
 * Resolves effective electricity and water tariffs given baseline utility pricing and
 * optional difficulty modifiers. Overrides win over multiplicative factors and the
 * resolved object is frozen to guarantee deterministic identity semantics.
 *
 * @param input - Utility pricing configuration sourced from scenario bootstrap data.
 * @returns Immutable tariffs ready to be injected into the runtime state.
 */
export function resolveTariffs(input: TariffConfig): ResolvedTariffs {
  const config = tariffConfigSchema.parse(input);
  const difficulty = config.difficulty;

  const resolvedElectricity =
    difficulty?.energyPriceOverride ??
    config.price_electricity * (difficulty?.energyPriceFactor ?? 1);

  const resolvedWater =
    difficulty?.waterPriceOverride ??
    config.price_water * (difficulty?.waterPriceFactor ?? 1);

  return Object.freeze({
    price_electricity: resolvedElectricity,
    price_water: resolvedWater
  });
}

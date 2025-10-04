import difficultyConfig from '../../../data/configs/difficulty.json' with { type: 'json' };
import utilityPrices from '../../../data/prices/utilityPrices.json' with { type: 'json' };

import {
  resolveTariffs,
  tariffDifficultySchema,
  type ResolvedTariffs,
  type TariffConfig,
  type TariffDifficultyModifiers
} from './backend/src/util/tariffs.js';

const DEFAULT_DIFFICULTY_ID = 'normal';

interface DifficultyEconomicsConfig extends Record<string, unknown> {
  readonly energyPriceFactor?: number;
  readonly energyPriceOverride?: number;
  readonly waterPriceFactor?: number;
  readonly waterPriceOverride?: number;
}

interface DifficultyConfigEntry extends Record<string, unknown> {
  readonly modifiers?: {
    readonly economics?: DifficultyEconomicsConfig;
  };
}

const difficultyMap = difficultyConfig as Record<string, DifficultyConfigEntry>;

const baseTariffConfig: Pick<TariffConfig, 'price_electricity' | 'price_water'> = {
  price_electricity: Number(utilityPrices.price_electricity),
  price_water: Number(utilityPrices.price_water)
};

const tariffCache = new Map<string, ResolvedTariffs>();

function hasDifficultyModifiers(
  modifiers: TariffDifficultyModifiers | undefined
): modifiers is TariffDifficultyModifiers {
  if (!modifiers) {
    return false;
  }

  return Object.values(modifiers).some((value) => value !== undefined);
}

function selectDifficultyId(scenarioId: string): string {
  return difficultyMap[scenarioId] ? scenarioId : DEFAULT_DIFFICULTY_ID;
}

function extractDifficultyTariffs(
  entry: DifficultyConfigEntry | undefined
): TariffDifficultyModifiers | undefined {
  const economics = entry?.modifiers?.economics;

  if (!economics) {
    return undefined;
  }

  const parsed = tariffDifficultySchema.parse({
    energyPriceFactor: economics.energyPriceFactor,
    energyPriceOverride: economics.energyPriceOverride,
    waterPriceFactor: economics.waterPriceFactor,
    waterPriceOverride: economics.waterPriceOverride
  });

  return hasDifficultyModifiers(parsed) ? parsed : undefined;
}

function getScenarioTariffs(scenarioId: string): ResolvedTariffs {
  const difficultyId = selectDifficultyId(scenarioId);
  const cacheKey = `difficulty:${difficultyId}`;
  const cached = tariffCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const difficultyEntry = difficultyMap[difficultyId];
  const difficultyModifiers = extractDifficultyTariffs(difficultyEntry);

  const resolved = resolveTariffs({
    ...baseTariffConfig,
    difficulty: difficultyModifiers
  });

  tariffCache.set(cacheKey, resolved);

  return resolved;
}

/**
 * Describes the configuration required to bootstrap the Weed Breed simulation engine.
 */
export interface EngineBootstrapConfig {
  /**
   * Unique identifier of the simulation scenario that should be loaded.
   */
  readonly scenarioId: string;

  /**
   * Determines whether the engine should emit verbose lifecycle diagnostics.
   */
  readonly verbose: boolean;

  /**
   * Effective electricity and water tariffs resolved at bootstrap time.
   */
  readonly tariffs: ResolvedTariffs;
}

/**
 * Creates a default engine bootstrap configuration while ensuring deterministic behaviour.
 *
 * @param scenarioId - Unique identifier of the simulation scenario.
 * @param verbose - Flag that toggles verbose logging for diagnostics.
 * @returns A fully qualified {@link EngineBootstrapConfig} instance.
 */
export function createEngineBootstrapConfig(
  scenarioId: string,
  verbose = false
): EngineBootstrapConfig {
  if (!scenarioId) {
    throw new Error('scenarioId must be a non-empty string');
  }

  const tariffs = getScenarioTariffs(scenarioId);

  return {
    scenarioId,
    verbose,
    tariffs
  } satisfies EngineBootstrapConfig;
}

export * from './backend/src/constants/simConstants.js';
export * from './backend/src/domain/world.js';
export * from './backend/src/util/rng.js';
export { resolveTariffs } from './backend/src/util/tariffs.js';
export type { ResolvedTariffs } from './backend/src/util/tariffs.js';

import { 
  HOURS_PER_DAY,
  DEFAULT_DRY_MATTER_FRACTION,
  DEFAULT_HARVEST_INDEX,
  SEEDLING_PHASE_MULTIPLIER,
  VEGETATIVE_PHASE_MULTIPLIER,
  FLOWERING_PHASE_MULTIPLIER,
  HARVEST_READY_PHASE_MULTIPLIER,
  Q10_TEMPERATURE_DIVISOR,
  TEMPERATURE_FACTOR_CLAMP_MAX,
  EXTREME_TEMPERATURE_FACTOR,
  GRAMS_PER_KILOGRAM,
  NOISE_FACTOR,
  HEALTH_DECAY_RATE_PER_HOUR,
  HEALTH_VARIATION_MIN,
  HEALTH_VARIATION_RANGE,
  HEALTH_RECOVERY_STRESS_THRESHOLD,
  HEALTH_RECOVERY_RATE_PER_HOUR
} from '../constants/simConstants.ts';
import type { PlantLifecycleStage } from '../domain/entities.ts';
import type {
  GrowthModel,
  HarvestIndexConfig,
  DryMatterFractionConfig,
  StrainBlueprint
} from '../domain/blueprints/strainBlueprint.ts';
import type { RandomNumberGenerator } from './rng.ts';
import { clamp, clamp01 } from './math.ts';

/* eslint-disable @typescript-eslint/no-magic-numbers -- Growth noise uses centered uniform distribution */
const UNIFORM_NOISE_CENTER = 0.5 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

const DEFAULT_DRY_MATTER_FRACTION_VALUE = DEFAULT_DRY_MATTER_FRACTION;
const DEFAULT_HARVEST_INDEX_VALUE = DEFAULT_HARVEST_INDEX;

function resolveDryMatterFraction(
  config: DryMatterFractionConfig,
  stage: PlantLifecycleStage
): number {
  if (typeof config === 'number') {
    return clamp01(config);
  }

  const flowering = config.flowering ?? config.vegetation ?? DEFAULT_DRY_MATTER_FRACTION_VALUE;

  if (stage === 'vegetative' || stage === 'seedling') {
    return clamp01(config.vegetation ?? flowering);
  }

  return clamp01(config.flowering ?? flowering);
}

function resolveHarvestIndex(config: HarvestIndexConfig, stage: PlantLifecycleStage): number {
  if (typeof config === 'number') {
    return clamp01(config);
  }

  const flowering = config.targetFlowering ?? DEFAULT_HARVEST_INDEX_VALUE;

  if (stage === 'flowering' || stage === 'harvest-ready') {
    return clamp01(flowering);
  }

  return clamp01(flowering);
}

function getPhaseMultiplier(lifecycleStage: PlantLifecycleStage, growthModel: GrowthModel): number {
  const defaults: Record<PlantLifecycleStage, number> = {
    seedling: SEEDLING_PHASE_MULTIPLIER,
    vegetative: VEGETATIVE_PHASE_MULTIPLIER,
    flowering: FLOWERING_PHASE_MULTIPLIER,
    'harvest-ready': HARVEST_READY_PHASE_MULTIPLIER
  };
  const configured = growthModel.phaseCapMultiplier;

  if (!configured) {
    return defaults[lifecycleStage];
  }

  if (lifecycleStage === 'seedling') {
    return configured.seedling ?? defaults.seedling;
  }

  if (lifecycleStage === 'vegetative') {
    return configured.vegetation;
  }

  return configured.flowering;
}

/**
 * Resolves the dry matter fraction for the specified lifecycle stage.
 */
export function getDryMatterFraction(
  growthModel: GrowthModel,
  stage: PlantLifecycleStage
): number {
  return resolveDryMatterFraction(growthModel.dryMatterFraction, stage);
}

/**
 * Resolves the harvest index for the specified lifecycle stage.
 */
export function getHarvestIndex(growthModel: GrowthModel, stage: PlantLifecycleStage): number {
  return resolveHarvestIndex(growthModel.harvestIndex, stage);
}

/**
 * Computes a Q10-based temperature response multiplier.
 */
export function calculateTemperatureGrowthFactor(tempC: number, growthModel: GrowthModel): number {
  const { Q10, T_ref_C, min_C, max_C } = growthModel.temperature;
  let factor = Math.pow(Q10, (tempC - T_ref_C) / Q10_TEMPERATURE_DIVISOR);

  if (!Number.isFinite(factor)) {
    factor = 0;
  }

  if (tempC < min_C || tempC > max_C) {
    factor *= EXTREME_TEMPERATURE_FACTOR;
  }

  return clamp(factor, 0, TEMPERATURE_FACTOR_CLAMP_MAX);
}

/**
 * Computes net biomass increment in grams for the current tick.
 */
export function calculateBiomassIncrement(
  dli_mol_m2d_inc: number,
  tempC: number,
  stress01: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage,
  currentBiomass_g: number,
  tickHours: number,
  rng: RandomNumberGenerator
): number {
  const growthModel = strain.growthModel;
  const tempFactor = calculateTemperatureGrowthFactor(tempC, growthModel);
  const stressReduction = clamp01(1 - stress01);
  const phaseMultiplier = getPhaseMultiplier(lifecycleStage, growthModel);
  const dryMatterFraction = getDryMatterFraction(growthModel, lifecycleStage);
  // Blueprint stores baseLightUseEfficiency in kilograms of dry matter per mol of PAR.
  // Convert to grams before applying the daily light integral increment which is already tick-scoped.
  const lightUseEfficiency_g_per_mol = growthModel.baseLightUseEfficiency * GRAMS_PER_KILOGRAM;
  const tickFractionOfDay = tickHours / HOURS_PER_DAY;
  const baseGrowth =
    dli_mol_m2d_inc *
    lightUseEfficiency_g_per_mol *
    tempFactor *
    stressReduction *
    phaseMultiplier *
    dryMatterFraction;
  const maintenanceCost = currentBiomass_g * growthModel.maintenanceFracPerDay * tickFractionOfDay;
  let netGrowth = baseGrowth - maintenanceCost;

  if (strain.noise?.enabled) {
    const noise = (rng() - UNIFORM_NOISE_CENTER) * NOISE_FACTOR * strain.noise.pct;
    netGrowth *= 1 + noise;
  }

  if (!Number.isFinite(netGrowth)) {
    netGrowth = 0;
  }

  if (netGrowth < 0) {
    netGrowth = 0;
  }

  const maxBiomass_g = growthModel.maxBiomassDry * GRAMS_PER_KILOGRAM;

  if (currentBiomass_g + netGrowth > maxBiomass_g) {
    netGrowth = Math.max(0, maxBiomass_g - currentBiomass_g);
  }

  return netGrowth;
}

export function calculateHealthDecay(
  stress01: number,
  currentHealth01: number,
  tickHours: number,
  rng: RandomNumberGenerator
): number {
  void currentHealth01;

  const decayRatePerHour = clamp01(stress01) * HEALTH_DECAY_RATE_PER_HOUR;
  let loss = decayRatePerHour * tickHours;
  const variation = HEALTH_VARIATION_MIN + rng() * HEALTH_VARIATION_RANGE;
  loss *= variation;
  return loss;
}

export function calculateHealthRecovery(
  stress01: number,
  currentHealth01: number,
  tickHours: number
): number {
  if (stress01 >= HEALTH_RECOVERY_STRESS_THRESHOLD || currentHealth01 >= 1) {
    return 0;
  }

  const recoveryRatePerHour = (1 - clamp01(stress01)) * HEALTH_RECOVERY_RATE_PER_HOUR;
  return recoveryRatePerHour * tickHours * (1 - clamp01(currentHealth01));
}

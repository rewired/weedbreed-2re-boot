import { HOURS_PER_DAY } from '../constants/simConstants.js';
import type { PlantLifecycleStage } from '../domain/entities.js';
import type {
  GrowthModel,
  HarvestIndexConfig,
  DryMatterFractionConfig,
  StrainBlueprint
} from '../domain/blueprints/strainBlueprint.js';
import type { RandomNumberGenerator } from './rng.js';
import { clamp, clamp01 } from './math.js';

const DEFAULT_DRY_MATTER_FRACTION = 0.2;
const DEFAULT_HARVEST_INDEX = 0.7;

function resolveDryMatterFraction(
  config: DryMatterFractionConfig,
  stage: PlantLifecycleStage
): number {
  if (typeof config === 'number') {
    return clamp01(config);
  }

  const flowering = config.flowering ?? config.vegetation ?? DEFAULT_DRY_MATTER_FRACTION;

  if (stage === 'vegetative' || stage === 'seedling') {
    return clamp01(config.vegetation ?? flowering);
  }

  return clamp01(config.flowering ?? flowering);
}

function resolveHarvestIndex(config: HarvestIndexConfig, stage: PlantLifecycleStage): number {
  if (typeof config === 'number') {
    return clamp01(config);
  }

  const flowering = config.targetFlowering ?? DEFAULT_HARVEST_INDEX;

  if (stage === 'flowering' || stage === 'harvest-ready') {
    return clamp01(flowering);
  }

  return clamp01(flowering);
}

function getPhaseMultiplier(lifecycleStage: PlantLifecycleStage, growthModel: GrowthModel): number {
  const defaults: Record<PlantLifecycleStage, number> = {
    seedling: 0.35,
    vegetative: 1,
    flowering: 0.75,
    'harvest-ready': 0.1
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
  let factor = Math.pow(Q10, (tempC - T_ref_C) / 10);

  if (!Number.isFinite(factor)) {
    factor = 0;
  }

  if (tempC < min_C || tempC > max_C) {
    factor *= 0.1;
  }

  return clamp(factor, 0, 2);
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
  const lightUseEfficiency_g_per_mol = growthModel.baseLightUseEfficiency * 1_000;
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
    const noise = (rng() - 0.5) * 2 * strain.noise.pct;
    netGrowth *= 1 + noise;
  }

  if (!Number.isFinite(netGrowth)) {
    netGrowth = 0;
  }

  if (netGrowth < 0) {
    netGrowth = 0;
  }

  const maxBiomass_g = growthModel.maxBiomassDry * 1_000;

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

  const decayRatePerHour = clamp01(stress01) * 0.01;
  let loss = decayRatePerHour * tickHours;
  const variation = 0.9 + rng() * 0.2;
  loss *= variation;
  return loss;
}

export function calculateHealthRecovery(
  stress01: number,
  currentHealth01: number,
  tickHours: number
): number {
  if (stress01 >= 0.2 || currentHealth01 >= 1) {
    return 0;
  }

  const recoveryRatePerHour = (1 - clamp01(stress01)) * 0.005;
  return recoveryRatePerHour * tickHours * (1 - clamp01(currentHealth01));
}

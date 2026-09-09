import type { PlantLifecycleStage } from '../domain/world.ts';
import type { Uuid } from '../domain/schemas/primitives.ts';
import type { StrainBlueprint } from '../domain/blueprints/strainBlueprint.ts';
import { 
  HARVEST_QUALITY_HEALTH_WEIGHT,
  HARVEST_QUALITY_STRESS_WEIGHT,
  HARVEST_QUALITY_GENETIC_WEIGHT,
  HARVEST_QUALITY_HIGH_THRESHOLD,
  HARVEST_QUALITY_HIGH_BONUS_FACTOR,
  SECONDS_PER_HOUR,
  MILLISECONDS_PER_SECOND
} from '../constants/simConstants.ts';
import { clamp01 } from './math.ts';
import { getDryMatterFraction, getHarvestIndex } from './growth.ts';
import { deterministicUuid } from './uuid.ts';

const W_HEALTH = HARVEST_QUALITY_HEALTH_WEIGHT;
const W_STRESS = HARVEST_QUALITY_STRESS_WEIGHT;
const W_GENET = HARVEST_QUALITY_GENETIC_WEIGHT;

interface CreatedHarvestLot {
  readonly id: Uuid;
  readonly name: string;
  readonly strainId: Uuid;
  readonly strainSlug: string;
  readonly quality01: number;
  readonly dryWeight_g: number;
  readonly harvestedAtSimHours: number;
  readonly sourceZoneId: Uuid;
}

export function calculateHarvestQuality(
  finalHealth01: number,
  avgStress01: number,
  geneticQuality01: number,
  methodMod = 1
): number {
  let quality01 =
    W_HEALTH * clamp01(finalHealth01) +
    W_GENET * clamp01(geneticQuality01) +
    W_STRESS * (1 - clamp01(avgStress01));

  quality01 = clamp01(quality01 * methodMod);

  if (quality01 > HARVEST_QUALITY_HIGH_THRESHOLD) {
    quality01 = HARVEST_QUALITY_HIGH_THRESHOLD + HARVEST_QUALITY_HIGH_BONUS_FACTOR * (quality01 - HARVEST_QUALITY_HIGH_THRESHOLD);
  }

  return clamp01(quality01);
}

export function calculateHarvestYield(
  biomass_g: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const harvestIndex = getHarvestIndex(strain.growthModel, lifecycleStage);
  const dryMatterFraction = getDryMatterFraction(strain.growthModel, lifecycleStage);

  return biomass_g * harvestIndex * dryMatterFraction;
}

export function createHarvestLot(
  strainId: Uuid,
  strainSlug: string,
  quality01: number,
  dryWeight_g: number,
  harvestedAtSimHours: number,
  sourceZoneId: Uuid
): CreatedHarvestLot {
  const id = deterministicUuid(
    strainId,
    `legacy-harvest:${strainSlug}:${harvestedAtSimHours}:${sourceZoneId}:${dryWeight_g}:${quality01}`,
  );
  const harvestDateIso = new Date(harvestedAtSimHours * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND)
    .toISOString()
    .split('T')[0];

  return {
    id,
    name: `Harvest Lot ${strainSlug} ${harvestDateIso}`,
    strainId,
    strainSlug,
    quality01: clamp01(quality01),
    dryWeight_g,
    harvestedAtSimHours,
    sourceZoneId
  };
}

import crypto from 'node:crypto';

import type { HarvestLot, PlantLifecycleStage } from '../domain/world.ts';
import type { Uuid } from '../domain/schemas/primitives.ts';
import type { StrainBlueprint } from '../domain/blueprints/strainBlueprint.ts';
import { clamp01 } from './math.ts';
import { getDryMatterFraction, getHarvestIndex } from './growth.ts';

const W_HEALTH = 0.55;
const W_STRESS = 0.25;
const W_GENET = 0.2;

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

  if (quality01 > 0.95) {
    quality01 = 0.95 + 0.5 * (quality01 - 0.95);
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
): HarvestLot {
  const id = crypto.randomUUID() as Uuid;
  const harvestDateIso = new Date(harvestedAtSimHours * 3600 * 1000)
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

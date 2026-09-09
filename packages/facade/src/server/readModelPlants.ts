/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  assessZoneSowReadiness,
  resolveStrain,
  type SimulationWorld,
  type Uuid,
  type Zone,
} from '@wb/engine';
import { HOURS_PER_DAY } from '@engine/constants/time.js';
import type {
  HarvestEligibilityReadModel,
  PlantReadModel,
  SowEligibilityReadModel,
  StrainChoiceReadModel,
  ZoneReadiness,
} from '../readModels/snapshot.js';
import { roundTo, STRAIN_PRICE_MAP } from './readModelShared.js';

const DEMO_STRAIN_IDS = [
  '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7',
  '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2',
] as const;

function totalMaturityHours(world: SimulationWorld, strainId: Uuid): number {
  const resolved = resolveStrain(world, strainId);
  if (!resolved) return 0;
  const durations = resolved.blueprint.phaseDurations;
  return (
    durations.seedlingDays + durations.vegDays + durations.flowerDays + durations.ripeningDays
  ) * HOURS_PER_DAY;
}

/** Maps canonical engine plants without duplicating physiology calculations. */
export function mapPlants(world: SimulationWorld, zone: Zone): readonly PlantReadModel[] {
  return zone.plants.map((plant) => {
    const strain = resolveStrain(world, plant.strainId);
    const maturityHours = totalMaturityHours(world, plant.strainId);
    const remainingHours = Math.max(0, maturityHours - plant.ageHours);

    return {
      id: plant.id,
      strainId: plant.strainId,
      strainName: strain?.blueprint.name ?? 'Unknown strain',
      phase: plant.lifecycleStage,
      status: plant.status ?? 'active',
      harvestReady: plant.status !== 'harvested'
        && plant.lifecycleStage === 'harvest-ready'
        && plant.readyForHarvest === true,
      ageHours: plant.ageHours,
      health01: plant.health01,
      biomassKg: roundTo(plant.biomass_g / 1000, 6),
      estimatedMaturityAtSimHour: world.simTimeHours + remainingHours,
      estimatedRemainingHours: remainingHours,
    } satisfies PlantReadModel;
  });
}

/** Projects the exact active plants accepted by a manual harvest intent. */
export function mapHarvestEligibility(zone: Zone): HarvestEligibilityReadModel {
  const plantIds = zone.plants
    .filter((plant) => plant.status !== 'harvested'
      && plant.lifecycleStage === 'harvest-ready'
      && plant.readyForHarvest === true)
    .map((plant) => plant.id)
    .sort();

  return {
    eligible: plantIds.length > 0,
    plantIds,
    reasons: plantIds.length > 0 ? [] : ['no-harvest-ready-plants'],
  };
}

/** Lists the two demo parents with authoritative compatibility and seed prices. */
export function mapStrainChoices(world: SimulationWorld, zone: Zone): readonly StrainChoiceReadModel[] {
  const selectedCustomIds = (world.breeding?.runs ?? []).flatMap((run) =>
    run.status === 'selected' && run.selectedCandidateId ? [run.selectedCandidateId] : []
  );
  const strainIds = [...new Set([...DEMO_STRAIN_IDS, ...selectedCustomIds])];
  return strainIds.flatMap((strainId) => {
    const resolved = resolveStrain(world, strainId as Uuid);
    if (!resolved) return [];
    const affinities = resolved.blueprint.methodAffinity as Record<string, unknown> | undefined;
    const affinity = affinities?.[zone.cultivationMethodId];
    const eligible = affinities === undefined || (typeof affinity === 'number' && affinity > 0);

    return [{
      strainId,
      slug: resolved.blueprint.slug,
      name: resolved.blueprint.name,
      seedPriceCc: resolved.source === 'custom' ? 0 : roundTo(STRAIN_PRICE_MAP[strainId]?.seedPrice ?? 0, 2),
      eligible,
      ineligibilityReason: eligible ? null : 'incompatible-cultivation-method',
    } satisfies StrainChoiceReadModel];
  });
}

/** Projects empty-zone eligibility and remaining authoritative cultivation capacity. */
export function mapSowEligibility(
  zone: Zone,
  readiness: ZoneReadiness,
): SowEligibilityReadModel {
  const engineReadiness = assessZoneSowReadiness(zone);
  const activePlantCount = zone.plants.filter((plant) => plant.status !== 'harvested').length;
  const capacityRemaining = Math.max(0, engineReadiness.maxPlants - activePlantCount);
  const reasons: SowEligibilityReadModel['reasons'][number][] = [];
  if (activePlantCount > 0) reasons.push('zone-not-empty');
  if (capacityRemaining === 0) reasons.push('capacity-exhausted');
  if (!engineReadiness.ready || readiness.status !== 'ready') reasons.push('missing-prerequisites');

  return { eligible: reasons.length === 0, reasons, capacityRemaining };
}

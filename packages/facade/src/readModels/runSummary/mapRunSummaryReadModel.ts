/* eslint-disable wb-sim/no-ts-import-js-extension */

import { resolveStrain, type BreedingRun, type SimulationWorld, type StrainBlueprint, type Uuid } from '@wb/engine';
import type {
  RunSummaryActualMetrics,
  RunSummaryBlueprintPotential,
  RunSummaryReadModel,
  RunSummaryRole,
} from './types.js';

const round = (value: number): number => Number(value.toFixed(6));
const STRAIN_IN_SEED_DESCRIPTION = /(?:^|;)strain=([0-9a-f-]{36})(?:;|$)/i;

function selectedRun(world: SimulationWorld): BreedingRun | null {
  return [...(world.breeding?.runs ?? [])]
    .filter((run) => run.status === 'selected' && run.selectedCandidateId)
    .sort((a, b) => b.createdAtSimTimeHours - a.createdAtSimTimeHours || b.id.localeCompare(a.id))[0] ?? null;
}

function blueprintPotential(blueprint: StrainBlueprint): RunSummaryBlueprintPotential {
  const yieldModel = blueprint.yieldModel as { readonly baseGmPerPlant?: unknown } | undefined;
  const declaredYield = yieldModel?.baseGmPerPlant;
  return {
    yieldPotentialGPerPlant: round(typeof declaredYield === 'number'
      ? declaredYield
      : blueprint.growthModel.maxBiomassDry * 1000),
    cycleDurationDays: Object.values(blueprint.phaseDurations).reduce((sum, days) => sum + days, 0),
    resilience01: round(blueprint.generalResilience),
  };
}

function strainForSeedDebit(description: string): string | null {
  return STRAIN_IN_SEED_DESCRIPTION.exec(description)?.[1] ?? null;
}

function actualMetrics(world: SimulationWorld, strainId: Uuid): RunSummaryActualMetrics | null {
  const plants = world.company.structures.flatMap((structure) => structure.rooms)
    .flatMap((room) => room.zones)
    .flatMap((zone) => zone.plants)
    .filter((plant) => plant.strainId === strainId && plant.status === 'harvested');
  if (plants.length === 0) return null;
  const ledger = world.economy?.ledger ?? [];
  const saleCredits = ledger.filter((entry) =>
    entry.category === 'sale' && entry.direction === 'credit' && entry.metadata?.strainId === strainId
  ).reduce((sum, entry) => sum + entry.amountCc, 0);
  const seedDebits = ledger.filter((entry) =>
    entry.category === 'seed' && entry.direction === 'debit'
      && (entry.metadata?.strainId === strainId || (
        entry.metadata?.strainId === undefined && strainForSeedDebit(entry.description) === strainId
      ))
  ).reduce((sum, entry) => sum + entry.amountCc, 0);
  const remainingInventory = world.company.structures.flatMap((structure) => structure.rooms)
    .flatMap((room) => room.inventory?.lots ?? [])
    .some((lot) => lot.strainId === strainId && lot.freshWeight_kg > 0);
  return {
    harvestedPlantCount: plants.length,
    harvestedFreshWeightG: round(plants.reduce((sum, plant) => sum + plant.biomass_g, 0)),
    averageQuality01: round(plants.reduce((sum, plant) => sum + (plant.quality01 ?? plant.health01), 0) / plants.length),
    averageCycleDurationHours: round(plants.reduce((sum, plant) => sum + plant.ageHours, 0) / plants.length),
    realizedDirectMarginCc: round(saleCredits - seedDebits),
    saleStatus: saleCredits <= 0 ? 'not-sold' : remainingInventory ? 'partially-sold' : 'sold',
  };
}

function entry(world: SimulationWorld, role: RunSummaryRole, strainId: Uuid) {
  const blueprint = resolveStrain(world, strainId)?.blueprint;
  if (!blueprint) throw new Error(`Run summary strain ${strainId} cannot be resolved.`);
  return {
    role,
    strainId,
    name: blueprint.name,
    actual: actualMetrics(world, strainId),
    blueprintPotential: blueprintPotential(blueprint),
  };
}

/** Projects the latest selected F1 run without allocating shared operating costs to strains. */
export function mapRunSummaryReadModel(world: SimulationWorld): RunSummaryReadModel {
  const run = selectedRun(world);
  const ledger = world.economy?.ledger ?? [];
  const unallocatedOperatingExpenseCc = ledger.filter((item) =>
    item.category === 'operating_expense' && item.direction === 'debit'
  ).reduce((sum, item) => sum + item.amountCc, 0);
  const overallMargin = world.economy ? ledger.reduce(
    (sum, item) => sum + (item.direction === 'credit' ? item.amountCc : -item.amountCc),
    0,
  ) : null;
  if (!run?.selectedCandidateId) {
    return {
      status: 'locked', completed: false, completedAtSimTimeHours: null, breedingRunId: null,
      unallocatedOperatingExpenseCc: round(unallocatedOperatingExpenseCc),
      overallCycleContributionMarginCc: overallMargin === null ? null : round(overallMargin), entries: [],
    };
  }
  const entries = [
    entry(world, 'seed-parent', run.seedParentId),
    entry(world, 'pollen-parent', run.pollenParentId),
    entry(world, 'selected-f1', run.selectedCandidateId),
  ];
  const f1HarvestTicks = world.company.structures.flatMap((structure) => structure.rooms)
    .flatMap((room) => room.zones).flatMap((zone) => zone.plants)
    .filter((plant) => plant.strainId === run.selectedCandidateId && plant.status === 'harvested')
    .flatMap((plant) => plant.harvestedAt_tick === undefined ? [] : [plant.harvestedAt_tick]);
  const completedAt = f1HarvestTicks.length > 0 ? Math.min(...f1HarvestTicks) : null;
  return {
    status: completedAt === null ? 'in-progress' : 'completed',
    completed: completedAt !== null,
    completedAtSimTimeHours: completedAt,
    breedingRunId: run.id,
    unallocatedOperatingExpenseCc: round(unallocatedOperatingExpenseCc),
    overallCycleContributionMarginCc: overallMargin === null ? null : round(overallMargin),
    entries,
  };
}

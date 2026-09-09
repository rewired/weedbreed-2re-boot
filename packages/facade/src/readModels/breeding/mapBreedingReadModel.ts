/* eslint-disable wb-sim/no-ts-import-js-extension */

import { resolveStrain, type BreedingRun, type SimulationWorld, type StrainBlueprint } from '@wb/engine';
import type {
  BreedingReadModel,
  BreedingTraitDeltaReadModel,
  BreedingTraitsReadModel,
  QualifiedBreedingParentReadModel,
} from './types.js';

const round = (value: number): number => Number(value.toFixed(6));

function traits(blueprint: StrainBlueprint): BreedingTraitsReadModel {
  const temperature = blueprint.envBands.flower?.temp_C ?? blueprint.envBands.default.temp_C;
  const chemotype = blueprint.chemotype ?? {};
  return {
    yieldPotentialGPerPlant: round(blueprint.growthModel.maxBiomassDry * 1000),
    cycleDurationDays: Object.values(blueprint.phaseDurations).reduce((sum, days) => sum + days, 0),
    resilience01: round(blueprint.generalResilience),
    thc01: round(chemotype.thcContent ?? 0),
    cbd01: round(chemotype.cbdContent ?? 0),
    temperatureBandC: { min: round(temperature?.green[0] ?? 0), max: round(temperature?.green[1] ?? 0) },
  };
}

function mean(left: BreedingTraitsReadModel, right: BreedingTraitsReadModel): BreedingTraitsReadModel {
  return {
    yieldPotentialGPerPlant: (left.yieldPotentialGPerPlant + right.yieldPotentialGPerPlant) / 2,
    cycleDurationDays: (left.cycleDurationDays + right.cycleDurationDays) / 2,
    resilience01: (left.resilience01 + right.resilience01) / 2,
    thc01: (left.thc01 + right.thc01) / 2,
    cbd01: (left.cbd01 + right.cbd01) / 2,
    temperatureBandC: {
      min: (left.temperatureBandC.min + right.temperatureBandC.min) / 2,
      max: (left.temperatureBandC.max + right.temperatureBandC.max) / 2,
    },
  };
}

function delta(value: BreedingTraitsReadModel, baseline: BreedingTraitsReadModel): BreedingTraitDeltaReadModel {
  return {
    yieldPotentialGPerPlant: round(value.yieldPotentialGPerPlant - baseline.yieldPotentialGPerPlant),
    cycleDurationDays: round(value.cycleDurationDays - baseline.cycleDurationDays),
    resilience01: round(value.resilience01 - baseline.resilience01),
    thc01: round(value.thc01 - baseline.thc01),
    cbd01: round(value.cbd01 - baseline.cbd01),
    temperatureBandC: {
      min: round(value.temperatureBandC.min - baseline.temperatureBandC.min),
      max: round(value.temperatureBandC.max - baseline.temperatureBandC.max),
    },
  };
}

function mapRun(world: SimulationWorld, run: BreedingRun): BreedingReadModel['runs'][number] {
  const seed = resolveStrain(world, run.seedParentId)?.blueprint;
  const pollen = resolveStrain(world, run.pollenParentId)?.blueprint;
  if (!seed || !pollen) throw new Error(`Breeding run ${run.id} has unresolved parents.`);
  const seedTraits = traits(seed);
  const pollenTraits = traits(pollen);
  const parentMean = mean(seedTraits, pollenTraits);
  const custom = run.selectedCandidateId
    ? world.breeding?.customStrainRegistry.find((entry) => entry.id === run.selectedCandidateId)
    : undefined;
  return {
    runId: run.id,
    status: run.status,
    laboratoryRoomId: run.laboratoryRoomId,
    populationSize: run.populationSize,
    parents: [
      { role: 'seed', strainId: seed.id, name: seed.name, traits: seedTraits },
      { role: 'pollen', strainId: pollen.id, name: pollen.name, traits: pollenTraits },
    ],
    candidates: [...run.candidates].sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id)).map((candidate) => {
      const candidateTraits = traits(candidate.blueprint);
      return {
        candidateId: candidate.id,
        ordinal: candidate.ordinal,
        name: candidate.blueprint.name,
        traits: candidateTraits,
        deltaFromParentMean: delta(candidateTraits, parentMean),
      };
    }),
    selectedCandidateId: run.selectedCandidateId ?? null,
    customStrain: custom ? { strainId: custom.id, name: custom.name, slug: custom.slug } : null,
  };
}

/** Projects laboratories, durable qualification, populations, and selected runtime strains. */
export function mapBreedingReadModel(world: SimulationWorld): BreedingReadModel {
  const laboratories = world.company.structures.flatMap((structure) => structure.rooms)
    .filter((room) => room.purpose === 'laboratory')
    .sort((a, b) => a.id.localeCompare(b.id));
  const parentIds = [...new Set((world.breeding?.qualifiedParents ?? []).map((entry) => entry.strainId))];
  const qualifiedParents = parentIds.flatMap((strainId): QualifiedBreedingParentReadModel[] => {
    const blueprint = resolveStrain(world, strainId)?.blueprint;
    return blueprint ? [{ strainId, name: blueprint.name, traits: traits(blueprint) }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name) || a.strainId.localeCompare(b.strainId));
  const reasons: BreedingReadModel['crossEligibility']['reasons'][number][] = [];
  if (laboratories.length === 0) reasons.push('laboratory-required');
  if (qualifiedParents.length < 2) reasons.push('two-qualified-parents-required');
  return {
    laboratory: laboratories[0] ? { roomId: laboratories[0].id, roomName: laboratories[0].name } : null,
    qualifiedParents,
    crossEligibility: { eligible: reasons.length === 0, reasons },
    runs: [...(world.breeding?.runs ?? [])]
      .sort((a, b) => a.createdAtSimTimeHours - b.createdAtSimTimeHours || a.id.localeCompare(b.id))
      .map((run) => mapRun(world, run)),
  };
}

import type { SimulationWorld, Structure, StructureTariffOverride } from '../../domain/world.js';
import type { ResolvedTariffs } from '../../util/tariffs.js';

export interface StructureTariffView {
  readonly structureId: Structure['id'];
  readonly base: ResolvedTariffs;
  readonly override?: StructureTariffOverride;
  readonly effective: ResolvedTariffs;
}

export interface StructureTariffReadModel {
  readonly baseline: ResolvedTariffs;
  readonly structures: readonly StructureTariffView[];
  readonly rollup: ResolvedTariffs;
}

function sanitizeOverride(override: StructureTariffOverride | undefined): StructureTariffOverride | undefined {
  if (!override) {
    return undefined;
  }

  const price_electricity =
    typeof override.price_electricity === 'number' && override.price_electricity >= 0
      ? override.price_electricity
      : undefined;
  const price_water =
    typeof override.price_water === 'number' && override.price_water >= 0
      ? override.price_water
      : undefined;

  if (price_electricity === undefined && price_water === undefined) {
    return undefined;
  }

  return Object.freeze({
    ...(price_electricity !== undefined ? { price_electricity } : {}),
    ...(price_water !== undefined ? { price_water } : {})
  } satisfies StructureTariffOverride);
}

function mergeTariffs(baseline: ResolvedTariffs, override?: StructureTariffOverride): ResolvedTariffs {
  return {
    price_electricity: override?.price_electricity ?? baseline.price_electricity,
    price_water: override?.price_water ?? baseline.price_water
  } satisfies ResolvedTariffs;
}

export function structureTariffs(
  world: SimulationWorld,
  baseline: ResolvedTariffs
): StructureTariffReadModel {
  const structures = world.company.structures.map((structure) => {
    const override = sanitizeOverride((structure as { tariffOverride?: StructureTariffOverride }).tariffOverride);
    const effective = mergeTariffs(baseline, override);

    return {
      structureId: structure.id,
      base: baseline,
      override,
      effective
    } satisfies StructureTariffView;
  });

  return {
    baseline,
    structures,
    rollup: { ...baseline }
  } satisfies StructureTariffReadModel;
}

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

  const sanitized: StructureTariffOverride = {};

  if (typeof override.price_electricity === 'number' && override.price_electricity >= 0) {
    sanitized.price_electricity = override.price_electricity;
  }

  if (typeof override.price_water === 'number' && override.price_water >= 0) {
    sanitized.price_water = override.price_water;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
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

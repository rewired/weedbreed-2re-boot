import { describe, expect, it } from 'vitest';

import { createDemoWorld } from '@/backend/src/engine/testHarness';
import { structureTariffs } from '@/backend/src/readmodels/economy/structureTariffs';
import type { ResolvedTariffs } from '@/backend/src/util/tariffs';
import type { StructureTariffOverride } from '@/backend/src/domain/world';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const BASELINE_TARIFFS: ResolvedTariffs = Object.freeze({
  price_electricity: 0.35,
  price_water: 2
});

describe('structureTariffs read-model', () => {
  it('mirrors the baseline when no overrides are provided', () => {
    const world = createDemoWorld();
    const result = structureTariffs(world, BASELINE_TARIFFS);

    expect(result.baseline).toBe(BASELINE_TARIFFS);
    expect(result.rollup).toEqual(BASELINE_TARIFFS);

    for (const entry of result.structures) {
      expect(entry.override).toBeUndefined();
      expect(entry.effective).toEqual(BASELINE_TARIFFS);
    }
  });

  it('applies structure-level overrides with field-level precedence', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0] as Mutable<typeof world.company.structures[number]>;

    structure.tariffOverride = {
      price_electricity: 0.48
    } satisfies StructureTariffOverride;

    const result = structureTariffs(world, BASELINE_TARIFFS);
    const entry = result.structures.find((item) => item.structureId === structure.id);

    expect(entry?.override).toEqual({ price_electricity: 0.48 });
    expect(entry?.effective).toEqual({ price_electricity: 0.48, price_water: BASELINE_TARIFFS.price_water });

    const otherEntries = result.structures.filter((item) => item.structureId !== structure.id);

    for (const other of otherEntries) {
      expect(other.override).toBeUndefined();
      expect(other.effective).toEqual(BASELINE_TARIFFS);
    }

    expect(result.rollup).toEqual(BASELINE_TARIFFS);
  });

  it('preserves daily roll-up invariants even when overrides exist', () => {
    const world = createDemoWorld();
    const structures = world.company.structures as Mutable<typeof world.company.structures>;
    const [first] = structures;
    const clone = {
      ...first,
      id: `${first.id}-clone` as typeof first.id,
      slug: `${first.slug}-clone`,
      name: `${first.name} Clone`,
      tariffOverride: undefined
    };

    structures.push(clone);

    structures[0].tariffOverride = { price_electricity: 0.5 } satisfies StructureTariffOverride;
    structures[1].tariffOverride = { price_water: 1.6 } satisfies StructureTariffOverride;

    const result = structureTariffs(world, BASELINE_TARIFFS);

    expect(result.rollup).toEqual(BASELINE_TARIFFS);

    for (const entry of result.structures) {
      expect(entry.base).toBe(BASELINE_TARIFFS);
      expect(entry.effective.price_electricity).toBeGreaterThanOrEqual(0);
      expect(entry.effective.price_water).toBeGreaterThanOrEqual(0);
    }
  });
});

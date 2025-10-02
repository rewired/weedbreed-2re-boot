import { describe, expect, it } from 'vitest';

import dripInline from '../../../../../data/blueprints/irrigationMethods/drip-inline-fertigation-basic.json' assert { type: 'json' };
import ebbFlow from '../../../../../data/blueprints/irrigationMethods/ebb-flow-table-small.json' assert { type: 'json' };
import manualCan from '../../../../../data/blueprints/irrigationMethods/manual-watering-can.json' assert { type: 'json' };
import topFeed from '../../../../../data/blueprints/irrigationMethods/top-feed-pump-timer.json' assert { type: 'json' };
import cocoCoir from '../../../../../data/blueprints/substrates/coco_coir.json' assert { type: 'json' };
import soilMulti from '../../../../../data/blueprints/substrates/soil_multi_cycle.json' assert { type: 'json' };
import soilSingle from '../../../../../data/blueprints/substrates/soil_single_cycle.json' assert { type: 'json' };
import basicSoilPot from '../../../../../data/blueprints/cultivationMethods/basic_soil_pot.json' assert { type: 'json' };
import scrog from '../../../../../data/blueprints/cultivationMethods/scrog.json' assert { type: 'json' };
import sog from '../../../../../data/blueprints/cultivationMethods/sog.json' assert { type: 'json' };

import { parseIrrigationBlueprint, type IrrigationBlueprint } from '@/backend/src/domain/world.js';

type CultivationBlueprint = typeof basicSoilPot;

describe('irrigation compatibility coverage', () => {
  const substrateSlugs = new Set([
    cocoCoir.slug as string,
    soilMulti.slug as string,
    soilSingle.slug as string
  ]);

  const irrigationFixtures = [dripInline, ebbFlow, manualCan, topFeed] as const;
  const irrigationBlueprints = irrigationFixtures.map((fixture) =>
    parseIrrigationBlueprint(fixture, { knownSubstrateSlugs: substrateSlugs })
  );

  const cultivationMethods = [basicSoilPot, scrog, sog] as const satisfies readonly CultivationBlueprint[];

  const compatibilityIndex = new Map<string, IrrigationBlueprint[]>();
  irrigationBlueprints.forEach((blueprint) => {
    blueprint.compatibility.substrates.forEach((substrateSlug) => {
      const existing = compatibilityIndex.get(substrateSlug) ?? [];
      existing.push(blueprint);
      compatibilityIndex.set(substrateSlug, existing);
    });
  });

  function resolveCompatibleIrrigation(substrateSlug: string): IrrigationBlueprint | undefined {
    const compatible = compatibilityIndex.get(substrateSlug);
    return compatible?.[0];
  }

  it('covers every cultivation substrate with at least one irrigation method', () => {
    cultivationMethods.forEach((method) => {
      method.substrates.forEach((substrateSlug: string) => {
        const compatibleMethods = compatibilityIndex.get(substrateSlug);
        expect(compatibleMethods, `No irrigation method exposes substrate ${substrateSlug}`).toBeDefined();
        expect(compatibleMethods?.length ?? 0).toBeGreaterThan(0);
      });
    });
  });

  it('resolves default cultivation substrates to an irrigation method automatically', () => {
    cultivationMethods.forEach((method) => {
      const defaultSubstrate = method.meta?.defaults?.substrateSlug as string | undefined;
      expect(defaultSubstrate, `Cultivation method ${method.slug} is missing a default substrate`).toBeTruthy();

      if (!defaultSubstrate) {
        return;
      }

      const resolved = resolveCompatibleIrrigation(defaultSubstrate);
      expect(resolved, `No irrigation method compatible with ${defaultSubstrate}`).toBeTruthy();
    });
  });
});

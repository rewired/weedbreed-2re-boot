import { describe, expect, it } from 'vitest';

import dripInline from '../../../../../data/blueprints/irrigationMethods/drip-inline-fertigation-basic.json' assert { type: 'json' };
import ebbFlow from '../../../../../data/blueprints/irrigationMethods/ebb-flow-table-small.json' assert { type: 'json' };
import manualCan from '../../../../../data/blueprints/irrigationMethods/manual-watering-can.json' assert { type: 'json' };
import topFeed from '../../../../../data/blueprints/irrigationMethods/top-feed-pump-timer.json' assert { type: 'json' };
import cocoCoir from '../../../../../data/blueprints/substrates/coco_coir.json' assert { type: 'json' };
import soilMulti from '../../../../../data/blueprints/substrates/soil_multi_cycle.json' assert { type: 'json' };
import soilSingle from '../../../../../data/blueprints/substrates/soil_single_cycle.json' assert { type: 'json' };

import { parseIrrigationBlueprint } from '@/backend/src/domain/world.js';

describe('parseIrrigationBlueprint', () => {
  const substrateSlugs = new Set([
    cocoCoir.slug as string,
    soilMulti.slug as string,
    soilSingle.slug as string
  ]);

  const fixtures = [dripInline, ebbFlow, manualCan, topFeed] as const;

  it('parses repository irrigation blueprints without modification', () => {
    fixtures.forEach((fixture) => {
      expect(() =>
        parseIrrigationBlueprint(fixture, { knownSubstrateSlugs: substrateSlugs })
      ).not.toThrow();
    });
  });

  it('rejects blueprints referencing unknown substrate slugs', () => {
    const invalid = JSON.parse(JSON.stringify(manualCan)) as typeof manualCan;
    invalid.compatibility.substrates = [...invalid.compatibility.substrates, 'unknown-substrate'];

    expect(() =>
      parseIrrigationBlueprint(invalid, { knownSubstrateSlugs: substrateSlugs })
    ).toThrow(/unknown substrate slug/);
  });
});

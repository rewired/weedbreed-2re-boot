import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import dripInline from '../../../../../data/blueprints/irrigation/drip/inline-fertigation/drip-inline-fertigation-basic.json' assert { type: 'json' };
import ebbFlow from '../../../../../data/blueprints/irrigation/ebb-flow/table/ebb-flow-table-small.json' assert { type: 'json' };
import manualCan from '../../../../../data/blueprints/irrigation/manual/can/manual-watering-can.json' assert { type: 'json' };
import topFeed from '../../../../../data/blueprints/irrigation/top-feed/timer/top-feed-pump-timer.json' assert { type: 'json' };
import cocoCoir from '../../../../../data/blueprints/substrate/coco/coir/coco_coir.json' assert { type: 'json' };
import soilMulti from '../../../../../data/blueprints/substrate/soil/multi-cycle/soil_multi_cycle.json' assert { type: 'json' };
import soilSingle from '../../../../../data/blueprints/substrate/soil/single-cycle/soil_single_cycle.json' assert { type: 'json' };

import { parseIrrigationBlueprint } from '@/backend/src/domain/world.js';

describe('parseIrrigationBlueprint', () => {
  const substrateSlugs = new Set([
    cocoCoir.slug as string,
    soilMulti.slug as string,
    soilSingle.slug as string
  ]);

  const fixtures = [
    {
      data: dripInline,
      path: fileURLToPath(
        new URL(
          '../../../../../data/blueprints/irrigation/drip/inline-fertigation/drip-inline-fertigation-basic.json',
          import.meta.url
        )
      )
    },
    {
      data: ebbFlow,
      path: fileURLToPath(
        new URL(
          '../../../../../data/blueprints/irrigation/ebb-flow/table/ebb-flow-table-small.json',
          import.meta.url
        )
      )
    },
    {
      data: manualCan,
      path: fileURLToPath(
        new URL(
          '../../../../../data/blueprints/irrigation/manual/can/manual-watering-can.json',
          import.meta.url
        )
      )
    },
    {
      data: topFeed,
      path: fileURLToPath(
        new URL(
          '../../../../../data/blueprints/irrigation/top-feed/timer/top-feed-pump-timer.json',
          import.meta.url
        )
      )
    }
  ] as const;

  it('parses repository irrigation blueprints without modification', () => {
    fixtures.forEach((fixture) => {
      expect(() =>
        parseIrrigationBlueprint(fixture.data, {
          knownSubstrateSlugs: substrateSlugs,
          filePath: fixture.path
        })
      ).not.toThrow();
    });
  });

  it('rejects blueprints referencing unknown substrate slugs', () => {
    const invalid = JSON.parse(JSON.stringify(manualCan)) as typeof manualCan;
    invalid.compatibility.substrates = [...invalid.compatibility.substrates, 'unknown-substrate'];

    expect(() =>
      parseIrrigationBlueprint(invalid, { knownSubstrateSlugs: substrateSlugs, filePath: fixtures[2].path })
    ).toThrow(/unknown substrate slug/);
  });
});

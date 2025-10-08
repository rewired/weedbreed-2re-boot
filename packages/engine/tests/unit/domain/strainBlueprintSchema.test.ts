import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseStrainBlueprint } from '../../../src/backend/src/domain/blueprints/strainBlueprint.ts';
import { BlueprintTaxonomyMismatchError } from '../../../src/backend/src/domain/blueprints/taxonomy.ts';
import { resolveBlueprintPath } from '../../testUtils/paths.ts';

const fixturePath = resolveBlueprintPath('strain/white-widow.json');
const blueprintsRoot = path.resolve(fixturePath, '..', '..');
const fixturePayload = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('strainBlueprintSchema', () => {
  it('parses the white widow blueprint', () => {
    const blueprint = parseStrainBlueprint(fixturePayload, {
      filePath: fixturePath,
      blueprintsRoot
    });
    expect(blueprint.id).toBeDefined();
    expect(blueprint.slug).toBe('white-widow');
    expect(blueprint.envBands.default.temp_C?.green).toEqual([21, 26]);
  });

  it('rejects payloads with missing required fields', () => {
    expect(() => parseStrainBlueprint({})).toThrow();
    expect(() => parseStrainBlueprint({ ...fixturePayload, id: undefined })).toThrow();
    expect(() => parseStrainBlueprint({ ...fixturePayload, slug: 'Invalid Slug' })).toThrow();
  });

  it('rejects invalid class formats', () => {
    expect(() =>
      parseStrainBlueprint(
        { ...fixturePayload, class: 'strain.hybrid' },
        { filePath: fixturePath }
      )
    ).toThrow();
    expect(() =>
      parseStrainBlueprint(
        { ...fixturePayload, class: 'device.lighting' },
        { filePath: fixturePath }
      )
    ).toThrow();
  });

  it('validates env bands structure', () => {
    expect(() =>
      parseStrainBlueprint({
        ...fixturePayload,
        envBands: { default: { temp_C: { green: [25, 20], yellowLow: 18, yellowHigh: 28 } } }
      })
    ).toThrow();
  });

  it('validates stress tolerance positivity', () => {
    expect(() =>
      parseStrainBlueprint({
        ...fixturePayload,
        stressTolerance: { ...fixturePayload.stressTolerance, temp_C: -1 }
      })
    ).toThrow();
  });

  it('validates growth model structure', () => {
    expect(() =>
      parseStrainBlueprint({
        ...fixturePayload,
        growthModel: {
          ...fixturePayload.growthModel,
          temperature: { ...fixturePayload.growthModel.temperature, min_C: 40 }
        }
      })
    ).toThrow();
  });

  it('accepts numeric dryMatterFraction and harvestIndex', () => {
    const payload = {
      ...fixturePayload,
      growthModel: {
        ...fixturePayload.growthModel,
        dryMatterFraction: 0.3,
        harvestIndex: 0.65
      }
    };

    expect(() =>
      parseStrainBlueprint(payload, {
        filePath: fixturePath,
        blueprintsRoot
      })
    ).not.toThrow();
  });

  it('accepts stage-specific dryMatterFraction and harvestIndex objects', () => {
    expect(() =>
      parseStrainBlueprint(
        {
          ...fixturePayload,
          growthModel: {
            ...fixturePayload.growthModel,
            dryMatterFraction: { vegetation: 0.25, flowering: 0.2 },
            harvestIndex: { targetFlowering: 0.7 }
          }
        },
        { filePath: fixturePath, blueprintsRoot }
      )
    ).not.toThrow();
  });

  it('rejects stage fractions outside of [0, 1]', () => {
    expect(() =>
      parseStrainBlueprint({
        ...fixturePayload,
        growthModel: {
          ...fixturePayload.growthModel,
          dryMatterFraction: { vegetation: 1.2 }
        }
      })
    ).toThrow();

    expect(() =>
      parseStrainBlueprint({
        ...fixturePayload,
        growthModel: {
          ...fixturePayload.growthModel,
          harvestIndex: { targetFlowering: -0.1 }
        }
      })
    ).toThrow();
  });

  it('validates phase durations are positive integers', () => {
    expect(() =>
      parseStrainBlueprint({
        ...fixturePayload,
        phaseDurations: { ...fixturePayload.phaseDurations, seedlingDays: -1 }
      })
    ).toThrow();
  });

  it('validates noise configuration bounds', () => {
    expect(() =>
      parseStrainBlueprint({
        ...fixturePayload,
        noise: { enabled: true, pct: 1.5 }
      })
    ).toThrow();
  });

  it('validates taxonomy when filePath provided', () => {
    expect(() =>
      parseStrainBlueprint(
        { ...fixturePayload, class: 'strain' },
        { filePath: fixturePath, blueprintsRoot }
      )
    ).not.toThrow();
  });

  it('throws BlueprintTaxonomyMismatchError when path disagrees', () => {
    expect(() =>
      parseStrainBlueprint(fixturePayload, {
        filePath: path.join(blueprintsRoot, 'device/climate/cool-air-split-3000.json'),
        blueprintsRoot
      })
    ).toThrow(BlueprintTaxonomyMismatchError);
  });

  it('detects duplicate slugs in registry', () => {
    const registry = new Map<string, string>();
    parseStrainBlueprint(fixturePayload, {
      slugRegistry: registry,
      filePath: fixturePath,
      blueprintsRoot
    });

    expect(() =>
      parseStrainBlueprint(fixturePayload, {
        slugRegistry: registry,
        filePath: fixturePath,
        blueprintsRoot
      })
    ).toThrow();
  });

  it('accepts unique slugs across multiple parses', () => {
    const registry = new Map<string, string>();
    parseStrainBlueprint({ ...fixturePayload, slug: 'strain-a' }, { slugRegistry: registry, blueprintsRoot });
    expect(() =>
      parseStrainBlueprint({ ...fixturePayload, slug: 'strain-b' }, { slugRegistry: registry, blueprintsRoot })
    ).not.toThrow();
  });
});

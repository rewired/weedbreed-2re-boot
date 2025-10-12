import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseStrainBlueprint } from '../../../src/backend/src/domain/blueprints/strainBlueprint.ts';
import { BlueprintTaxonomyMismatchError } from '../../../src/backend/src/domain/blueprints/taxonomy.ts';
import { resolveBlueprintPath } from '../../testUtils/paths.ts';

const fixturePath = resolveBlueprintPath('strain/white-widow.json');
const blueprintsRoot = path.resolve(fixturePath, '..', '..');
const fixtureRaw = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;

if (typeof fixtureRaw !== 'object' || fixtureRaw === null) {
  throw new Error('Expected strain blueprint fixture to be a JSON object');
}

const fixtureObject = fixtureRaw as Record<string, unknown>;
const fixtureBlueprint = parseStrainBlueprint(fixtureObject, {
  filePath: fixturePath,
  blueprintsRoot
});

function cloneFixture(): Record<string, unknown> {
  return structuredClone(fixtureObject);
}

function cloneParsedBlueprint(): ReturnType<typeof parseStrainBlueprint> {
  return structuredClone(fixtureBlueprint);
}

function cloneFixtureWith(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...cloneFixture(), ...overrides };
}

describe('strainBlueprintSchema', () => {
  it('parses the white widow blueprint', () => {
    const blueprint = parseStrainBlueprint(cloneFixture(), {
      filePath: fixturePath,
      blueprintsRoot
    });
    expect(blueprint.id).toBeDefined();
    expect(blueprint.slug).toBe('white-widow');
    expect(blueprint.envBands.default.temp_C?.green).toEqual([21, 26]);
  });

  it('rejects payloads with missing required fields', () => {
    expect(() => parseStrainBlueprint({})).toThrow();
    expect(() => parseStrainBlueprint(cloneFixtureWith({ id: undefined }))).toThrow();
    expect(() => parseStrainBlueprint(cloneFixtureWith({ slug: 'Invalid Slug' }))).toThrow();
  });

  it('rejects invalid class formats', () => {
    expect(() =>
      parseStrainBlueprint(
        cloneFixtureWith({ class: 'strain.hybrid' }),
        { filePath: fixturePath }
      )
    ).toThrow();
    expect(() =>
      parseStrainBlueprint(
        cloneFixtureWith({ class: 'device.lighting' }),
        { filePath: fixturePath }
      )
    ).toThrow();
  });

  it('validates env bands structure', () => {
    expect(() =>
      parseStrainBlueprint(
        cloneFixtureWith({
          envBands: { default: { temp_C: { green: [25, 20], yellowLow: 18, yellowHigh: 28 } } }
        })
      )
    ).toThrow();
  });

  it('validates stress tolerance positivity', () => {
    const invalidBlueprint = cloneParsedBlueprint();
    invalidBlueprint.stressTolerance = {
      ...invalidBlueprint.stressTolerance,
      temp_C: -1
    };

    expect(() => parseStrainBlueprint(invalidBlueprint as unknown)).toThrow();
  });

  it('validates growth model structure', () => {
    const invalidBlueprint = cloneParsedBlueprint();
    invalidBlueprint.growthModel = {
      ...invalidBlueprint.growthModel,
      temperature: {
        ...invalidBlueprint.growthModel.temperature,
        min_C: 40
      }
    };

    expect(() => parseStrainBlueprint(invalidBlueprint as unknown)).toThrow();
  });

  it('accepts numeric dryMatterFraction and harvestIndex', () => {
    const payload = cloneParsedBlueprint();
    payload.growthModel = {
      ...payload.growthModel,
      dryMatterFraction: 0.3,
      harvestIndex: 0.65
    };

    expect(() =>
      parseStrainBlueprint(payload as unknown, {
        filePath: fixturePath,
        blueprintsRoot
      })
    ).not.toThrow();
  });

  it('accepts stage-specific dryMatterFraction and harvestIndex objects', () => {
    const payload = cloneParsedBlueprint();
    payload.growthModel = {
      ...payload.growthModel,
      dryMatterFraction: { vegetation: 0.25, flowering: 0.2 },
      harvestIndex: { targetFlowering: 0.7 }
    };

    expect(() =>
      parseStrainBlueprint(payload as unknown, { filePath: fixturePath, blueprintsRoot })
    ).not.toThrow();
  });

  it('rejects stage fractions outside of [0, 1]', () => {
    const invalidHighFraction = cloneParsedBlueprint();
    invalidHighFraction.growthModel = {
      ...invalidHighFraction.growthModel,
      dryMatterFraction: { vegetation: 1.2 }
    };

    expect(() => parseStrainBlueprint(invalidHighFraction as unknown)).toThrow();

    const invalidLowFraction = cloneParsedBlueprint();
    invalidLowFraction.growthModel = {
      ...invalidLowFraction.growthModel,
      harvestIndex: { targetFlowering: -0.1 }
    };

    expect(() => parseStrainBlueprint(invalidLowFraction as unknown)).toThrow();
  });

  it('validates phase durations are positive integers', () => {
    const invalidBlueprint = cloneParsedBlueprint();
    invalidBlueprint.phaseDurations = {
      ...invalidBlueprint.phaseDurations,
      seedlingDays: -1
    };

    expect(() => parseStrainBlueprint(invalidBlueprint as unknown)).toThrow();
  });

  it('validates noise configuration bounds', () => {
    expect(() => parseStrainBlueprint(cloneFixtureWith({ noise: { enabled: true, pct: 1.5 } }))).toThrow();
  });

  it('validates taxonomy when filePath provided', () => {
    expect(() =>
      parseStrainBlueprint(
        cloneFixtureWith({ class: 'strain' }),
        { filePath: fixturePath, blueprintsRoot }
      )
    ).not.toThrow();
  });

  it('throws BlueprintTaxonomyMismatchError when path disagrees', () => {
    expect(() =>
      parseStrainBlueprint(cloneFixture(), {
        filePath: path.join(blueprintsRoot, 'device/climate/cool-air-split-3000.json'),
        blueprintsRoot
      })
    ).toThrow(BlueprintTaxonomyMismatchError);
  });

  it('detects duplicate slugs in registry', () => {
    const registry = new Map<string, string>();
    parseStrainBlueprint(cloneFixture(), {
      slugRegistry: registry,
      filePath: fixturePath,
      blueprintsRoot
    });

    expect(() =>
      parseStrainBlueprint(cloneFixture(), {
        slugRegistry: registry,
        filePath: fixturePath,
        blueprintsRoot
      })
    ).toThrow();
  });

  it('accepts unique slugs across multiple parses', () => {
    const registry = new Map<string, string>();
    parseStrainBlueprint(cloneFixtureWith({ slug: 'strain-a' }), { slugRegistry: registry, blueprintsRoot });
    expect(() =>
      parseStrainBlueprint(cloneFixtureWith({ slug: 'strain-b' }), { slugRegistry: registry, blueprintsRoot })
    ).not.toThrow();
  });
});

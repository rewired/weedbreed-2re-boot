import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseStrainBlueprint } from '../../../src/backend/src/domain/blueprints/strainBlueprint.js';
import { BlueprintClassMismatchError } from '../../../src/backend/src/domain/blueprints/taxonomy.js';
import { resolveBlueprintPath } from '../../testUtils/paths.js';

const fixturePath = resolveBlueprintPath('strain/hybrid/balanced/white_widow.json');
const fixturePayload = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('strainBlueprintSchema', () => {
  it('parses the white widow blueprint', () => {
    const blueprint = parseStrainBlueprint(fixturePayload, { filePath: fixturePath });
    expect(blueprint.id).toBeDefined();
    expect(blueprint.slug).toBe('white_widow');
    expect(blueprint.envBands.default.temp_C?.green).toEqual([21, 26]);
  });

  it('rejects payloads with missing required fields', () => {
    expect(() => parseStrainBlueprint({})).toThrow();
    expect(() => parseStrainBlueprint({ ...fixturePayload, id: undefined })).toThrow();
    expect(() => parseStrainBlueprint({ ...fixturePayload, slug: 'Invalid Slug' })).toThrow();
  });

  it('rejects invalid class formats', () => {
    expect(() =>
      parseStrainBlueprint({ ...fixturePayload, class: 'strain' }, { filePath: fixturePath })
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
      parseStrainBlueprint({ ...fixturePayload, class: 'strain.hybrid.balanced' }, { filePath: fixturePath })
    ).not.toThrow();
  });

  it('throws BlueprintClassMismatchError when path disagrees', () => {
    expect(() =>
      parseStrainBlueprint(fixturePayload, {
        filePath: path.resolve('data/blueprints/strain/indica/pure/mock.json')
      })
    ).toThrow(BlueprintClassMismatchError);
  });

  it('detects duplicate slugs in registry', () => {
    const registry = new Map<string, string>();
    parseStrainBlueprint(fixturePayload, { slugRegistry: registry, filePath: fixturePath });

    expect(() =>
      parseStrainBlueprint(fixturePayload, { slugRegistry: registry, filePath: fixturePath })
    ).toThrow();
  });

  it('allows same slug across different classes', () => {
    const registry = new Map<string, string>();
    const strainA = parseStrainBlueprint(
      { ...fixturePayload, class: 'strain.hybrid.balanced', slug: 'duplicate-strain' },
      { slugRegistry: registry }
    );
    expect(strainA.class).toBe('strain.hybrid.balanced');

    const strainB = parseStrainBlueprint(
      { ...fixturePayload, class: 'strain.indica.pure', slug: 'duplicate-strain' },
      { slugRegistry: registry }
    );
    expect(strainB.class).toBe('strain.indica.pure');
  });
});

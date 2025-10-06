import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  convertSubstrateMassKgToVolumeL,
  convertSubstrateVolumeLToMassKg,
  parseSubstrateBlueprint,
  substrateBlueprintSchema
} from '@/backend/src/domain/world.js';

import cocoCoir from '../../../../../data/blueprints/substrate/coco-coir.json' with { type: 'json' };
import soilMulti from '../../../../../data/blueprints/substrate/soil-multi-cycle.json' with { type: 'json' };
import soilSingle from '../../../../../data/blueprints/substrate/soil-single-cycle.json' with { type: 'json' };

const cocoCoirPath = fileURLToPath(
  new URL('../../../../../data/blueprints/substrate/coco-coir.json', import.meta.url)
);
const soilMultiPath = fileURLToPath(
  new URL('../../../../../data/blueprints/substrate/soil-multi-cycle.json', import.meta.url)
);
const soilSinglePath = fileURLToPath(
  new URL('../../../../../data/blueprints/substrate/soil-single-cycle.json', import.meta.url)
);

const blueprintsRoot = path.resolve(
  fileURLToPath(new URL('../../../../../data/blueprints/', import.meta.url))
);

const substrateFixtures = [
  { data: cocoCoir, path: cocoCoirPath },
  { data: soilMulti, path: soilMultiPath },
  { data: soilSingle, path: soilSinglePath }
] as const;

describe('substrateBlueprintSchema', () => {
  it('parses repository substrate blueprints without modification', () => {
    for (const fixture of substrateFixtures) {
      expect(() =>
        parseSubstrateBlueprint(fixture.data, { filePath: fixture.path, blueprintsRoot })
      ).not.toThrow();
    }
  });

  it('rejects payloads that omit the density factor', () => {
    const invalid = { ...soilSingle } as Record<string, unknown>;
    delete invalid.densityFactor_L_per_kg;

    const result = substrateBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('densityFactor_L_per_kg');
    }
  });

  it('requires sterilization metadata when a substrate supports reuse', () => {
    const invalid = JSON.parse(JSON.stringify(soilMulti)) as typeof soilMulti;
    invalid.reusePolicy.sterilizationTaskCode = undefined;

    const result = substrateBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain(
        'Sterilization task code is required when reusePolicy.maxCycles exceeds 1.'
      );
    }
  });

  it('enforces purchase unit specific price fields', () => {
    const invalid = JSON.parse(JSON.stringify(cocoCoir)) as typeof cocoCoir;
    delete (invalid as Record<string, unknown>).unitPrice_per_L;

    const result = substrateBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('unitPrice_per_L is required when purchaseUnit is "liter".');
    }
  });

  it('requires material and cycle descriptors', () => {
    const invalidMaterial = { ...cocoCoir } as Record<string, unknown>;
    delete invalidMaterial.material;

    const invalidCycle = { ...cocoCoir } as Record<string, unknown>;
    delete invalidCycle.cycle;

    const missingMaterial = substrateBlueprintSchema.safeParse(invalidMaterial);
    expect(missingMaterial.success).toBe(false);
    if (!missingMaterial.success) {
      const paths = missingMaterial.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('material');
    }

    const missingCycle = substrateBlueprintSchema.safeParse(invalidCycle);
    expect(missingCycle.success).toBe(false);
    if (!missingCycle.success) {
      const paths = missingCycle.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('cycle');
    }
  });

  it('converts mass and volume using the declared density factor', () => {
    const parsed = parseSubstrateBlueprint(cocoCoir, { filePath: cocoCoirPath, blueprintsRoot });

    const massKg = convertSubstrateVolumeLToMassKg(parsed, 85);
    expect(massKg).toBeCloseTo(10, 5);

    const volumeL = convertSubstrateMassKgToVolumeL(parsed, massKg);
    expect(volumeL).toBeCloseTo(85, 5);
  });
});

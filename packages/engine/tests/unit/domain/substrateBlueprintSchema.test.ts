import { describe, expect, it } from 'vitest';

import {
  convertSubstrateMassKgToVolumeL,
  convertSubstrateVolumeLToMassKg,
  parseSubstrateBlueprint,
  substrateBlueprintSchema
} from '@/backend/src/domain/world.js';

import cocoCoir from '../../../../../data/blueprints/substrates/coco_coir.json' assert { type: 'json' };
import soilMulti from '../../../../../data/blueprints/substrates/soil_multi_cycle.json' assert { type: 'json' };
import soilSingle from '../../../../../data/blueprints/substrates/soil_single_cycle.json' assert { type: 'json' };

describe('substrateBlueprintSchema', () => {
  it('parses repository substrate blueprints without modification', () => {
    const fixtures = [cocoCoir, soilMulti, soilSingle];

    for (const fixture of fixtures) {
      expect(() => parseSubstrateBlueprint(fixture)).not.toThrow();
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

  it('converts mass and volume using the declared density factor', () => {
    const parsed = parseSubstrateBlueprint(cocoCoir);

    const massKg = convertSubstrateVolumeLToMassKg(parsed, 85);
    expect(massKg).toBeCloseTo(10, 5);

    const volumeL = convertSubstrateMassKgToVolumeL(parsed, massKg);
    expect(volumeL).toBeCloseTo(85, 5);
  });
});

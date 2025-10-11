import { z } from 'zod';

import { finiteNumber, nonEmptyString } from '../schemas/primitives.ts';
import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.ts';

const positiveNumber = finiteNumber.gt(0, 'Value must be greater than zero.');
const nonNegativeNumber = finiteNumber.min(0, 'Value cannot be negative.');
const slugString = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase, digits, hyphen).');

const purchaseUnitSchema = z.enum(['liter', 'kilogram'], {
  invalid_type_error: 'purchaseUnit must be either "liter" or "kilogram".'
});

const reusePolicySchema = z
  .object({
    maxCycles: z
      .number({ required_error: 'reusePolicy.maxCycles is required.' })
      .int('reusePolicy.maxCycles must be an integer.')
      .min(1, 'reusePolicy.maxCycles must be at least 1.'),
    sterilizationTaskCode: nonEmptyString.optional(),
    sterilizationInterval_cycles: z
      .number({ invalid_type_error: 'sterilizationInterval_cycles must be a number.' })
      .int('sterilizationInterval_cycles must be an integer.')
      .min(1, 'sterilizationInterval_cycles must be at least 1.')
      .optional()
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (policy.maxCycles > 1 && !policy.sterilizationTaskCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sterilization task code is required when reusePolicy.maxCycles exceeds 1.',
        path: ['sterilizationTaskCode']
      });
    }
  });

const classSchema = z.literal('substrate', {
  required_error: 'class is required.',
  invalid_type_error: 'class must be the canonical "substrate" domain value.'
});

const substrateMaterialSchema = z.enum(
  ['soil', 'coco', 'rockwool', 'peat', 'perlite', 'clay', 'living-soil', 'aeroponic', 'hydroponic-media', 'custom'],
  {
    invalid_type_error: 'material must be a recognised substrate material.'
  }
);

const substrateCycleSchema = z.enum(
  ['single-cycle', 'multi-cycle', 'coir', 'perpetual', 'reusable', 'sterile', 'continuous', 'inert', 'custom'],
  {
    invalid_type_error: 'cycle must describe the reuse cadence or profile for the substrate.'
  }
);

export const substrateBlueprintSchema = z
  .object({
    id: z.string().uuid('Substrate blueprint id must be a UUID v4.'),
    slug: slugString,
    class: classSchema,
    name: nonEmptyString,
    purchaseUnit: purchaseUnitSchema,
    unitPrice_per_L: nonNegativeNumber.optional(),
    unitPrice_per_kg: nonNegativeNumber.optional(),
    densityFactor_L_per_kg: positiveNumber,
    maxCycles: z
      .number({ required_error: 'maxCycles is required.' })
      .int('maxCycles must be an integer.')
      .min(1, 'maxCycles must be at least 1.'),
    reusePolicy: reusePolicySchema,
    meta: z.record(z.unknown()).optional(),
    material: substrateMaterialSchema,
    cycle: substrateCycleSchema
  })
  .strict()
  .superRefine((blueprint, ctx) => {
    if (blueprint.purchaseUnit === 'liter') {
      if (blueprint.unitPrice_per_L === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['unitPrice_per_L'],
          message: 'unitPrice_per_L is required when purchaseUnit is "liter".'
        });
      }

      if (blueprint.unitPrice_per_kg !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['unitPrice_per_kg'],
          message: 'unitPrice_per_kg must be omitted when purchaseUnit is "liter".'
        });
      }
    } else {
      if (blueprint.unitPrice_per_kg === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['unitPrice_per_kg'],
          message: 'unitPrice_per_kg is required when purchaseUnit is "kilogram".'
        });
      }

      if (blueprint.unitPrice_per_L !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['unitPrice_per_L'],
          message: 'unitPrice_per_L must be omitted when purchaseUnit is "kilogram".'
        });
      }
    }

    if (blueprint.reusePolicy.maxCycles !== blueprint.maxCycles) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reusePolicy', 'maxCycles'],
        message: 'reusePolicy.maxCycles must match the top-level maxCycles field.'
      });
    }
  });

export type SubstrateBlueprint = z.infer<typeof substrateBlueprintSchema>;

export interface ParseSubstrateBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export function parseSubstrateBlueprint(
  input: unknown,
  options: ParseSubstrateBlueprintOptions = {}
): SubstrateBlueprint {
  const blueprint = substrateBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  if (value < 0) {
    throw new Error(`${name} must be greater than or equal to zero.`);
  }
}

export interface SubstratePhysicalProfile {
  readonly densityFactor_L_per_kg: number;
}

export function convertSubstrateMassKgToVolumeL(
  substrate: SubstratePhysicalProfile,
  massKg: number
): number {
  assertNonNegativeFinite(massKg, 'massKg');

  return massKg * substrate.densityFactor_L_per_kg;
}

export function convertSubstrateVolumeLToMassKg(
  substrate: SubstratePhysicalProfile,
  volumeL: number
): number {
  assertNonNegativeFinite(volumeL, 'volumeL');

  return volumeL / substrate.densityFactor_L_per_kg;
}

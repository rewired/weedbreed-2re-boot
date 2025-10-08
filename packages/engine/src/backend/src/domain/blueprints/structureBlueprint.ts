import { z } from 'zod';

import { createFiniteNumber, createNonEmptyString } from '../schemas/primitives.ts';
import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.ts';

const slugSchema = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).');

const finiteFootprintNumber = createFiniteNumber({ message: 'Number must be finite.' });

const footprintSchema = z
  .object({
    length_m: finiteFootprintNumber.positive('footprint.length_m must be positive.'),
    width_m: finiteFootprintNumber.positive('footprint.width_m must be positive.'),
    height_m: finiteFootprintNumber.positive('footprint.height_m must be positive.')
  })
  .strict();

const structureBlueprintSchema = z
  .object({
    id: z.string().uuid('Structure blueprint id must be a UUID v4.'),
    slug: slugSchema,
    class: z.literal('structure', {
      invalid_type_error: 'class must be the canonical "structure" domain value.'
    }),
    name: createNonEmptyString({ message: 'Structure name must not be empty.' }),
    footprint: footprintSchema,
    rentalCostPerSqmPerMonth: createFiniteNumber({
      requiredError: 'rentalCostPerSqmPerMonth is required.',
      message: 'rentalCostPerSqmPerMonth must be a finite number.'
    })
      .min(0, 'rentalCostPerSqmPerMonth must be >= 0.'),
    upfrontFee: createFiniteNumber({
      requiredError: 'upfrontFee is required.',
      message: 'upfrontFee must be a finite number.'
    })
      .min(0, 'upfrontFee must be >= 0.'),
    structureType: createNonEmptyString({ message: 'structureType must not be empty.' })
  })
  .strict();

export type StructureBlueprint = z.infer<typeof structureBlueprintSchema>;

export interface ParseStructureBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export function parseStructureBlueprint(
  input: unknown,
  options: ParseStructureBlueprintOptions = {}
): StructureBlueprint {
  const blueprint = structureBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

export { structureBlueprintSchema };

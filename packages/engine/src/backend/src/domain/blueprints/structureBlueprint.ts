import { z } from 'zod';

import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.js';

const slugSchema = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).');

const footprintSchema = z
  .object({
    length_m: z.number().finite().positive('footprint.length_m must be positive.'),
    width_m: z.number().finite().positive('footprint.width_m must be positive.'),
    height_m: z.number().finite().positive('footprint.height_m must be positive.')
  })
  .strict();

const structureBlueprintSchema = z
  .object({
    id: z.string().uuid('Structure blueprint id must be a UUID v4.'),
    slug: slugSchema,
    class: z.literal('structure', {
      invalid_type_error: 'class must be the canonical "structure" domain value.'
    }),
    name: z.string().trim().min(1, 'Structure name must not be empty.'),
    footprint: footprintSchema,
    rentalCostPerSqmPerMonth: z
      .number({ required_error: 'rentalCostPerSqmPerMonth is required.' })
      .finite('rentalCostPerSqmPerMonth must be a finite number.')
      .min(0, 'rentalCostPerSqmPerMonth must be >= 0.'),
    upfrontFee: z
      .number({ required_error: 'upfrontFee is required.' })
      .finite('upfrontFee must be a finite number.')
      .min(0, 'upfrontFee must be >= 0.'),
    structureType: z.string().trim().min(1, 'structureType must not be empty.')
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

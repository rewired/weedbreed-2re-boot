import { z } from 'zod';

import { createFiniteNumber } from '../schemas/primitives.ts';
import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.ts';

export interface ContainerBlueprintMeta {
  readonly description?: string;
  readonly advantages?: readonly string[];
  readonly disadvantages?: readonly string[];
}

export interface ContainerBlueprint {
  readonly id: string;
  readonly slug: string;
  readonly class: 'container';
  readonly name: string;
  readonly volumeInLiters: number;
  readonly footprintArea: number;
  readonly reusableCycles?: number;
  readonly packingDensity?: number;
  readonly meta?: ContainerBlueprintMeta;
  readonly containerType?: string;
}

const containerBlueprintMetaSchema = z
  .object({
    description: z.string().optional(),
    advantages: z.array(z.string()).optional(),
    disadvantages: z.array(z.string()).optional()
  })
  .partial();

const finiteContainerNumber = createFiniteNumber({ message: 'Number must be finite.' });

const containerBlueprintSchema = z
  .object({
    id: z.string().uuid('Container blueprint id must be a UUID v4.'),
    slug: z
      .string({ required_error: 'slug is required.' })
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).'),
    class: z.literal('container', {
      invalid_type_error: 'class must be the canonical "container" domain value.'
    }),
    name: z.string().min(1, 'Container blueprint name must not be empty.'),
    volumeInLiters: finiteContainerNumber.positive('volumeInLiters must be a positive number.'),
    footprintArea: finiteContainerNumber.positive('footprintArea must be a positive number.'),
    reusableCycles: z.number().int().min(1).optional(),
    packingDensity: finiteContainerNumber.positive('packingDensity must be positive.').optional(),
    meta: containerBlueprintMetaSchema.optional(),
    containerType: z.string().optional()
  })
  .strict();

export interface ParseContainerBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export function parseContainerBlueprint(
  input: unknown,
  options: ParseContainerBlueprintOptions = {}
): ContainerBlueprint {
  const blueprint = containerBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

export { containerBlueprintSchema };

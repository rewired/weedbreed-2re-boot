import { z } from 'zod';

import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.js';

const slugString = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase, digits, hyphen).');

const nonEmptyString = z
  .string({ required_error: 'value is required.' })
  .trim()
  .min(1, 'String fields must not be empty.');

const classSchema = z.literal('irrigation', {
  required_error: 'class is required.',
  invalid_type_error: 'class must be the canonical "irrigation" domain value.'
});

const irrigationMethodSchema = z.enum(
  ['drip', 'ebb-flow', 'manual', 'top-feed', 'spray', 'aeroponic', 'deep-water', 'wick', 'nutrient-film', 'overhead'],
  {
    invalid_type_error: 'method must be a recognised irrigation method.'
  }
);

const irrigationControlSchema = z.enum(
  [
    'inline-fertigation',
    'table',
    'can',
    'timer',
    'hand',
    'automated',
    'gravity',
    'pulse',
    'pressure-compensated'
  ],
  {
    invalid_type_error: 'control must be a recognised irrigation control strategy.'
  }
);

const compatibilitySchema = z.object({
  substrates: z
    .array(slugString, {
      required_error: 'compatibility.substrates is required.',
      invalid_type_error: 'compatibility.substrates must be an array of substrate slugs.'
    })
    .min(1, 'compatibility.substrates must contain at least one substrate slug.')
    .readonly(),
  methods: z
    .array(nonEmptyString, {
      invalid_type_error: 'compatibility.methods must be an array of strings.'
    })
    .readonly()
    .default([])
});

const irrigationBlueprintBaseSchema = z
  .object({
    id: z.string().uuid('Irrigation blueprint id must be a UUID v4.'),
    slug: slugString,
    class: classSchema,
    name: nonEmptyString,
    description: nonEmptyString.optional(),
    compatibility: compatibilitySchema,
    meta: z.record(z.unknown()).optional(),
    method: irrigationMethodSchema,
    control: irrigationControlSchema
  })
  .passthrough();

export type IrrigationBlueprint = z.infer<typeof irrigationBlueprintBaseSchema>;

export function createIrrigationBlueprintSchema(
  knownSubstrateSlugs: ReadonlySet<string>
): z.ZodType<IrrigationBlueprint> {
  return irrigationBlueprintBaseSchema.superRefine((blueprint, ctx) => {
    const { substrates } = blueprint.compatibility;

    substrates.forEach((substrateSlug, index) => {
      if (!knownSubstrateSlugs.has(substrateSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compatibility', 'substrates', index],
          message: `compatibility.substrates[${String(
            index
          )}] references unknown substrate slug "${substrateSlug}"`
        });
      }
    });
  });
}

export interface ParseIrrigationBlueprintOptions extends BlueprintPathOptions {
  readonly knownSubstrateSlugs: Iterable<string>;
  readonly filePath?: string;
}

export function parseIrrigationBlueprint(
  input: unknown,
  options: ParseIrrigationBlueprintOptions
): IrrigationBlueprint {
  if (!options?.knownSubstrateSlugs) {
    throw new Error('knownSubstrateSlugs must be provided to validate irrigation compatibility.');
  }

  const slugSet =
    options.knownSubstrateSlugs instanceof Set
      ? (options.knownSubstrateSlugs as ReadonlySet<string>)
      : new Set(options.knownSubstrateSlugs);

  const blueprint = createIrrigationBlueprintSchema(slugSet).parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

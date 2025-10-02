import { z } from 'zod';

const slugString = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase, digits, hyphen).');

const nonEmptyString = z
  .string({ required_error: 'value is required.' })
  .trim()
  .min(1, 'String fields must not be empty.');

const classSchema = z
  .string({ required_error: 'class is required.' })
  .regex(
    /^irrigation\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/,
    'class must begin with "irrigation." and use lowercase dot/kebab segments.'
  );

const compatibilitySchema = z.object({
  substrates: z
    .array(slugString, {
      required_error: 'compatibility.substrates is required.',
      invalid_type_error: 'compatibility.substrates must be an array of substrate slugs.'
    })
    .min(1, 'compatibility.substrates must contain at least one substrate slug.'),
  methods: z
    .array(nonEmptyString, {
      invalid_type_error: 'compatibility.methods must be an array of strings.'
    })
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
    meta: z.record(z.unknown()).optional()
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

export interface ParseIrrigationBlueprintOptions {
  readonly knownSubstrateSlugs: Iterable<string>;
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

  return createIrrigationBlueprintSchema(slugSet).parse(input);
}

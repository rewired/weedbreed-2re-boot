import { z } from 'zod';

import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.js';

const slugSchema = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).');

const nonEmptyString = z.string().trim().min(1, 'String values must not be empty.');
const probability01 = z
  .number({ invalid_type_error: 'Probability values must be numbers.' })
  .finite('Probability values must be finite.')
  .min(0, 'Probability values must be >= 0.')
  .max(1, 'Probability values must be <= 1.');

const tupleRangeSchema = z
  .array(z.number().finite('Range values must be finite numbers.'), {
    invalid_type_error: 'Ranges must be numeric arrays.'
  })
  .length(2, 'Ranges must contain exactly two numeric bounds.');

const environmentalRiskSchema = z
  .object({
    idealHumidityRange: tupleRangeSchema.optional(),
    humidityRange: tupleRangeSchema.optional(),
    temperatureRange: tupleRangeSchema.optional(),
    leafWetnessRequired: z.boolean().optional(),
    lowAirflowRisk: probability01.optional(),
    denseCanopyRisk: probability01.optional(),
    overcrowdingRisk: probability01.optional(),
    poorDrainageRisk: probability01.optional(),
    substrateWaterloggingRisk: probability01.optional(),
    woundEntryRisk: probability01.optional()
  })
  .strict();

const detectionSchema = z
  .object({
    symptoms: z.array(nonEmptyString).nonempty('Detection.symptoms must not be empty.'),
    scoutingHints: z.array(nonEmptyString).optional()
  })
  .strict();

const treatmentsSchema = z
  .object({
    cultural: z.array(nonEmptyString).optional(),
    mechanical: z.array(nonEmptyString).optional(),
    biological: z.array(nonEmptyString).optional(),
    chemical: z.array(nonEmptyString).optional()
  })
  .strict();

const modelSchema = z
  .object({
    dailyInfectionIncrement: probability01,
    infectionThreshold: probability01,
    degenerationRate: probability01,
    recoveryRate: probability01,
    regenerationRate: probability01,
    fatalityThreshold: probability01
  })
  .strict();

const yieldImpactSchema = z
  .object({
    budLossFractionPerDay: probability01
  })
  .strict();

const diseaseBlueprintSchema = z
  .object({
    id: z.string().uuid('Disease blueprint id must be a UUID v4.'),
    slug: slugSchema,
    class: z.literal('disease', {
      invalid_type_error: 'class must be the canonical "disease" domain value.'
    }),
    name: nonEmptyString,
    pathogenType: z.enum(['fungus', 'fungus-complex', 'bacteria', 'virus', 'viroid']),
    targets: z.array(nonEmptyString).nonempty('targets must not be empty.'),
    environmentalRisk: environmentalRiskSchema,
    transmission: z.array(nonEmptyString).nonempty('transmission must not be empty.'),
    contagious: z.boolean(),
    model: modelSchema,
    yieldImpact: yieldImpactSchema.optional(),
    detection: detectionSchema,
    treatments: treatmentsSchema,
    pathogen: nonEmptyString,
    syndrome: nonEmptyString
  })
  .strict();

export type DiseaseBlueprint = z.infer<typeof diseaseBlueprintSchema>;

export interface ParseDiseaseBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export function parseDiseaseBlueprint(
  input: unknown,
  options: ParseDiseaseBlueprintOptions = {}
): DiseaseBlueprint {
  const blueprint = diseaseBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

export { diseaseBlueprintSchema };

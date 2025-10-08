import { z } from 'zod';

import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.ts';

const slugSchema = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).');

const nonEmptyString = z.string().trim().min(1, 'String values must not be empty.');

const tupleRangeSchema = z
  .array(z.number().finite('Ranges must contain finite numbers.'), {
    invalid_type_error: 'Ranges must contain numeric bounds.'
  })
  .length(2, 'Ranges must contain exactly two numeric bounds.');

const probability01 = z
  .number({ invalid_type_error: 'Probability values must be numeric.' })
  .finite('Probability values must be finite.')
  .min(0, 'Probability values must be >= 0.')
  .max(1, 'Probability values must be <= 1.');

const environmentalRiskSchema = z
  .object({
    humidityRange: tupleRangeSchema.optional(),
    temperatureRange: tupleRangeSchema.optional(),
    overwateringRisk: probability01.optional(),
    overfertilizationRisk: probability01.optional(),
    lowAirflowRisk: probability01.optional(),
    dustyCanopyRisk: probability01.optional()
  })
  .strict();

const populationDynamicsSchema = z
  .object({
    dailyReproductionRate: z
      .number({ required_error: 'populationDynamics.dailyReproductionRate is required.' })
      .finite('populationDynamics.dailyReproductionRate must be finite.')
      .min(0, 'populationDynamics.dailyReproductionRate must be >= 0.'),
    dailyMortalityRate: z
      .number({ required_error: 'populationDynamics.dailyMortalityRate is required.' })
      .finite('populationDynamics.dailyMortalityRate must be finite.')
      .min(0, 'populationDynamics.dailyMortalityRate must be >= 0.'),
    carryingCapacity: z
      .number({ required_error: 'populationDynamics.carryingCapacity is required.' })
      .finite('populationDynamics.carryingCapacity must be finite.')
      .min(0, 'populationDynamics.carryingCapacity must be >= 0.')
  })
  .strict();

const damageModelSchema = z
  .object({
    photosynthesisReductionPerDay: probability01,
    rootUptakeReductionPerDay: probability01,
    budLossFractionPerDay: probability01,
    diseaseVectorRisk: probability01,
    honeydew: z.boolean()
  })
  .strict();

const detectionSchema = z
  .object({
    symptoms: z.array(nonEmptyString).nonempty('detection.symptoms must not be empty.'),
    monitoring: z.array(nonEmptyString).nonempty('detection.monitoring must not be empty.')
  })
  .strict();

const controlOptionsSchema = z
  .object({
    biological: z.array(nonEmptyString).optional(),
    cultural: z.array(nonEmptyString).optional(),
    mechanical: z.array(nonEmptyString).optional(),
    chemical: z.array(nonEmptyString).optional()
  })
  .strict();

const pestBlueprintSchema = z
  .object({
    id: z.string().uuid('Pest blueprint id must be a UUID v4.'),
    slug: slugSchema,
    class: z.literal('pest', {
      invalid_type_error: 'class must be the canonical "pest" domain value.'
    }),
    name: nonEmptyString,
    category: nonEmptyString,
    targets: z.array(nonEmptyString).nonempty('targets must not be empty.'),
    environmentalRisk: environmentalRiskSchema,
    populationDynamics: populationDynamicsSchema,
    damageModel: damageModelSchema,
    detection: detectionSchema,
    controlOptions: controlOptionsSchema,
    taxon: nonEmptyString,
    speciesGroup: nonEmptyString
  })
  .strict();

export type PestBlueprint = z.infer<typeof pestBlueprintSchema>;

export interface ParsePestBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export function parsePestBlueprint(
  input: unknown,
  options: ParsePestBlueprintOptions = {}
): PestBlueprint {
  const blueprint = pestBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

export { pestBlueprintSchema };

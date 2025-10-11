import { z } from 'zod';

import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.ts';

export interface CultivationMethodDefaults {
  readonly containerSlug?: string;
  readonly substrateSlug?: string;
}

export interface CultivationMethodMeta {
  readonly description?: string;
  readonly advantages?: readonly string[];
  readonly disadvantages?: readonly string[];
  readonly defaults?: CultivationMethodDefaults;
}

export interface CultivationMethodTraitCompatibilityRange {
  readonly min?: number;
  readonly max?: number;
}

export interface CultivationMethodTraitCompatibility {
  readonly preferred?: Record<string, CultivationMethodTraitCompatibilityRange>;
  readonly conflicting?: Record<string, CultivationMethodTraitCompatibilityRange>;
}

export interface CultivationMethodBlueprint {
  readonly id: string;
  readonly slug: string;
  readonly class: 'cultivation-method';
  readonly name: string;
  readonly laborIntensity?: number;
  readonly laborProfile?: { readonly hoursPerPlantPerWeek?: number };
  readonly areaPerPlant_m2?: number;
  readonly minimumSpacing?: number;
  readonly maxCycles?: number;
  readonly substrates: readonly string[];
  readonly containers: readonly string[];
  readonly strainTraitCompatibility?: CultivationMethodTraitCompatibility;
  readonly envBias?: Record<string, number>;
  readonly capacityHints?: { readonly plantsPer_m2?: number; readonly canopyHeight_m?: number };
  readonly idealConditions?: {
    readonly idealTemperature?: readonly [number, number];
    readonly idealHumidity?: readonly [number, number];
  };
  readonly meta?: CultivationMethodMeta;
  readonly family?: string;
  readonly technique?: string;
}

const laborProfileSchema = z.object({
  hoursPerPlantPerWeek: z.number().nonnegative().optional()
});

const compatibilityRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional()
});

const traitCompatibilitySchema = z
  .object({
    preferred: z.record(compatibilityRangeSchema).optional(),
    conflicting: z.record(compatibilityRangeSchema).optional()
  })
  .partial();

const envBiasSchema = z.record(z.number());

const capacityHintsSchema = z
  .object({
    plantsPer_m2: z.number().nonnegative().optional(),
    canopyHeight_m: z.number().nonnegative().optional()
  })
  .partial();

const climateRangeSchema = z.tuple([z.number(), z.number()]).readonly();

const idealConditionsSchema = z
  .object({
    idealTemperature: climateRangeSchema.optional(),
    idealHumidity: climateRangeSchema.optional()
  })
  .partial();

const cultivationMethodMetaSchema = z
  .object({
    description: z.string().optional(),
    advantages: z.array(z.string()).optional(),
    disadvantages: z.array(z.string()).optional(),
    defaults: z
      .object({
        containerSlug: z.string().optional(),
        substrateSlug: z.string().optional()
      })
      .partial()
      .optional()
  })
  .partial();

const cultivationMethodBlueprintSchema = z
  .object({
    id: z.string().uuid('Cultivation method blueprint id must be a UUID v4.'),
    slug: z
      .string({ required_error: 'slug is required.' })
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).'),
    class: z.literal('cultivation-method', {
      invalid_type_error: 'class must be the canonical "cultivation-method" domain value.'
    }),
    name: z.string().min(1, 'Cultivation method name must not be empty.'),
    laborIntensity: z.number().min(0).max(1).optional(),
    laborProfile: laborProfileSchema.optional(),
    areaPerPlant_m2: z.number().positive().optional(),
    minimumSpacing: z.number().positive().optional(),
    maxCycles: z.number().int().min(1).optional(),
    substrates: z.array(z.string()).min(1, 'At least one substrate is required.'),
    containers: z.array(z.string()).min(1, 'At least one container is required.'),
    strainTraitCompatibility: traitCompatibilitySchema.optional(),
    envBias: envBiasSchema.optional(),
    capacityHints: capacityHintsSchema.optional(),
    idealConditions: idealConditionsSchema.optional(),
    meta: cultivationMethodMetaSchema.optional(),
    family: z.string().optional(),
    technique: z.string().optional()
  })
  .strict();

export interface ParseCultivationMethodBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export function parseCultivationMethodBlueprint(
  input: unknown,
  options: ParseCultivationMethodBlueprintOptions = {}
): CultivationMethodBlueprint {
  const blueprint = cultivationMethodBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

export { cultivationMethodBlueprintSchema };

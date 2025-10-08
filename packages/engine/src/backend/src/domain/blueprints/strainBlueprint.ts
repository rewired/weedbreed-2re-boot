import { z } from 'zod';

import { assertBlueprintClassMatchesPath, type BlueprintPathOptions, deriveBlueprintClassFromPath } from './taxonomy.ts';

const finiteNumber = z.number().finite('Value must be a finite number.');
const positiveNumber = finiteNumber.gt(0, 'Value must be greater than zero.');
const nonEmptyString = z.string().trim().min(1, 'String fields must not be empty.');
const slugString = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase, digits, hyphen).');

const strainClassSchema = z.literal('strain', {
  required_error: 'class is required.',
  invalid_type_error: 'class must be the canonical "strain" domain value.'
});

const envRangeSchema = z
  .object({
    green: z
      .tuple([finiteNumber, finiteNumber], {
        invalid_type_error: 'green must be a tuple [min, max] of finite numbers.'
      })
      .superRefine(([min, max], ctx) => {
        if (!(min < max)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'green range must have min < max.',
            path: ['green']
          });
        }
      }),
    yellowLow: finiteNumber,
    yellowHigh: finiteNumber
  })
  .strict()
  .superRefine((value, ctx) => {
    const [greenMin, greenMax] = value.green;

    if (value.yellowLow >= greenMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'yellowLow must be strictly lower than the green range minimum.',
        path: ['yellowLow']
      });
    }

    if (value.yellowHigh <= greenMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'yellowHigh must be strictly higher than the green range maximum.',
        path: ['yellowHigh']
      });
    }
  });

const envConditionSchema = z
  .object({
    temp_C: envRangeSchema.optional(),
    rh_frac: envRangeSchema.optional(),
    co2_ppm: envRangeSchema.optional(),
    ppfd_umol_m2s: envRangeSchema.optional(),
    vpd_kPa: envRangeSchema.optional()
  })
  .strict();

const envBandsSchema = z
  .object({
    default: envConditionSchema,
    veg: envConditionSchema.optional(),
    flower: envConditionSchema.optional()
  })
  .strict();

const stressToleranceSchema = z
  .object({
    temp_C: positiveNumber,
    rh_frac: positiveNumber,
    co2_ppm: positiveNumber,
    ppfd_umol_m2s: positiveNumber,
    vpd_kPa: positiveNumber
  })
  .strict();

const growthModelTemperatureSchema = z
  .object({
    Q10: positiveNumber,
    T_ref_C: finiteNumber,
    min_C: finiteNumber,
    max_C: finiteNumber
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.min_C >= value.max_C) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'temperature.min_C must be lower than temperature.max_C.',
        path: ['min_C']
      });
    }
  });

const phaseMultiplierSchema = z
  .object({
    seedling: finiteNumber.min(0, 'seedling multiplier must be >= 0.').optional(),
    vegetation: finiteNumber.min(0, 'vegetation multiplier must be >= 0.'),
    flowering: finiteNumber.min(0, 'flowering multiplier must be >= 0.')
  })
  .strict();

const fraction01Schema = finiteNumber
  .min(0, 'Value must be >= 0.')
  .max(1, 'Value must be <= 1.');

const dryMatterFractionSchema = z.union([
  fraction01Schema,
  z
    .object({
      vegetation: fraction01Schema.optional(),
      flowering: fraction01Schema.optional()
    })
    .strict()
    .refine((value) => value.vegetation !== undefined || value.flowering !== undefined, {
      message: 'dryMatterFraction object must provide at least one stage value.'
    })
]);

const harvestIndexSchema = z.union([
  fraction01Schema,
  z
    .object({
      targetFlowering: fraction01Schema.optional()
    })
    .strict()
    .refine((value) => value.targetFlowering !== undefined, {
      message: 'harvestIndex object must provide targetFlowering.'
    })
]);

const growthModelSchema = z
  .object({
    maxBiomassDry: positiveNumber,
    baseLightUseEfficiency: positiveNumber.describe(
      'Kilograms of dry matter produced per mol of PAR; converted to grams in growth calculations.'
    ),
    maintenanceFracPerDay: finiteNumber.nonnegative(),
    dryMatterFraction: dryMatterFractionSchema,
    harvestIndex: harvestIndexSchema,
    phaseCapMultiplier: phaseMultiplierSchema.optional(),
    temperature: growthModelTemperatureSchema
  })
  .strict();

const phaseDurationsSchema = z
  .object({
    seedlingDays: z.number().int('seedlingDays must be an integer.').positive('seedlingDays must be positive.'),
    vegDays: z.number().int('vegDays must be an integer.').positive('vegDays must be positive.'),
    flowerDays: z.number().int('flowerDays must be an integer.').positive('flowerDays must be positive.'),
    ripeningDays: z.number().int('ripeningDays must be an integer.').positive('ripeningDays must be positive.')
  })
  .strict();

const stageThresholdSchema = z
  .object({
    minLightHours: positiveNumber,
    maxStressForStageChange: finiteNumber
      .min(0, 'maxStressForStageChange must be >= 0.')
      .max(1, 'maxStressForStageChange must be <= 1.')
  })
  .strict();

const stageChangeThresholdsSchema = z
  .object({
    vegetative: stageThresholdSchema,
    flowering: stageThresholdSchema
  })
  .strict();

const noiseConfigSchema = z
  .object({
    enabled: z.boolean(),
    pct: finiteNumber.min(0, 'noise.pct must be >= 0.').max(1, 'noise.pct must be <= 1.')
  })
  .strict();

const photoperiodSchema = z
  .object({
    vegetationTime: positiveNumber,
    floweringTime: positiveNumber,
    transitionTrigger: positiveNumber
  })
  .strict();

const strainBlueprintSchema = z
  .object({
    id: z.string().uuid('Strain blueprint id must be a UUID v4.'),
    slug: slugString,
    class: strainClassSchema,
    name: nonEmptyString,
    genotype: z.record(finiteNumber).optional(),
    generalResilience: finiteNumber.min(0, 'generalResilience must be >= 0.').max(1, 'generalResilience must be <= 1.'),
    germinationRate: finiteNumber.min(0, 'germinationRate must be >= 0.').max(1, 'germinationRate must be <= 1.'),
    chemotype: z.record(finiteNumber).optional(),
    morphology: z.record(finiteNumber).optional(),
    envBands: envBandsSchema,
    stressTolerance: stressToleranceSchema,
    growthModel: growthModelSchema,
    phaseDurations: phaseDurationsSchema,
    stageChangeThresholds: stageChangeThresholdsSchema,
    noise: noiseConfigSchema.optional(),
    photoperiod: photoperiodSchema
  })
  .passthrough();

export type EnvBand = z.infer<typeof envRangeSchema>;
export type EnvConditionBands = z.infer<typeof envConditionSchema>;
export type EnvBands = z.infer<typeof envBandsSchema>;
export type StressTolerance = z.infer<typeof stressToleranceSchema>;
export type GrowthModel = z.infer<typeof growthModelSchema>;
export type DryMatterFractionConfig = z.infer<typeof dryMatterFractionSchema>;
export type HarvestIndexConfig = z.infer<typeof harvestIndexSchema>;
export type PhaseDurations = z.infer<typeof phaseDurationsSchema>;
export type StageChangeThresholds = z.infer<typeof stageChangeThresholdsSchema>;
export type NoiseConfig = z.infer<typeof noiseConfigSchema>;
export type PhotoperiodConfig = z.infer<typeof photoperiodSchema>;
export type StrainBlueprint = z.infer<typeof strainBlueprintSchema>;

export interface ParseStrainBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
  readonly slugRegistry?: Map<string, string>;
}

export function parseStrainBlueprint(
  input: unknown,
  options: ParseStrainBlueprintOptions = {}
): StrainBlueprint {
  const blueprint = strainBlueprintSchema.parse(input);

  let relativePath: string | undefined;

  if (options.filePath) {
    const derived = deriveBlueprintClassFromPath(options.filePath, options);
    relativePath = derived.relativePath;
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  if (options.slugRegistry) {
    const registry = options.slugRegistry;
    const key = `${blueprint.class}:${blueprint.slug}`;
    const conflict = registry.get(key);

    if (conflict) {
      const location = relativePath ?? options.filePath ?? blueprint.id;
      throw new Error(
        `Duplicate strain slug "${blueprint.slug}" for class "${blueprint.class}" found in ${location}; first defined in ${conflict}.`
      );
    }

    registry.set(key, relativePath ?? options.filePath ?? blueprint.id);
  }

  return blueprint;
}

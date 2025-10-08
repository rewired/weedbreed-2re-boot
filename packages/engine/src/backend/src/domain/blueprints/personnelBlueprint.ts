import { z } from 'zod';

import { createFiniteNumber, createNonEmptyString } from '../schemas/primitives.ts';
import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.ts';

const slugSchema = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).');

const nonEmptyString = createNonEmptyString({ message: 'String values must not be empty.' });

const probability01 = createFiniteNumber({
  invalidTypeError: 'Probability values must be numbers.',
  message: 'Probability values must be finite.'
})
  .min(0, 'Probability values must be >= 0.')
  .max(1, 'Probability values must be <= 1.');

const numericRangeSchema = z
  .object({
    min: createFiniteNumber({ message: 'range.min must be finite.' }),
    max: createFiniteNumber({ message: 'range.max must be finite.' })
  })
  .strict();

const salarySchema = z
  .object({
    basePerTick: createFiniteNumber({
      requiredError: 'salary.basePerTick is required.',
      message: 'salary.basePerTick must be finite.'
    })
      .min(0, 'salary.basePerTick must be >= 0.'),
    skillFactor: z
      .object({
        base: createFiniteNumber({ message: 'skillFactor.base must be finite.' }),
        perPoint: createFiniteNumber({ message: 'skillFactor.perPoint must be finite.' }),
        min: createFiniteNumber({ message: 'skillFactor.min must be finite.' }),
        max: createFiniteNumber({ message: 'skillFactor.max must be finite.' })
      })
      .strict(),
    randomRange: numericRangeSchema,
    skillWeights: z
      .object({
        primary: createFiniteNumber({ message: 'skillWeights.primary must be finite.' }),
        secondary: createFiniteNumber({ message: 'skillWeights.secondary must be finite.' }),
        tertiary: createFiniteNumber({ message: 'skillWeights.tertiary must be finite.' })
      })
      .strict()
  })
  .strict();

const skillRollSchema = z
  .object({
    min: createFiniteNumber({ message: 'skillProfile.roll.min must be finite.' }),
    max: createFiniteNumber({ message: 'skillProfile.roll.max must be finite.' })
  })
  .strict();

const skillCandidateSchema = z
  .object({
    skill: nonEmptyString,
    startingLevel: createFiniteNumber({
      message: 'skillProfile.candidate.startingLevel must be finite.'
    }),
    weight: createFiniteNumber({
      message: 'skillProfile.candidate.weight must be finite.'
    }).optional()
  })
  .strict();

const skillProfileEntrySchema = z
  .object({
    skill: nonEmptyString,
    startingLevel: createFiniteNumber({ message: 'skillProfile.startingLevel must be finite.' }),
    roll: skillRollSchema
  })
  .strict();

const tertiarySkillProfileSchema = z
  .object({
    chance: probability01.optional(),
    roll: skillRollSchema,
    candidates: z.array(skillCandidateSchema).nonempty('tertiary.candidates must not be empty.').optional()
  })
  .strict();

const skillProfileSchema = z
  .object({
    primary: skillProfileEntrySchema,
    secondary: skillProfileEntrySchema,
    tertiary: tertiarySkillProfileSchema.optional()
  })
  .strict();

const personnelRoleClassSchema = z
  .string({ required_error: 'class is required.' })
  .regex(
    /^personnel\.role(?:\.[a-z0-9]+)+$/,
    'class must use the "personnel.role.<slug>" taxonomy namespace.'
  );

const personnelRoleBlueprintSchema = z
  .object({
    id: nonEmptyString,
    slug: slugSchema,
    class: personnelRoleClassSchema,
    name: nonEmptyString,
    salary: salarySchema,
    maxMinutesPerTick: createFiniteNumber({
      requiredError: 'maxMinutesPerTick is required.',
      message: 'maxMinutesPerTick must be finite.'
    })
      .min(0, 'maxMinutesPerTick must be >= 0.'),
    roleWeight: createFiniteNumber({
      requiredError: 'roleWeight is required.',
      message: 'roleWeight must be finite.'
    })
      .min(0, 'roleWeight must be >= 0.'),
    preferredShiftId: nonEmptyString.optional(),
    skillProfile: skillProfileSchema
  })
  .strict();

const personnelSkillClassSchema = z
  .string({ required_error: 'class is required.' })
  .regex(
    /^personnel\.skill(?:\.[a-z0-9]+)+$/,
    'class must use the "personnel.skill.<slug>" taxonomy namespace.'
  );

const personnelSkillBlueprintSchema = z
  .object({
    id: nonEmptyString,
    slug: slugSchema,
    class: personnelSkillClassSchema,
    name: nonEmptyString,
    description: nonEmptyString.optional(),
    tags: z.array(nonEmptyString).optional()
  })
  .strict();

export type PersonnelRoleBlueprint = z.infer<typeof personnelRoleBlueprintSchema>;
export type PersonnelSkillBlueprint = z.infer<typeof personnelSkillBlueprintSchema>;

export interface ParsePersonnelBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export function parsePersonnelRoleBlueprint(
  input: unknown,
  options: ParsePersonnelBlueprintOptions = {}
): PersonnelRoleBlueprint {
  const blueprint = personnelRoleBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

export function parsePersonnelSkillBlueprint(
  input: unknown,
  options: ParsePersonnelBlueprintOptions = {}
): PersonnelSkillBlueprint {
  const blueprint = personnelSkillBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

export { personnelRoleBlueprintSchema, personnelSkillBlueprintSchema };

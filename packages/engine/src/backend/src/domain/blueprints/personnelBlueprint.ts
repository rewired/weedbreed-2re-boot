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

const numericRangeSchema = z
  .object({
    min: z.number().finite('range.min must be finite.'),
    max: z.number().finite('range.max must be finite.')
  })
  .strict();

const salarySchema = z
  .object({
    basePerTick: z
      .number({ required_error: 'salary.basePerTick is required.' })
      .finite('salary.basePerTick must be finite.')
      .min(0, 'salary.basePerTick must be >= 0.'),
    skillFactor: z
      .object({
        base: z.number().finite('skillFactor.base must be finite.'),
        perPoint: z.number().finite('skillFactor.perPoint must be finite.'),
        min: z.number().finite('skillFactor.min must be finite.'),
        max: z.number().finite('skillFactor.max must be finite.')
      })
      .strict(),
    randomRange: numericRangeSchema,
    skillWeights: z
      .object({
        primary: z.number().finite('skillWeights.primary must be finite.'),
        secondary: z.number().finite('skillWeights.secondary must be finite.'),
        tertiary: z.number().finite('skillWeights.tertiary must be finite.')
      })
      .strict()
  })
  .strict();

const skillRollSchema = z
  .object({
    min: z.number().finite('skillProfile.roll.min must be finite.'),
    max: z.number().finite('skillProfile.roll.max must be finite.')
  })
  .strict();

const skillCandidateSchema = z
  .object({
    skill: nonEmptyString,
    startingLevel: z.number().finite('skillProfile.candidate.startingLevel must be finite.'),
    weight: z.number().finite('skillProfile.candidate.weight must be finite.').optional()
  })
  .strict();

const skillProfileEntrySchema = z
  .object({
    skill: nonEmptyString,
    startingLevel: z.number().finite('skillProfile.startingLevel must be finite.'),
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
    maxMinutesPerTick: z
      .number({ required_error: 'maxMinutesPerTick is required.' })
      .finite('maxMinutesPerTick must be finite.')
      .min(0, 'maxMinutesPerTick must be >= 0.'),
    roleWeight: z
      .number({ required_error: 'roleWeight is required.' })
      .finite('roleWeight must be finite.')
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

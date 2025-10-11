import { z } from 'zod';

import { 
  HOURS_PER_DAY,
  MIN_BASE_RATE_MULTIPLIER,
  MAX_BASE_RATE_MULTIPLIER,
  MIN_HOURS_PER_DAY,
  MAX_HOURS_PER_DAY,
  MAX_OVERTIME_HOURS_PER_DAY,
  MAX_DAYS_PER_WEEK,
  MIN_LABOR_MARKET_FACTOR,
  MAX_LABOR_MARKET_FACTOR,
  MIN_TIME_PREMIUM_MULTIPLIER,
  MAX_TIME_PREMIUM_MULTIPLIER,
  MIN_MAIN_SKILL_VALUE,
  MAX_MAIN_SKILL_VALUE,
  MIN_SECONDARY_SKILL_VALUE,
  MAX_SECONDARY_SKILL_VALUE,
  MIN_TRAIT_STRENGTH,
  MAX_TRAIT_STRENGTH
} from '../../constants/simConstants.ts';
import { finiteNumber, integerNumber, nonEmptyString, uuidSchema } from './primitives.ts';
import { domainEntitySchema, sluggedEntitySchema, zeroToOneNumber } from './base.ts';
import type {
  Employee,
  EmployeeExperience,
  EmployeeRaiseState,
  EmployeeRngSeedUuid,
  EmployeeSchedule,
  EmployeeSkillLevel,
  EmployeeSkillTriad,
} from '../workforce/Employee.ts';
import type { EmployeeTraitAssignment } from '../workforce/traits.ts';
import type { EmployeeRole, EmployeeSkillRequirement } from '../workforce/EmployeeRole.ts';
import type {
  WorkforceMarketCandidate,
  WorkforceMarketCandidateSkill,
  WorkforceMarketCandidateTrait,
  WorkforceMarketState,
  WorkforceMarketStructureState,
  WorkforceState,
} from '../workforce/WorkforceState.ts';
import type { WorkforceKpiSnapshot } from '../workforce/kpis.ts';
import type { WorkforceWarning } from '../workforce/warnings.ts';
import type {
  WorkforceTaskCostModel,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
} from '../workforce/tasks.ts';

const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidV7Schema: z.ZodBranded<string, EmployeeRngSeedUuid> = z
  .string()
  .regex(uuidV7Pattern, 'Expected a UUID v7 identifier.')
  .brand<EmployeeRngSeedUuid>();

export const employeeSkillRequirementSchema: z.ZodType<EmployeeSkillRequirement> = z.object({
  skillKey: nonEmptyString,
  minSkill01: zeroToOneNumber,
});

export const employeeRoleSchema: z.ZodType<EmployeeRole> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .extend({
    description: nonEmptyString.optional(),
    coreSkills: z.array(employeeSkillRequirementSchema).readonly().default([]),
    tags: z.array(nonEmptyString).readonly().optional(),
    baseRateMultiplier: finiteNumber
      .min(MIN_BASE_RATE_MULTIPLIER, 'baseRateMultiplier must be positive when provided.')
      .max(MAX_BASE_RATE_MULTIPLIER, 'baseRateMultiplier must not exceed 10.')
      .optional(),
  });

export const employeeSkillLevelSchema: z.ZodType<EmployeeSkillLevel> = z.object({
  skillKey: nonEmptyString,
  level01: zeroToOneNumber,
});

export const employeeSkillTriadSchema: z.ZodType<EmployeeSkillTriad> = z.object({
  main: employeeSkillLevelSchema,
  secondary: z.tuple([employeeSkillLevelSchema, employeeSkillLevelSchema]).readonly(),
});

export const employeeTraitAssignmentSchema: z.ZodType<EmployeeTraitAssignment> = z.object({
  traitId: nonEmptyString,
  strength01: zeroToOneNumber,
});

export const employeeScheduleSchema: z.ZodType<EmployeeSchedule> = z.object({
  hoursPerDay: finiteNumber
    .min(MIN_HOURS_PER_DAY, 'hoursPerDay must be at least 5 hours.')
    .max(MAX_HOURS_PER_DAY, 'hoursPerDay must not exceed 16 hours.'),
  overtimeHoursPerDay: finiteNumber
    .min(0, 'overtimeHoursPerDay cannot be negative.')
    .max(MAX_OVERTIME_HOURS_PER_DAY, 'overtimeHoursPerDay must not exceed 5 hours.'),
  daysPerWeek: finiteNumber
    .min(1, 'daysPerWeek must be at least 1.')
    .max(MAX_DAYS_PER_WEEK, 'daysPerWeek must not exceed 7.'),
  shiftStartHour: finiteNumber
    .min(0, 'shiftStartHour cannot be negative.')
    .max(HOURS_PER_DAY - 1, `shiftStartHour must be < ${String(HOURS_PER_DAY)}.`)
    .optional(),
});

const employeeExperienceSchema: z.ZodType<EmployeeExperience> = z
  .object({
    hoursAccrued: finiteNumber.min(0, 'hoursAccrued cannot be negative.'),
    level01: zeroToOneNumber,
  })
  .strict();

const employeeRaiseStateSchema: z.ZodType<EmployeeRaiseState> = z
  .object({
    lastDecisionDay: finiteNumber
      .min(0, 'lastDecisionDay cannot be negative.')
      .transform((value) => Math.trunc(value))
      .optional(),
    nextEligibleDay: finiteNumber
      .min(0, 'nextEligibleDay cannot be negative.')
      .transform((value) => Math.trunc(value))
      .optional(),
    cadenceSequence: integerNumber.min(0, 'cadenceSequence cannot be negative.'),
  })
  .strict();

export const employeeSchema: z.ZodType<Employee> = domainEntitySchema.extend({
  roleId: uuidSchema,
  rngSeedUuid: uuidV7Schema,
  assignedStructureId: uuidSchema,
  morale01: zeroToOneNumber,
  fatigue01: zeroToOneNumber,
  skills: z.array(employeeSkillLevelSchema).readonly(),
  skillTriad: employeeSkillTriadSchema.optional(),
  traits: z.array(employeeTraitAssignmentSchema).readonly().default([]),
  developmentPlan: z.array(employeeSkillRequirementSchema).readonly().optional(),
  schedule: employeeScheduleSchema,
  notes: nonEmptyString.optional(),
  baseRateMultiplier: finiteNumber
    .min(MIN_BASE_RATE_MULTIPLIER, 'baseRateMultiplier must be at least 0.1.')
    .max(MAX_BASE_RATE_MULTIPLIER, 'baseRateMultiplier must not exceed 10.'),
  experience: employeeExperienceSchema,
  laborMarketFactor: finiteNumber
    .min(MIN_LABOR_MARKET_FACTOR, 'laborMarketFactor must be at least 0.1.')
    .max(MAX_LABOR_MARKET_FACTOR, 'laborMarketFactor must not exceed 10.'),
  timePremiumMultiplier: finiteNumber
    .min(MIN_TIME_PREMIUM_MULTIPLIER, 'timePremiumMultiplier must be at least 0.5.')
    .max(MAX_TIME_PREMIUM_MULTIPLIER, 'timePremiumMultiplier must not exceed 5.'),
  employmentStartDay: finiteNumber
    .min(0, 'employmentStartDay cannot be negative.')
    .transform((value) => Math.trunc(value)),
  salaryExpectation_per_h: finiteNumber.min(
    0,
    'salaryExpectation_per_h cannot be negative.',
  ),
  raise: employeeRaiseStateSchema,
});

export const employeeCollectionSchema = z.array(employeeSchema).readonly();

export const employeeRoleCollectionSchema = z.array(employeeRoleSchema).readonly();

export const workforceTaskCostBasisSchema = z.enum(['perAction', 'perPlant', 'perSquareMeter']);

export const workforceTaskCostModelSchema: z.ZodType<WorkforceTaskCostModel> = z.object({
  basis: workforceTaskCostBasisSchema,
  laborMinutes: finiteNumber.min(0, 'laborMinutes cannot be negative.'),
});

export const workforceTaskDefinitionSchema: z.ZodType<WorkforceTaskDefinition> = z.object({
  taskCode: nonEmptyString,
  description: nonEmptyString,
  requiredRoleSlug: nonEmptyString,
  requiredSkills: z.array(employeeSkillRequirementSchema).readonly().default([]),
  priority: finiteNumber,
  costModel: workforceTaskCostModelSchema,
});

export const workforceTaskInstanceSchema: z.ZodType<WorkforceTaskInstance> = z.object({
  id: uuidSchema,
  taskCode: nonEmptyString,
  status: z.enum(['queued', 'in-progress', 'completed', 'cancelled']),
  createdAtTick: finiteNumber
    .min(0, 'createdAtTick cannot be negative.')
    .transform((value) => Math.trunc(value)),
  dueTick: finiteNumber
    .min(0, 'dueTick cannot be negative.')
    .transform((value) => Math.trunc(value))
    .optional(),
  assignedEmployeeId: uuidSchema.optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const workforceKpiSnapshotSchema: z.ZodType<WorkforceKpiSnapshot> = z.object({
  simTimeHours: finiteNumber
    .min(0, 'simTimeHours cannot be negative.')
    .transform((value) => Math.trunc(value)),
  tasksCompleted: finiteNumber
    .min(0, 'tasksCompleted cannot be negative.')
    .transform((value) => Math.trunc(value)),
  queueDepth: finiteNumber
    .min(0, 'queueDepth cannot be negative.')
    .transform((value) => Math.trunc(value)),
  laborHoursCommitted: finiteNumber.min(0, 'laborHoursCommitted cannot be negative.'),
  overtimeHoursCommitted: finiteNumber.min(0, 'overtimeHoursCommitted cannot be negative.'),
  overtimeMinutes: finiteNumber.min(0, 'overtimeMinutes cannot be negative.'),
  utilization01: zeroToOneNumber,
  p95WaitTimeHours: finiteNumber.min(0, 'p95WaitTimeHours cannot be negative.'),
  maintenanceBacklog: finiteNumber
    .min(0, 'maintenanceBacklog cannot be negative.')
    .transform((value) => Math.trunc(value)),
  averageMorale01: zeroToOneNumber,
  averageFatigue01: zeroToOneNumber,
});

const workforceWarningSeveritySchema = z.enum(['info', 'warning', 'critical']);

export const workforceWarningSchema: z.ZodType<WorkforceWarning> = z
  .object({
    simTimeHours: finiteNumber
      .min(0, 'simTimeHours cannot be negative.')
      .transform((value) => Math.trunc(value)),
    code: nonEmptyString,
    message: nonEmptyString,
    severity: workforceWarningSeveritySchema,
    structureId: uuidSchema.optional(),
    employeeId: uuidSchema.optional(),
    taskId: uuidSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const workforcePayrollTotalsSchema = z
  .object({
    baseMinutes: finiteNumber.min(0, 'baseMinutes cannot be negative.'),
    otMinutes: finiteNumber.min(0, 'otMinutes cannot be negative.'),
    baseCost: finiteNumber.min(0, 'baseCost cannot be negative.'),
    otCost: finiteNumber.min(0, 'otCost cannot be negative.'),
    totalLaborCost: finiteNumber.min(0, 'totalLaborCost cannot be negative.'),
  })
  .strict();

const workforceStructurePayrollTotalsSchema = workforcePayrollTotalsSchema.extend({
  structureId: uuidSchema,
});

const workforcePayrollStateSchema = z
  .object({
    dayIndex: finiteNumber
      .min(0, 'dayIndex cannot be negative.')
      .transform((value) => Math.trunc(value)),
    totals: workforcePayrollTotalsSchema,
    byStructure: z.array(workforceStructurePayrollTotalsSchema).readonly(),
  })
  .strict();

const workforceMarketCandidateSkillSchema: z.ZodType<WorkforceMarketCandidateSkill> = z
  .object({
    slug: nonEmptyString,
    value01: zeroToOneNumber,
  })
  .strict();

const workforceMarketMainSkillSchema: z.ZodType<WorkforceMarketCandidateSkill> =
  workforceMarketCandidateSkillSchema.extend({
    value01: zeroToOneNumber
      .min(MIN_MAIN_SKILL_VALUE, 'Main skill must be at least 0.25.')
      .max(MAX_MAIN_SKILL_VALUE, 'Main skill must not exceed 0.50.'),
  });

const workforceMarketSecondarySkillSchema: z.ZodType<WorkforceMarketCandidateSkill> =
  workforceMarketCandidateSkillSchema.extend({
    value01: zeroToOneNumber
      .min(MIN_SECONDARY_SKILL_VALUE, 'Secondary skills must be at least 0.01.')
      .max(MAX_SECONDARY_SKILL_VALUE, 'Secondary skills must not exceed 0.35.'),
  });

const workforceMarketCandidateTraitSchema: z.ZodType<WorkforceMarketCandidateTrait> = z
  .object({
    id: nonEmptyString,
    strength01: zeroToOneNumber
      .min(MIN_TRAIT_STRENGTH, 'Trait strength must be at least 0.3.')
      .max(MAX_TRAIT_STRENGTH, 'Trait strength must not exceed 0.7.'),
  })
  .strict();

const workforceMarketCandidateSkillsSchema: z.ZodType<WorkforceMarketCandidate['skills3']> = z
  .object({
    main: workforceMarketMainSkillSchema,
    secondary: z
      .tuple([
        workforceMarketSecondarySkillSchema,
        workforceMarketSecondarySkillSchema,
      ])
      .readonly(),
  })
  .strict();

const workforceMarketCandidateSchema: z.ZodType<WorkforceMarketCandidate> = z
  .object({
    id: uuidSchema,
    structureId: uuidSchema,
    roleSlug: nonEmptyString,
    skills3: workforceMarketCandidateSkillsSchema,
    traits: z.array(workforceMarketCandidateTraitSchema).readonly(),
    expectedBaseRate_per_h: finiteNumber.min(0, 'Hourly rate must be non-negative.').optional(),
    validUntilScanCounter: integerNumber.min(
      0,
      'validUntilScanCounter cannot be negative.'
    ),
    scanCounter: integerNumber.min(0, 'scanCounter cannot be negative.'),
  })
  .strict();

const workforceMarketStructureStateSchema: z.ZodType<WorkforceMarketStructureState> = z
  .object({
    structureId: uuidSchema,
    lastScanDay: integerNumber.min(0, 'lastScanDay cannot be negative.').optional(),
    scanCounter: integerNumber.min(0, 'scanCounter cannot be negative.'),
    pool: z.array(workforceMarketCandidateSchema).readonly(),
  })
  .strict();

const workforceMarketStateSchema: z.ZodType<WorkforceMarketState> = z
  .object({
    structures: z.array(workforceMarketStructureStateSchema).readonly(),
  })
  .strict();

export const workforceStateSchema: z.ZodType<WorkforceState> = z.object({
  roles: employeeRoleCollectionSchema,
  employees: employeeCollectionSchema,
  taskDefinitions: z.array(workforceTaskDefinitionSchema).readonly(),
  taskQueue: z.array(workforceTaskInstanceSchema).readonly(),
  kpis: z.array(workforceKpiSnapshotSchema).readonly(),
  warnings: z.array(workforceWarningSchema).readonly(),
  payroll: workforcePayrollStateSchema,
  market: workforceMarketStateSchema,
});

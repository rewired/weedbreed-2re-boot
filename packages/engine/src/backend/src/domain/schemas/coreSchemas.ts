import { z } from 'zod';

import {
  AIR_DENSITY_KG_PER_M3,
  AMBIENT_CO2_PPM,
  FLOAT_TOLERANCE,
  HOURS_PER_DAY,
  LATITUDE_MAX_DEG,
  LATITUDE_MIN_DEG,
  LONGITUDE_MAX_DEG,
  LONGITUDE_MIN_DEG,
  ROOM_DEFAULT_HEIGHT_M
} from '../constants/simConstants.js';
import {
  DEVICE_PLACEMENT_SCOPES,
  PLANT_LIFECYCLE_STAGES,
  ROOM_PURPOSES,
  type Company,
  type CompanyLocation,
  type DeviceMaintenancePolicy,
  type DeviceMaintenanceState,
  type DeviceMaintenanceWindow,
  type LightSchedule,
  type Plant,
  type Room,
  type RoomDeviceInstance,
  type Structure,
  type StructureDeviceInstance,
  type Zone,
  type ZoneDeviceInstance,
  type ZoneEnvironment
} from '../entities.js';
import { InventorySchema } from './InventorySchema.js';
import {
  finiteNumber,
  integerNumber,
  nonEmptyString,
  unitIntervalNumber,
  uuidSchema
} from './primitives.js';
import type {
  Employee,
  EmployeeExperience,
  EmployeeRaiseState,
  EmployeeRngSeedUuid,
  EmployeeSchedule,
  EmployeeSkillLevel,
  EmployeeSkillTriad,
} from '../workforce/Employee.js';
import type { EmployeeTraitAssignment } from '../workforce/traits.js';
import type { EmployeeRole, EmployeeSkillRequirement } from '../workforce/EmployeeRole.js';
import type {
  WorkforceMarketCandidate,
  WorkforceMarketCandidateSkill,
  WorkforceMarketCandidateTrait,
  WorkforceMarketState,
  WorkforceMarketStructureState,
  WorkforceState,
} from '../workforce/WorkforceState.js';
import type { WorkforceKpiSnapshot } from '../workforce/kpis.js';
import type { WorkforceWarning } from '../workforce/warnings.js';
import type {
  WorkforceTaskCostModel,
  WorkforceTaskDefinition,
  WorkforceTaskInstance
} from '../workforce/tasks.js';

const [STRUCTURE_SCOPE, ROOM_SCOPE, ZONE_SCOPE] = DEVICE_PLACEMENT_SCOPES;

const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidV7Schema: z.ZodBranded<string, EmployeeRngSeedUuid> = z
  .string()
  .regex(uuidV7Pattern, 'Expected a UUID v7 identifier.')
  .brand<EmployeeRngSeedUuid>();

const zeroToOneNumber = unitIntervalNumber;

const domainEntitySchema = z.object({
  id: uuidSchema,
  name: nonEmptyString
});

const sluggedEntitySchema = z.object({
  slug: nonEmptyString
});

const spatialEntitySchema = z.object({
  floorArea_m2: finiteNumber.positive('floorArea_m2 must be positive.'),
  height_m: finiteNumber.positive('height_m must be positive.').default(ROOM_DEFAULT_HEIGHT_M)
});

export const employeeSkillRequirementSchema: z.ZodType<EmployeeSkillRequirement> = z.object({
  skillKey: nonEmptyString,
  minSkill01: zeroToOneNumber
});

export const employeeRoleSchema: z.ZodType<EmployeeRole> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .extend({
    description: nonEmptyString.optional(),
    coreSkills: z.array(employeeSkillRequirementSchema).readonly().default([]),
    tags: z.array(nonEmptyString).readonly().optional(),
    baseRateMultiplier: finiteNumber
      .min(0.1, 'baseRateMultiplier must be positive when provided.')
      .max(10, 'baseRateMultiplier must not exceed 10.')
      .optional()
  });

export const employeeSkillLevelSchema: z.ZodType<EmployeeSkillLevel> = z.object({
  skillKey: nonEmptyString,
  level01: zeroToOneNumber
});

export const employeeSkillTriadSchema: z.ZodType<EmployeeSkillTriad> = z.object({
  main: employeeSkillLevelSchema,
  secondary: z
    .tuple([employeeSkillLevelSchema, employeeSkillLevelSchema])
    .readonly()
});

export const employeeTraitAssignmentSchema: z.ZodType<EmployeeTraitAssignment> = z.object({
  traitId: nonEmptyString,
  strength01: zeroToOneNumber
});

export const employeeScheduleSchema: z.ZodType<EmployeeSchedule> = z.object({
  hoursPerDay: finiteNumber
    .min(5, 'hoursPerDay must be at least 5 hours.')
    .max(16, 'hoursPerDay must not exceed 16 hours.'),
  overtimeHoursPerDay: finiteNumber
    .min(0, 'overtimeHoursPerDay cannot be negative.')
    .max(5, 'overtimeHoursPerDay must not exceed 5 hours.'),
  daysPerWeek: finiteNumber
    .min(1, 'daysPerWeek must be at least 1.')
    .max(7, 'daysPerWeek must not exceed 7.'),
  shiftStartHour: finiteNumber
    .min(0, 'shiftStartHour cannot be negative.')
    .max(HOURS_PER_DAY - 1, `shiftStartHour must be < ${String(HOURS_PER_DAY)}.`)
    .optional()
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
    .min(0.1, 'baseRateMultiplier must be at least 0.1.')
    .max(10, 'baseRateMultiplier must not exceed 10.'),
  experience: employeeExperienceSchema,
  laborMarketFactor: finiteNumber
    .min(0.1, 'laborMarketFactor must be at least 0.1.')
    .max(10, 'laborMarketFactor must not exceed 10.'),
  timePremiumMultiplier: finiteNumber
    .min(0.5, 'timePremiumMultiplier must be at least 0.5.')
    .max(5, 'timePremiumMultiplier must not exceed 5.'),
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
  laborMinutes: finiteNumber.min(0, 'laborMinutes cannot be negative.')
});

export const workforceTaskDefinitionSchema: z.ZodType<WorkforceTaskDefinition> = z.object({
  taskCode: nonEmptyString,
  description: nonEmptyString,
  requiredRoleSlug: nonEmptyString,
  requiredSkills: z.array(employeeSkillRequirementSchema).readonly().default([]),
  priority: finiteNumber,
  costModel: workforceTaskCostModelSchema
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
  context: z.record(z.string(), z.unknown()).optional()
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
  averageFatigue01: zeroToOneNumber
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
      .min(0.25, 'Main skill must be at least 0.25.')
      .max(0.5, 'Main skill must not exceed 0.50.'),
  });

const workforceMarketSecondarySkillSchema: z.ZodType<WorkforceMarketCandidateSkill> =
  workforceMarketCandidateSkillSchema.extend({
    value01: zeroToOneNumber
      .min(0.01, 'Secondary skills must be at least 0.01.')
      .max(0.35, 'Secondary skills must not exceed 0.35.'),
  });

const workforceMarketCandidateTraitSchema: z.ZodType<WorkforceMarketCandidateTrait> = z
  .object({
    id: nonEmptyString,
    strength01: zeroToOneNumber
      .min(0.3, 'Trait strength must be at least 0.3.')
      .max(0.7, 'Trait strength must not exceed 0.7.'),
  })
  .strict();

const workforceMarketCandidateSkillsSchema: z.ZodType<WorkforceMarketCandidate['skills3']> =
  z
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

export const companyLocationSchema: z.ZodType<CompanyLocation> = z.object({
  lon: finiteNumber
    .min(LONGITUDE_MIN_DEG, `Longitude must be >= ${String(LONGITUDE_MIN_DEG)}.`)
    .max(LONGITUDE_MAX_DEG, `Longitude must be <= ${String(LONGITUDE_MAX_DEG)}.`),
  lat: finiteNumber
    .min(LATITUDE_MIN_DEG, `Latitude must be >= ${String(LATITUDE_MIN_DEG)}.`)
    .max(LATITUDE_MAX_DEG, `Latitude must be <= ${String(LATITUDE_MAX_DEG)}.`),
  cityName: nonEmptyString,
  countryName: nonEmptyString
});

export const lightScheduleSchema: z.ZodType<LightSchedule> = z
  .object({
    onHours: finiteNumber
      .min(0, 'onHours cannot be negative.')
      .max(HOURS_PER_DAY, `onHours must be <= ${String(HOURS_PER_DAY)}.`),
    offHours: finiteNumber
      .min(0, 'offHours cannot be negative.')
      .max(HOURS_PER_DAY, `offHours must be <= ${String(HOURS_PER_DAY)}.`),
    startHour: finiteNumber
      .min(0, 'startHour cannot be negative.')
      .max(HOURS_PER_DAY, `startHour must be <= ${String(HOURS_PER_DAY)}.`)
  })
  .superRefine((schedule, ctx) => {
    if (
      Math.abs(schedule.onHours + schedule.offHours - HOURS_PER_DAY) > FLOAT_TOLERANCE
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Light schedules must allocate exactly ${String(HOURS_PER_DAY)} hours across on/off periods.`,
        path: []
      });
    }
  });

const deviceEffectLiteralSchema = z.enum(['thermal', 'humidity', 'lighting', 'airflow', 'filtration', 'sensor', 'co2']);

const deviceMaintenancePolicySchema: z.ZodType<DeviceMaintenancePolicy> = z
  .object({
    lifetimeHours: finiteNumber
      .min(1, 'maintenance.policy.lifetimeHours must be positive.')
      .default(1),
    maintenanceIntervalHours: finiteNumber
      .min(0, 'maintenance.policy.maintenanceIntervalHours cannot be negative.')
      .default(0),
    serviceHours: finiteNumber
      .min(0, 'maintenance.policy.serviceHours cannot be negative.')
      .default(0),
    restoreAmount01: finiteNumber
      .min(0, 'maintenance.policy.restoreAmount01 must be >= 0.')
      .max(1, 'maintenance.policy.restoreAmount01 must be <= 1.')
      .default(0),
    baseCostPerHourCc: finiteNumber
      .min(0, 'maintenance.policy.baseCostPerHourCc cannot be negative.')
      .default(0),
    costIncreasePer1000HoursCc: finiteNumber
      .min(0, 'maintenance.policy.costIncreasePer1000HoursCc cannot be negative.')
      .default(0),
    serviceVisitCostCc: finiteNumber
      .min(0, 'maintenance.policy.serviceVisitCostCc cannot be negative.')
      .default(0),
    replacementCostCc: finiteNumber
      .min(0, 'maintenance.policy.replacementCostCc cannot be negative.')
      .default(0),
    maintenanceConditionThreshold01: finiteNumber
      .min(0, 'maintenance.policy.maintenanceConditionThreshold01 must be >= 0.')
      .max(1, 'maintenance.policy.maintenanceConditionThreshold01 must be <= 1.')
      .default(0.5),
  })
  .strict();

const deviceMaintenanceWindowSchema: z.ZodType<DeviceMaintenanceWindow> = z
  .object({
    startTick: finiteNumber
      .min(0, 'maintenance.window.startTick cannot be negative.')
      .transform((value) => Math.trunc(value)),
    endTick: finiteNumber
      .min(0, 'maintenance.window.endTick cannot be negative.')
      .transform((value) => Math.trunc(value)),
    taskId: uuidSchema,
    reason: z.enum(['interval', 'condition']),
  })
  .superRefine((window, ctx) => {
    if (window.endTick <= window.startTick) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTick'],
        message: 'maintenance.window.endTick must be greater than startTick.',
      });
    }
  });

const deviceMaintenanceStateSchema: z.ZodType<DeviceMaintenanceState> = z
  .object({
    runtimeHours: finiteNumber.min(0, 'maintenance.runtimeHours cannot be negative.'),
    hoursSinceService: finiteNumber.min(0, 'maintenance.hoursSinceService cannot be negative.'),
    totalMaintenanceCostCc: finiteNumber.min(
      0,
      'maintenance.totalMaintenanceCostCc cannot be negative.',
    ),
    completedServiceCount: finiteNumber
      .min(0, 'maintenance.completedServiceCount cannot be negative.')
      .transform((value) => Math.trunc(value)),
    lastServiceScheduledTick: finiteNumber
      .min(0, 'maintenance.lastServiceScheduledTick cannot be negative.')
      .transform((value) => Math.trunc(value))
      .optional(),
    lastServiceCompletedTick: finiteNumber
      .min(0, 'maintenance.lastServiceCompletedTick cannot be negative.')
      .transform((value) => Math.trunc(value))
      .optional(),
    maintenanceWindow: deviceMaintenanceWindowSchema.optional(),
    recommendedReplacement: z.boolean().default(false),
    policy: deviceMaintenancePolicySchema.optional(),
  })
  .strict();

const baseDeviceSchema = domainEntitySchema
  .merge(sluggedEntitySchema)
  .extend({
    blueprintId: uuidSchema,
    quality01: finiteNumber.min(0, 'quality01 must be >= 0.').max(1, 'quality01 must be <= 1.'),
    condition01: finiteNumber.min(0, 'condition01 must be >= 0.').max(1, 'condition01 must be <= 1.'),
    powerDraw_W: finiteNumber.min(0, 'powerDraw_W cannot be negative.'),
    dutyCycle01: finiteNumber.min(0, 'dutyCycle01 must be >= 0.').max(1, 'dutyCycle01 must be <= 1.'),
    efficiency01: finiteNumber.min(0, 'efficiency01 must be >= 0.').max(1, 'efficiency01 must be <= 1.'),
    coverage_m2: finiteNumber.min(0, 'coverage_m2 cannot be negative.').default(0),
    airflow_m3_per_h: finiteNumber
      .min(0, 'airflow_m3_per_h cannot be negative.')
      .default(0),
    sensibleHeatRemovalCapacity_W: finiteNumber.min(
      0,
      'sensibleHeatRemovalCapacity_W cannot be negative.'
    ),
    effects: z.array(deviceEffectLiteralSchema).readonly().optional(),
    effectConfigs: z.record(z.string(), z.unknown()).optional(),
    maintenance: deviceMaintenanceStateSchema.optional(),
  });

const structureDeviceSchema: z.ZodType<StructureDeviceInstance> = baseDeviceSchema.extend({
  placementScope: z.literal(STRUCTURE_SCOPE)
});

const roomDeviceSchema: z.ZodType<RoomDeviceInstance> = baseDeviceSchema.extend({
  placementScope: z.literal(ROOM_SCOPE)
});

const zoneDeviceSchema: z.ZodType<ZoneDeviceInstance> = baseDeviceSchema.extend({
  placementScope: z.literal(ZONE_SCOPE)
});

const plantSchema: z.ZodType<Plant> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .extend({
    strainId: uuidSchema,
    lifecycleStage: z.enum([...PLANT_LIFECYCLE_STAGES]),
    ageHours: finiteNumber.min(0, 'ageHours cannot be negative.'),
    health01: finiteNumber.min(0, 'health01 must be >= 0.').max(1, 'health01 must be <= 1.'),
    biomass_g: finiteNumber.min(0, 'biomass_g cannot be negative.'),
    containerId: uuidSchema,
    substrateId: uuidSchema,
    readyForHarvest: z.boolean().optional(),
    harvestedAt_tick: finiteNumber
      .min(0, 'harvestedAt_tick cannot be negative.')
      .transform((value) => Math.trunc(value))
      .optional(),
    status: z.enum(['active', 'harvested']).optional(),
    moisture01: finiteNumber
      .min(0, 'moisture01 must be >= 0.')
      .max(1, 'moisture01 must be <= 1.')
      .optional(),
    quality01: finiteNumber
      .min(0, 'quality01 must be >= 0.')
      .max(1, 'quality01 must be <= 1.')
      .optional()
  });

const zoneEnvironmentSchema: z.ZodType<ZoneEnvironment> = z.object({
  airTemperatureC: finiteNumber,
  relativeHumidity_pct: finiteNumber
    .min(0, 'relativeHumidity_pct must be >= 0.')
    .max(100, 'relativeHumidity_pct must be <= 100.')
    .default(50),
  co2_ppm: finiteNumber
    .min(0, 'co2_ppm must be >= 0.')
    .default(AMBIENT_CO2_PPM)
});

function deriveZoneAirMassKg(zone: Pick<Zone, 'floorArea_m2' | 'height_m'>): number {
  const area = Number.isFinite(zone.floorArea_m2) && zone.floorArea_m2 > 0 ? zone.floorArea_m2 : 0;
  const height = Number.isFinite(zone.height_m) && zone.height_m > 0 ? zone.height_m : ROOM_DEFAULT_HEIGHT_M;

  return area * height * AIR_DENSITY_KG_PER_M3;
}

const zoneBaseSchema = domainEntitySchema
  .merge(sluggedEntitySchema)
  .merge(spatialEntitySchema)
  .extend({
    cultivationMethodId: uuidSchema,
    irrigationMethodId: uuidSchema,
    containerId: uuidSchema,
    substrateId: uuidSchema,
    lightSchedule: lightScheduleSchema,
    photoperiodPhase: z.enum(['vegetative', 'flowering']),
    plants: z.array(plantSchema).readonly(),
    devices: z.array(zoneDeviceSchema).readonly(),
    environment: zoneEnvironmentSchema,
    ppfd_umol_m2s: finiteNumber.min(0, 'ppfd_umol_m2s cannot be negative.'),
    dli_mol_m2d_inc: finiteNumber.min(0, 'dli_mol_m2d_inc cannot be negative.'),
    nutrientBuffer_mg: z
      .record(z.string(), finiteNumber.min(0, 'Nutrient buffer values cannot be negative.'))
      .default({}),
    moisture01: finiteNumber
      .min(0, 'moisture01 must be >= 0.')
      .max(1, 'moisture01 must be <= 1.')
      .default(0.5)
  });

export const zoneSchema: z.ZodType<Zone> = zoneBaseSchema.transform((zone) => ({
  ...zone,
  airMass_kg: deriveZoneAirMassKg(zone)
}) satisfies Zone);

export const roomSchema: z.ZodType<Room> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .merge(spatialEntitySchema)
  .extend({
    purpose: z.enum([...ROOM_PURPOSES]),
    zones: z.array(zoneSchema).readonly(),
    devices: z.array(roomDeviceSchema).readonly(),
    class: nonEmptyString.optional(),
    tags: z.array(nonEmptyString).readonly().optional(),
    inventory: InventorySchema.optional()
  })
  .superRefine((room, ctx) => {
    if (room.purpose !== 'growroom' && room.zones.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only growrooms may contain zones.',
        path: ['zones']
      });
    }

    if (room.purpose === 'growroom' && room.zones.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Growrooms must define at least one zone.',
        path: ['zones']
      });
    }
  })
  .transform((room) => {
    const tags = room.tags ?? [];
    const isStorageClass = room.class === 'room.storage';
    const hasStorageTag = tags.includes('storage');
    const isStoragePurpose = room.purpose === 'storageroom';
    const shouldHaveInventory = isStorageClass || hasStorageTag || isStoragePurpose;

    return {
      ...room,
      inventory: shouldHaveInventory ? room.inventory ?? { lots: [] } : room.inventory
    } satisfies Room;
  });

export const structureSchema: z.ZodType<Structure> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .merge(spatialEntitySchema)
  .extend({
    rooms: z.array(roomSchema).readonly(),
    devices: z.array(structureDeviceSchema).readonly()
  });

export const companySchema: z.ZodType<Company> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .extend({
    location: companyLocationSchema,
    structures: z.array(structureSchema).readonly()
  });

export type ParsedCompanyWorld = z.infer<typeof companySchema>;

export function parseCompanyWorld(input: unknown): ParsedCompanyWorld {
  return companySchema.parse(input);
}

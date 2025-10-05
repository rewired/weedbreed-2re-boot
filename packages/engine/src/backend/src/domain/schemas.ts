import { z } from 'zod';

import {
  AIR_DENSITY_KG_PER_M3,
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
  type LightSchedule,
  type Plant,
  type Room,
  type RoomDeviceInstance,
  type Structure,
  type StructureDeviceInstance,
  type Zone,
  type ZoneDeviceInstance,
  type ZoneEnvironment
} from './entities.js';
import { InventorySchema } from './schemas/InventorySchema.js';
import type {
  Employee,
  EmployeeRngSeedUuid,
  EmployeeSchedule,
  EmployeeSkillLevel
} from './workforce/Employee.js';
import type { EmployeeRole, EmployeeSkillRequirement } from './workforce/EmployeeRole.js';
import type { WorkforceState } from './workforce/WorkforceState.js';
import type { WorkforceKpiSnapshot } from './workforce/kpis.js';
import type {
  WorkforceTaskCostModel,
  WorkforceTaskDefinition,
  WorkforceTaskInstance
} from './workforce/tasks.js';

const [STRUCTURE_SCOPE, ROOM_SCOPE, ZONE_SCOPE] = DEVICE_PLACEMENT_SCOPES;

const uuidSchema = z.string().uuid('Expected a UUID v4 identifier.').brand<'Uuid'>();
const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidV7Schema: z.ZodBranded<string, EmployeeRngSeedUuid> = z
  .string()
  .regex(uuidV7Pattern, 'Expected a UUID v7 identifier.')
  .brand<EmployeeRngSeedUuid>();
const nonEmptyString = z
  .string()
  .trim()
  .min(1, 'String fields must not be empty.');
const finiteNumber = z.number().finite('Value must be a finite number.');

const zeroToOneNumber = finiteNumber
  .min(0, 'Value must be >= 0.')
  .max(1, 'Value must be <= 1.');

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
    tags: z.array(nonEmptyString).readonly().optional()
  });

export const employeeSkillLevelSchema: z.ZodType<EmployeeSkillLevel> = z.object({
  skillKey: nonEmptyString,
  level01: zeroToOneNumber
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

export const employeeSchema: z.ZodType<Employee> = domainEntitySchema.extend({
  roleId: uuidSchema,
  rngSeedUuid: uuidV7Schema,
  assignedStructureId: uuidSchema,
  morale01: zeroToOneNumber,
  fatigue01: zeroToOneNumber,
  skills: z.array(employeeSkillLevelSchema).readonly(),
  developmentPlan: z.array(employeeSkillRequirementSchema).readonly().optional(),
  schedule: employeeScheduleSchema,
  notes: nonEmptyString.optional()
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
  laborHoursCommitted: finiteNumber.min(0, 'laborHoursCommitted cannot be negative.'),
  overtimeHoursCommitted: finiteNumber.min(0, 'overtimeHoursCommitted cannot be negative.'),
  averageMorale01: zeroToOneNumber,
  averageFatigue01: zeroToOneNumber
});

export const workforceStateSchema: z.ZodType<WorkforceState> = z.object({
  roles: employeeRoleCollectionSchema,
  employees: employeeCollectionSchema,
  taskDefinitions: z.array(workforceTaskDefinitionSchema).readonly(),
  taskQueue: z.array(workforceTaskInstanceSchema).readonly(),
  kpis: z.array(workforceKpiSnapshotSchema).readonly()
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
    )
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
    .default(50)
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

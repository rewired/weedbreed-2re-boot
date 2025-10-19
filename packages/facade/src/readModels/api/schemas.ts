import { z } from 'zod';
import { uuidSchema } from '@wb/engine';

export { uuidSchema };

function nonEmptyString(fieldName: string): z.ZodString {
  return z
    .string({ invalid_type_error: `${fieldName} must be a string.` })
    .min(1, `${fieldName} must not be empty.`);
}

function finiteNumber(fieldName: string): z.ZodNumber {
  return z
    .number({ invalid_type_error: `${fieldName} must be a number.` })
    .finite(`${fieldName} must be a finite number.`);
}

function nonNegativeNumber(fieldName: string): z.ZodNumber {
  return finiteNumber(fieldName).min(0, `${fieldName} must be greater than or equal to zero.`);
}

function positiveNumber(fieldName: string): z.ZodNumber {
  return finiteNumber(fieldName).gt(0, `${fieldName} must be greater than zero.`);
}

function nonNegativeInteger(fieldName: string): z.ZodNumber {
  return nonNegativeNumber(fieldName).int(`${fieldName} must be an integer.`);
}

const SCHEMA_VERSION = {
  companyTree: 'companyTree.v1',
  structureTariffs: 'structureTariffs.v1',
  workforceView: 'workforceView.v1'
} as const;

/**
 * Current schema version identifier applied to the `companyTree` read model.
 */
export const COMPANY_TREE_SCHEMA_VERSION = SCHEMA_VERSION.companyTree;
/**
 * Current schema version identifier applied to the `structureTariffs` read model.
 */
export const STRUCTURE_TARIFFS_SCHEMA_VERSION = SCHEMA_VERSION.structureTariffs;
/**
 * Current schema version identifier applied to the `workforceView` read model.
 */
export const WORKFORCE_VIEW_SCHEMA_VERSION = SCHEMA_VERSION.workforceView;

const warningSeveritySchema = z.enum(['info', 'warning', 'critical'], {
  invalid_type_error: 'Warning severity must be a string.',
  required_error: 'Warning severity is required.'
});

const warningScopeSchema = z.enum(['structure', 'room', 'zone'], {
  invalid_type_error: 'Warning scope must be a string.',
  required_error: 'Warning scope is required.'
});

const warningEnvelopeSchema = z
  .object({
    id: nonEmptyString('Warning id'),
    scope: warningScopeSchema,
    targetId: uuidSchema.optional(),
    message: nonEmptyString('Warning message'),
    severity: warningSeveritySchema
  })
  .strict();

const deviceWarningSchema = z
  .object({
    id: nonEmptyString('Device warning id'),
    message: nonEmptyString('Device warning message'),
    severity: warningSeveritySchema
  })
  .strict();

const devicePlacementScopeSchema = z.enum(['structure', 'room', 'zone'], {
  invalid_type_error: 'Device placement scope must be a string.',
  required_error: 'Device placement scope is required.'
});

const deviceSummarySchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyString('Device name'),
    slug: nonEmptyString('Device slug'),
    class: nonEmptyString('Device class'),
    placementScope: devicePlacementScopeSchema,
    conditionPercent: nonNegativeNumber('Device conditionPercent').max(
      100,
      'Device conditionPercent must be less than or equal to one hundred.'
    ),
    coverageArea_m2: nonNegativeNumber('Device coverageArea_m2'),
    airflow_m3_per_hour: nonNegativeNumber('Device airflow_m3_per_hour'),
    powerDraw_kWh_per_hour: nonNegativeNumber('Device powerDraw_kWh_per_hour'),
    warnings: z.array(deviceWarningSchema).readonly()
  })
  .strict();

const zoneTaskSchema = z
  .object({
    id: nonEmptyString('Zone task id'),
    type: z.enum(['inspection', 'treatment', 'harvest', 'maintenance', 'training'], {
      invalid_type_error: 'Zone task type must be a string.',
      required_error: 'Zone task type is required.'
    }),
    status: z.enum(['queued', 'in-progress', 'done'], {
      invalid_type_error: 'Zone task status must be a string.',
      required_error: 'Zone task status is required.'
    }),
    assigneeId: uuidSchema.nullable(),
    scheduledTick: nonNegativeNumber('Zone task scheduledTick'),
    targetZoneId: uuidSchema
  })
  .strict();

const zoneKpiSnapshotSchema = z
  .object({
    healthPercent: nonNegativeNumber('Zone kpis.healthPercent').max(
      100,
      'Zone kpis.healthPercent must be less than or equal to one hundred.'
    ),
    qualityPercent: nonNegativeNumber('Zone kpis.qualityPercent').max(
      100,
      'Zone kpis.qualityPercent must be less than or equal to one hundred.'
    ),
    stressPercent: nonNegativeNumber('Zone kpis.stressPercent').max(
      100,
      'Zone kpis.stressPercent must be less than or equal to one hundred.'
    ),
    biomass_kg: nonNegativeNumber('Zone kpis.biomass_kg'),
    growthRatePercent: finiteNumber('Zone kpis.growthRatePercent')
  })
  .strict();

const zonePestStatusSchema = z
  .object({
    activeIssues: nonNegativeInteger('Zone pestStatus.activeIssues'),
    dueInspections: nonNegativeInteger('Zone pestStatus.dueInspections'),
    upcomingTreatments: nonNegativeInteger('Zone pestStatus.upcomingTreatments'),
    nextInspectionTick: nonNegativeNumber('Zone pestStatus.nextInspectionTick'),
    lastInspectionTick: nonNegativeNumber('Zone pestStatus.lastInspectionTick')
  })
  .strict();

const zoneClimateSnapshotSchema = z
  .object({
    temperature_C: finiteNumber('Zone climateSnapshot.temperature_C'),
    relativeHumidity_percent: finiteNumber('Zone climateSnapshot.relativeHumidity_percent'),
    co2_ppm: finiteNumber('Zone climateSnapshot.co2_ppm'),
    vpd_kPa: finiteNumber('Zone climateSnapshot.vpd_kPa'),
    ach_measured: finiteNumber('Zone climateSnapshot.ach_measured'),
    ach_target: finiteNumber('Zone climateSnapshot.ach_target'),
    status: z.enum(['ok', 'warn', 'critical'], {
      invalid_type_error: 'Zone climateSnapshot status must be a string.',
      required_error: 'Zone climateSnapshot status is required.'
    })
  })
  .strict();

const zoneClimateTelemetrySampleSchema = z
  .object({
    simTimeHours: nonNegativeNumber('Zone climate telemetry simTimeHours'),
    temperature_C: finiteNumber('Zone climate telemetry temperature_C'),
    relativeHumidity_percent: finiteNumber('Zone climate telemetry relativeHumidity_percent'),
    co2_ppm: finiteNumber('Zone climate telemetry co2_ppm'),
    vpd_kPa: finiteNumber('Zone climate telemetry vpd_kPa'),
    ach: finiteNumber('Zone climate telemetry ach')
  })
  .strict();

const zoneClimateSchema = z
  .object({
    snapshot: zoneClimateSnapshotSchema,
    telemetry: z.array(zoneClimateTelemetrySampleSchema).readonly()
  })
  .strict();

const zoneCultivationMethodSchema = z
  .object({
    id: uuidSchema,
    slug: nonEmptyString('Zone cultivation method slug'),
    name: nonEmptyString('Zone cultivation method name')
  })
  .strict();

const zoneCultivationContainerSchema = z
  .object({
    id: uuidSchema,
    slug: nonEmptyString('Zone cultivation container slug'),
    name: nonEmptyString('Zone cultivation container name'),
    volume_L: nonNegativeNumber('Zone cultivation container volume_L'),
    serviceLife_cycles: nonNegativeNumber('Zone cultivation container serviceLife_cycles'),
    unitCost: nonNegativeNumber('Zone cultivation container unitCost')
  })
  .strict();

const zoneCultivationSubstrateSchema = z
  .object({
    id: uuidSchema,
    slug: nonEmptyString('Zone cultivation substrate slug'),
    name: nonEmptyString('Zone cultivation substrate name'),
    unitPrice_per_L: nonNegativeNumber('Zone cultivation substrate unitPrice_per_L'),
    densityFactor_L_per_kg: positiveNumber('Zone cultivation substrate densityFactor_L_per_kg')
  })
  .strict();

const zoneCultivationStrainSchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyString('Zone cultivation strain name')
  })
  .strict();

const zoneCultivationContextSchema = z
  .object({
    method: zoneCultivationMethodSchema,
    container: zoneCultivationContainerSchema.optional(),
    substrate: zoneCultivationSubstrateSchema.optional(),
    strain: zoneCultivationStrainSchema.optional(),
    maxPlants: nonNegativeInteger('Zone cultivation maxPlants'),
    currentPlantCount: nonNegativeInteger('Zone cultivation currentPlantCount')
  })
  .strict();

const zoneLightingScheduleSchema = z
  .object({
    onHours: nonNegativeNumber('Zone lighting schedule onHours'),
    offHours: nonNegativeNumber('Zone lighting schedule offHours'),
    startHour: nonNegativeNumber('Zone lighting schedule startHour')
  })
  .strict();

const zoneLightingContextSchema = z
  .object({
    schedule: zoneLightingScheduleSchema.nullable(),
    coveragePercent: nonNegativeNumber('Zone lighting coveragePercent').max(
      100,
      'Zone lighting coveragePercent must be less than or equal to one hundred.'
    ),
    deviceCount: nonNegativeInteger('Zone lighting deviceCount'),
    dutyCycle01: nonNegativeNumber('Zone lighting dutyCycle01').max(
      1,
      'Zone lighting dutyCycle01 must be less than or equal to one.'
    )
  })
  .strict();

const zoneIrrigationMethodSchema = z
  .object({
    id: uuidSchema,
    slug: nonEmptyString('Zone irrigation method slug'),
    name: nonEmptyString('Zone irrigation method name'),
    deliveryType: nonEmptyString('Zone irrigation deliveryType').optional()
  })
  .strict();

const zoneIrrigationContextSchema = z
  .object({
    method: zoneIrrigationMethodSchema,
    estimatedWaterDemand_m3_per_day: nonNegativeNumber(
      'Zone irrigation estimatedWaterDemand_m3_per_day'
    ),
    labourHoursPerDay: nonNegativeNumber('Zone irrigation labourHoursPerDay'),
    runoffFraction01: nonNegativeNumber('Zone irrigation runoffFraction01')
      .max(1, 'Zone irrigation runoffFraction01 must be less than or equal to one.')
      .optional()
  })
  .strict();

const zoneDeviceCoverageSchema = z
  .object({
    lightingCoverage01: nonNegativeNumber('Zone deviceCoverage lightingCoverage01'),
    hvacCapacity01: nonNegativeNumber('Zone deviceCoverage hvacCapacity01'),
    ach: nonNegativeNumber('Zone deviceCoverage ach'),
    achTarget: nonNegativeNumber('Zone deviceCoverage achTarget'),
    warnings: z.array(deviceWarningSchema).readonly()
  })
  .strict();

const zoneSchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyString('Zone name'),
    area_m2: nonNegativeNumber('Zone area_m2'),
    volume_m3: nonNegativeNumber('Zone volume_m3'),
    cultivation: zoneCultivationContextSchema,
    lighting: zoneLightingContextSchema,
    irrigation: zoneIrrigationContextSchema,
    kpis: zoneKpiSnapshotSchema,
    pestStatus: zonePestStatusSchema,
    climate: zoneClimateSchema,
    deviceCoverage: zoneDeviceCoverageSchema,
    devices: z.array(deviceSummarySchema).readonly(),
    tasks: z.array(zoneTaskSchema).readonly(),
    outstandingTaskCount: nonNegativeInteger('Zone outstandingTaskCount'),
    warnings: z.array(deviceWarningSchema).readonly()
  })
  .strict();

const roomCapacitySchema = z
  .object({
    areaUsed_m2: nonNegativeNumber('Room capacity areaUsed_m2'),
    areaFree_m2: nonNegativeNumber('Room capacity areaFree_m2'),
    volumeUsed_m3: nonNegativeNumber('Room capacity volumeUsed_m3'),
    volumeFree_m3: nonNegativeNumber('Room capacity volumeFree_m3')
  })
  .strict();

const roomCoverageSchema = z
  .object({
    achCurrent: nonNegativeNumber('Room coverage achCurrent'),
    achTarget: nonNegativeNumber('Room coverage achTarget'),
    climateWarnings: z.array(deviceWarningSchema).readonly()
  })
  .strict();

const roomClimateSnapshotSchema = z
  .object({
    temperature_C: finiteNumber('Room climate snapshot temperature_C'),
    relativeHumidity_percent: finiteNumber('Room climate snapshot relativeHumidity_percent'),
    co2_ppm: finiteNumber('Room climate snapshot co2_ppm'),
    ach: finiteNumber('Room climate snapshot ach'),
    notes: nonEmptyString('Room climate snapshot notes')
  })
  .strict();

const roomClimateTelemetrySampleSchema = z
  .object({
    simTimeHours: nonNegativeNumber('Room climate telemetry simTimeHours'),
    temperature_C: finiteNumber('Room climate telemetry temperature_C'),
    relativeHumidity_percent: finiteNumber('Room climate telemetry relativeHumidity_percent'),
    co2_ppm: finiteNumber('Room climate telemetry co2_ppm'),
    ach: finiteNumber('Room climate telemetry ach')
  })
  .strict();

const roomClimateSchema = z
  .object({
    snapshot: roomClimateSnapshotSchema,
    telemetry: z.array(roomClimateTelemetrySampleSchema).readonly()
  })
  .strict();

const roomSchema = z
  .object({
    id: uuidSchema,
    structureId: uuidSchema,
    name: nonEmptyString('Room name'),
    purpose: nonEmptyString('Room purpose'),
    area_m2: nonNegativeNumber('Room area_m2'),
    volume_m3: nonNegativeNumber('Room volume_m3'),
    capacity: roomCapacitySchema,
    coverage: roomCoverageSchema,
    climate: roomClimateSchema,
    devices: z.array(deviceSummarySchema).readonly(),
    zones: z.array(zoneSchema).readonly(),
    outstandingTaskCount: nonNegativeInteger('Room outstandingTaskCount'),
    warnings: z.array(deviceWarningSchema).readonly()
  })
  .strict();

const structureCapacitySchema = z
  .object({
    areaUsed_m2: nonNegativeNumber('Structure capacity areaUsed_m2'),
    areaFree_m2: nonNegativeNumber('Structure capacity areaFree_m2'),
    volumeUsed_m3: nonNegativeNumber('Structure capacity volumeUsed_m3'),
    volumeFree_m3: nonNegativeNumber('Structure capacity volumeFree_m3')
  })
  .strict();

const structureCoverageSchema = z
  .object({
    lightingCoverage01: nonNegativeNumber('Structure coverage lightingCoverage01'),
    hvacCapacity01: nonNegativeNumber('Structure coverage hvacCapacity01'),
    airflowAch: nonNegativeNumber('Structure coverage airflowAch'),
    warnings: z.array(deviceWarningSchema).readonly()
  })
  .strict();

const structureKpiSchema = z
  .object({
    energyKwhPerDay: nonNegativeNumber('Structure KPI energyKwhPerDay'),
    waterM3PerDay: nonNegativeNumber('Structure KPI waterM3PerDay'),
    labourHoursPerDay: nonNegativeNumber('Structure KPI labourHoursPerDay'),
    maintenanceCostPerHour: nonNegativeNumber('Structure KPI maintenanceCostPerHour')
  })
  .strict();

const structureTariffSchema = z
  .object({
    price_electricity: nonNegativeNumber('Structure tariff price_electricity'),
    price_water: nonNegativeNumber('Structure tariff price_water')
  })
  .strict();

const structureSchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyString('Structure name'),
    location: nonEmptyString('Structure location'),
    area_m2: nonNegativeNumber('Structure area_m2'),
    volume_m3: nonNegativeNumber('Structure volume_m3'),
    capacity: structureCapacitySchema,
    coverage: structureCoverageSchema,
    kpis: structureKpiSchema,
    tariffs: structureTariffSchema,
    devices: z.array(deviceSummarySchema).readonly(),
    rooms: z.array(roomSchema).readonly(),
    outstandingTaskCount: nonNegativeInteger('Structure outstandingTaskCount'),
    warnings: z.array(warningEnvelopeSchema).readonly()
  })
  .strict();

/**
 * Zod validator describing the façade `companyTree` read model payload.
 */
export const companyTreeSchema = z
  .object({
    schemaVersion: z.literal(COMPANY_TREE_SCHEMA_VERSION),
    simTime: nonNegativeNumber('simTime'),
    companyId: uuidSchema,
    name: nonEmptyString('Company name'),
    structures: z.array(structureSchema).readonly()
  })
  .strict();

/**
 * Zod validator describing the façade `structureTariffs` read model payload.
 */
export const structureTariffsSchema = z
  .object({
    schemaVersion: z.literal(STRUCTURE_TARIFFS_SCHEMA_VERSION),
    simTime: nonNegativeNumber('simTime'),
    electricity_kwh_price: nonNegativeNumber('electricity_kwh_price'),
    water_m3_price: nonNegativeNumber('water_m3_price'),
    co2_kg_price: nonNegativeNumber('co2_kg_price').optional(),
    currency: z.literal(null).optional()
  })
  .strict();

const workforceWarningSchema = z
  .object({
    code: nonEmptyString('Warning code'),
    message: nonEmptyString('Warning message'),
    severity: z.enum(['info', 'warning', 'critical'], {
      invalid_type_error: 'Warning severity must be a string.',
      required_error: 'Warning severity is required.'
    }),
    structureId: uuidSchema.optional(),
    employeeId: uuidSchema.optional(),
    taskId: uuidSchema.optional()
  })
  .strict();

const workforceAssignmentSchema = z
  .object({
    scope: z.enum(['structure', 'room', 'zone'], {
      invalid_type_error: 'Assignment scope must be a string.',
      required_error: 'Assignment scope is required.'
    }),
    targetId: uuidSchema
  })
  .strict();

const workforceRosterEntrySchema = z
  .object({
    employeeId: uuidSchema,
    displayName: nonEmptyString('Roster displayName'),
    structureId: uuidSchema,
    roleSlug: nonEmptyString('Roster roleSlug'),
    morale01: nonNegativeNumber('Roster morale01').max(
      1,
      'Roster morale01 must be less than or equal to one.'
    ),
    fatigue01: nonNegativeNumber('Roster fatigue01').max(
      1,
      'Roster fatigue01 must be less than or equal to one.'
    ),
    currentTaskId: uuidSchema.nullable(),
    nextShiftStartTick: nonNegativeNumber('Roster nextShiftStartTick').nullable(),
    baseHoursPerDay: nonNegativeNumber('Roster baseHoursPerDay').max(
      24,
      'Roster baseHoursPerDay must be less than or equal to twenty-four.'
    ),
    overtimeHoursPerDay: nonNegativeNumber('Roster overtimeHoursPerDay').max(
      24,
      'Roster overtimeHoursPerDay must be less than or equal to twenty-four.'
    ),
    daysPerWeek: nonNegativeNumber('Roster daysPerWeek').max(
      7,
      'Roster daysPerWeek must be less than or equal to seven.'
    ),
    shiftStartHour: nonNegativeNumber('Roster shiftStartHour')
      .max(23, 'Roster shiftStartHour must be less than twenty-four.')
      .nullable(),
    assignment: workforceAssignmentSchema
  })
  .strict();

/**
 * Zod validator describing the façade `workforceView` read model payload.
 */
export const workforceViewSchema = z
  .object({
    schemaVersion: z.literal(WORKFORCE_VIEW_SCHEMA_VERSION),
    simTime: nonNegativeNumber('simTime'),
    headcount: nonNegativeInteger('headcount'),
    roles: z
      .object({
        gardener: nonNegativeInteger('roles.gardener'),
        technician: nonNegativeInteger('roles.technician'),
        janitor: nonNegativeInteger('roles.janitor')
      })
      .strict(),
    roster: z.array(workforceRosterEntrySchema).readonly(),
    kpis: z
      .object({
        utilizationPercent: nonNegativeNumber('kpis.utilizationPercent').max(
          100,
          'kpis.utilizationPercent must be less than or equal to one hundred.'
        ),
        overtimeMinutes: nonNegativeInteger('kpis.overtimeMinutes'),
        warnings: z.array(workforceWarningSchema).readonly()
      })
      .strict()
  })
  .strict();

/**
 * TypeScript representation of the validated `companyTree` read model payload.
 */
export type CompanyTreeReadModel = z.infer<typeof companyTreeSchema>;
/**
 * TypeScript representation of the validated `structureTariffs` read model payload.
 */
export type StructureTariffsReadModel = z.infer<typeof structureTariffsSchema>;
/**
 * TypeScript representation of the validated `workforceView` read model payload.
 */
export type WorkforceViewReadModel = z.infer<typeof workforceViewSchema>;

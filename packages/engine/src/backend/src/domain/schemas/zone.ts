import { z } from 'zod';

import {
  AIR_DENSITY_KG_PER_M3,
  AMBIENT_CO2_PPM,
  FLOAT_TOLERANCE,
  HOURS_PER_DAY,
  ROOM_DEFAULT_HEIGHT_M,
} from '../../constants/simConstants.ts';
import {
  DEVICE_PLACEMENT_SCOPES,
  type LightSchedule,
  type RoomDeviceInstance,
  type StructureDeviceInstance,
  type Zone,
  type ZoneDeviceInstance,
  type ZoneEnvironment,
} from '../entities.ts';
import { finiteNumber, uuidSchema } from './primitives.ts';
import { domainEntitySchema, sluggedEntitySchema, spatialEntitySchema, zeroToOneNumber } from './base.ts';
import { plantSchema } from './plant.ts';

const [STRUCTURE_SCOPE, ROOM_SCOPE, ZONE_SCOPE] = DEVICE_PLACEMENT_SCOPES;

/* eslint-disable @typescript-eslint/no-magic-numbers -- Zone schema defaults rely on canonical neutral values */
const DEFAULT_MAINTENANCE_THRESHOLD01 = 0.5 as const;
const DEFAULT_RELATIVE_HUMIDITY01 = 0.5 as const;
const DEFAULT_ZONE_MOISTURE01 = 0.5 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

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
      .max(HOURS_PER_DAY, `startHour must be <= ${String(HOURS_PER_DAY)}.`),
  })
  .superRefine((schedule, ctx) => {
    if (
      Math.abs(schedule.onHours + schedule.offHours - HOURS_PER_DAY) > FLOAT_TOLERANCE
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Light schedules must allocate exactly ${String(HOURS_PER_DAY)} hours across on/off periods.`,
        path: [],
      });
    }
  });

const deviceEffectLiteralSchema = z.enum([
  'thermal',
  'humidity',
  'lighting',
  'airflow',
  'filtration',
  'sensor',
  'co2',
]);

const deviceMaintenancePolicySchema = z
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
      .default(DEFAULT_MAINTENANCE_THRESHOLD01),
  })
  .strict();

const deviceMaintenanceWindowSchema = z
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

const deviceMaintenanceStateSchema = z
  .object({
    runtimeHours: finiteNumber.min(0, 'maintenance.runtimeHours cannot be negative.'),
    hoursSinceService: finiteNumber.min(
      0,
      'maintenance.hoursSinceService cannot be negative.',
    ),
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
    quality01: zeroToOneNumber,
    condition01: zeroToOneNumber,
    powerDraw_W: finiteNumber.min(0, 'powerDraw_W cannot be negative.'),
    dutyCycle01: zeroToOneNumber,
    efficiency01: zeroToOneNumber,
    coverage_m2: finiteNumber.min(0, 'coverage_m2 cannot be negative.').default(0),
    airflow_m3_per_h: finiteNumber
      .min(0, 'airflow_m3_per_h cannot be negative.')
      .default(0),
    sensibleHeatRemovalCapacity_W: finiteNumber.min(
      0,
      'sensibleHeatRemovalCapacity_W cannot be negative.',
    ),
    effects: z.array(deviceEffectLiteralSchema).readonly().optional(),
    effectConfigs: z.record(z.string(), z.unknown()).optional(),
    maintenance: deviceMaintenanceStateSchema.optional(),
  });

export const structureDeviceSchema: z.ZodType<StructureDeviceInstance> = baseDeviceSchema.extend({
  placementScope: z.literal(STRUCTURE_SCOPE),
});

export const roomDeviceSchema: z.ZodType<RoomDeviceInstance> = baseDeviceSchema.extend({
  placementScope: z.literal(ROOM_SCOPE),
});

export const zoneDeviceSchema: z.ZodType<ZoneDeviceInstance> = baseDeviceSchema.extend({
  placementScope: z.literal(ZONE_SCOPE),
});

const zoneEnvironmentSchema: z.ZodType<ZoneEnvironment> = z.object({
  airTemperatureC: finiteNumber,
  relativeHumidity01: zeroToOneNumber.default(DEFAULT_RELATIVE_HUMIDITY01),
  co2_ppm: finiteNumber
    .min(0, 'co2_ppm must be >= 0.')
    .default(AMBIENT_CO2_PPM),
});

function deriveZoneAirMassKg(zone: Pick<Zone, 'floorArea_m2' | 'height_m'>): number {
  const area = Number.isFinite(zone.floorArea_m2) && zone.floorArea_m2 > 0 ? zone.floorArea_m2 : 0;
  const height =
    Number.isFinite(zone.height_m) && zone.height_m > 0 ? zone.height_m : ROOM_DEFAULT_HEIGHT_M;

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
    moisture01: zeroToOneNumber.default(DEFAULT_ZONE_MOISTURE01),
  });

export const zoneSchema: z.ZodType<Zone> = zoneBaseSchema.transform((zone) => ({
  ...zone,
  airMass_kg: deriveZoneAirMassKg(zone),
}) satisfies Zone);

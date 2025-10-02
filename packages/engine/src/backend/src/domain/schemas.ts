import { z } from 'zod';

import { AIR_DENSITY_KG_PER_M3, ROOM_DEFAULT_HEIGHT_M } from '../constants/simConstants.js';
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

const [STRUCTURE_SCOPE, ROOM_SCOPE, ZONE_SCOPE] = DEVICE_PLACEMENT_SCOPES;

const uuidSchema = z.string().uuid('Expected a UUID v4 identifier.').brand<'Uuid'>();
const nonEmptyString = z
  .string()
  .trim()
  .min(1, 'String fields must not be empty.');
const finiteNumber = z.number().finite('Value must be a finite number.');

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

export const companyLocationSchema: z.ZodType<CompanyLocation> = z.object({
  lon: finiteNumber
    .min(-180, 'Longitude must be >= -180.')
    .max(180, 'Longitude must be <= 180.'),
  lat: finiteNumber
    .min(-90, 'Latitude must be >= -90.')
    .max(90, 'Latitude must be <= 90.'),
  cityName: nonEmptyString,
  countryName: nonEmptyString
});

export const lightScheduleSchema: z.ZodType<LightSchedule> = z
  .object({
    onHours: finiteNumber.min(0, 'onHours cannot be negative.'),
    offHours: finiteNumber.min(0, 'offHours cannot be negative.'),
    startHour: finiteNumber.min(0, 'startHour cannot be negative.')
  })
  .superRefine((schedule, ctx) => {
    if (schedule.onHours + schedule.offHours !== 24) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Light schedules must allocate exactly 24 hours across on/off periods.',
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
    substrateId: uuidSchema
  });

const zoneEnvironmentSchema: z.ZodType<ZoneEnvironment> = z.object({
  airTemperatureC: finiteNumber
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
    environment: zoneEnvironmentSchema
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
    devices: z.array(roomDeviceSchema).readonly()
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

import { z } from 'zod';

import { DEVICE_PLACEMENT_SCOPES, ROOM_PURPOSES } from '../entities.js';

const nonEmptyString = z.string().trim().min(1, 'String fields must not be empty.');
const finiteNumber = z.number().finite('Value must be a finite number.');

const placementScopeSchema = z.enum([...DEVICE_PLACEMENT_SCOPES]);
const roomPurposeSchema = z.enum([...ROOM_PURPOSES]);

/**
 * Canonical device blueprint contract enforced for JSON payloads.
 */
const deviceBlueprintObjectSchema = z
  .object({
    id: z.string().uuid('Device blueprint id must be a UUID v4.'),
    slug: nonEmptyString.optional(),
    name: nonEmptyString,
    kind: nonEmptyString.optional(),
    placementScope: placementScopeSchema,
    allowedRoomPurposes: z
      .array(roomPurposeSchema, {
        invalid_type_error: 'allowedRoomPurposes must be an array of room purposes.'
      })
      .nonempty('allowedRoomPurposes must contain at least one room purpose.'),
    power_W: finiteNumber.min(0, 'power_W must be non-negative.'),
    efficiency01: finiteNumber
      .min(0, 'efficiency01 must be >= 0.')
      .max(1, 'efficiency01 must be <= 1.'),
    coverage_m2: finiteNumber.min(0, 'coverage_m2 must be non-negative.').optional(),
    airflow_m3_per_h: finiteNumber
      .min(0, 'airflow_m3_per_h must be non-negative.')
      .optional()
  })
  .passthrough();

export const deviceBlueprintSchema = deviceBlueprintObjectSchema.superRefine((blueprint, ctx) => {
    if (!blueprint.coverage_m2 && !blueprint.airflow_m3_per_h) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['coverage_m2'],
        message: 'Device blueprint must declare coverage_m2 or airflow_m3_per_h.'
      });
    }
  });

export type DeviceBlueprint = z.infer<typeof deviceBlueprintSchema>;

export function parseDeviceBlueprint(input: unknown): DeviceBlueprint {
  return deviceBlueprintSchema.parse(input);
}

export interface DeviceInstanceCapacity {
  readonly powerDraw_W: number;
  readonly efficiency01: number;
  readonly coverage_m2: number;
  readonly airflow_m3_per_h: number;
}

export function toDeviceInstanceCapacity(blueprint: DeviceBlueprint): DeviceInstanceCapacity {
  return {
    powerDraw_W: blueprint.power_W,
    efficiency01: blueprint.efficiency01,
    coverage_m2: blueprint.coverage_m2 ?? 0,
    airflow_m3_per_h: blueprint.airflow_m3_per_h ?? 0
  } satisfies DeviceInstanceCapacity;
}

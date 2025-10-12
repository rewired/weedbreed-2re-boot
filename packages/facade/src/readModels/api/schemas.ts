import { z } from 'zod';
import { uuidSchema } from '@wb/engine';

function nonEmptyString(fieldName: string): z.ZodString {
  return z
    .string({ invalid_type_error: `${fieldName} must be a string.` })
    .min(1, `${fieldName} must not be empty.`);
}

function nonNegativeNumber(fieldName: string): z.ZodNumber {
  return z
    .number({ invalid_type_error: `${fieldName} must be a number.` })
    .finite(`${fieldName} must be a finite number.`)
    .min(0, `${fieldName} must be greater than or equal to zero.`);
}

function positiveNumber(fieldName: string): z.ZodNumber {
  return z
    .number({ invalid_type_error: `${fieldName} must be a number.` })
    .finite(`${fieldName} must be a finite number.`)
    .gt(0, `${fieldName} must be greater than zero.`);
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

const zoneSchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyString('Zone name'),
    area_m2: positiveNumber('area_m2'),
    volume_m3: positiveNumber('volume_m3')
  })
  .strict();

const roomSchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyString('Room name'),
    zones: z.array(zoneSchema).readonly()
  })
  .strict();

const structureSchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyString('Structure name'),
    rooms: z.array(roomSchema).readonly()
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
    kpis: z
      .object({
        utilization: nonNegativeNumber('kpis.utilization').max(
          1,
          'kpis.utilization must be less than or equal to one.'
        ),
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

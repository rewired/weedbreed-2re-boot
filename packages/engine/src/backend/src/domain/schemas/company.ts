import { z } from 'zod';

import {
  LATITUDE_MAX_DEG,
  LATITUDE_MIN_DEG,
  LONGITUDE_MAX_DEG,
  LONGITUDE_MIN_DEG,
} from '../../constants/simConstants.ts';
import { type Company, type CompanyLocation } from '../entities.ts';
import { domainEntitySchema, sluggedEntitySchema } from './base.ts';
import { nonEmptyString, finiteNumber } from './primitives.ts';
import { structureSchema } from './structure.ts';

export const companyLocationSchema: z.ZodType<CompanyLocation> = z.object({
  lon: finiteNumber
    .min(LONGITUDE_MIN_DEG, `Longitude must be >= ${String(LONGITUDE_MIN_DEG)}.`)
    .max(LONGITUDE_MAX_DEG, `Longitude must be <= ${String(LONGITUDE_MAX_DEG)}.`),
  lat: finiteNumber
    .min(LATITUDE_MIN_DEG, `Latitude must be >= ${String(LATITUDE_MIN_DEG)}.`)
    .max(LATITUDE_MAX_DEG, `Latitude must be <= ${String(LATITUDE_MAX_DEG)}.`),
  cityName: nonEmptyString,
  countryName: nonEmptyString,
});

export const companySchema: z.ZodType<Company> = domainEntitySchema
  .merge(sluggedEntitySchema)
  .extend({
    location: companyLocationSchema,
    structures: z.array(structureSchema).readonly(),
  });

export type ParsedCompanyWorld = z.infer<typeof companySchema>;

export function parseCompanyWorld(input: unknown): ParsedCompanyWorld {
  return companySchema.parse(input);
}

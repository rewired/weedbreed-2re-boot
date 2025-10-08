import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type { CompanyLocation } from '../entities.ts';

const positiveNumber = z
  .number({ invalid_type_error: 'Location index values must be numbers.' })
  .finite('Location index values must be finite numbers.')
  .min(0, 'Location index values must be greater than or equal to zero.');

const locationOverrideSchema = z
  .object({
    countryName: z
      .string({ invalid_type_error: 'Override countryName must be a string.' })
      .min(1, 'Override countryName must not be empty.'),
    cityName: z
      .string({ invalid_type_error: 'Override cityName must be a string.' })
      .min(1, 'Override cityName must not be empty.')
      .optional(),
    index: positiveNumber,
  })
  .strict();

const locationIndexSchema = z
  .object({
    defaultIndex: positiveNumber.default(1),
    overrides: z.array(locationOverrideSchema).default([]),
  })
  .strict();

export type LocationIndexOverride = z.infer<typeof locationOverrideSchema>;
export type LocationIndexTable = z.infer<typeof locationIndexSchema>;

export interface LoadLocationIndexOptions {
  readonly payrollRoot?: string;
}

const DEFAULT_PAYROLL_ROOT = path.resolve(
  fileURLToPath(new URL('../../../../../../../', import.meta.url)),
  'data/payroll',
);

let cachedTable: LocationIndexTable | null = null;

function resolvePayrollRoot(root?: string): string {
  if (!root) {
    return DEFAULT_PAYROLL_ROOT;
  }

  return path.isAbsolute(root) ? path.normalize(root) : path.resolve(root);
}

function readLocationIndexFile(root: string): unknown {
  const filePath = path.join(root, 'location_index.json');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Location index file "${filePath}" does not exist.`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

function buildLocationIndexTable(options: LoadLocationIndexOptions = {}): LocationIndexTable {
  const root = resolvePayrollRoot(options.payrollRoot);
  const payload = readLocationIndexFile(root);
  return locationIndexSchema.parse(payload);
}

export function loadLocationIndexTable(
  options: LoadLocationIndexOptions = {},
): LocationIndexTable {
  if (!cachedTable) {
    cachedTable = buildLocationIndexTable(options);
  }

  return { ...cachedTable, overrides: [...cachedTable.overrides] } satisfies LocationIndexTable;
}

export function clearLocationIndexCache(): void {
  cachedTable = null;
}

export function resolveLocationIndex(
  table: LocationIndexTable,
  location: CompanyLocation | undefined,
): number {
  if (!location) {
    return table.defaultIndex;
  }

  const city = location.cityName.trim().toLowerCase();
  const country = location.countryName.trim().toLowerCase();

  for (const override of table.overrides) {
    if (override.cityName && override.cityName.trim().toLowerCase() === city) {
      return override.index;
    }
  }

  for (const override of table.overrides) {
    if (!override.cityName && override.countryName.trim().toLowerCase() === country) {
      return override.index;
    }
  }

  return table.defaultIndex;
}

export function createEmptyLocationIndexTable(): LocationIndexTable {
  return { defaultIndex: 1, overrides: [] } satisfies LocationIndexTable;
}

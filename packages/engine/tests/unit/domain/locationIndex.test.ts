import { afterEach, describe, expect, it } from 'vitest';

import {
  clearLocationIndexCache,
  loadLocationIndexTable,
  resolveLocationIndex,
  type LocationIndexTable,
} from '@/backend/src/domain/payroll/locationIndex';

const HAMBURG = {
  lon: 10,
  lat: 53.55,
  cityName: 'Hamburg',
  countryName: 'Germany',
} as const;

const SEATTLE = {
  lon: -122.335167,
  lat: 47.608013,
  cityName: 'Seattle',
  countryName: 'United States',
} as const;

afterEach(() => {
  clearLocationIndexCache();
});

describe('location index loader', () => {
  it('loads the default table with a neutral index', () => {
    const table = loadLocationIndexTable();
    expect(table.defaultIndex).toBe(1);
    expect(table.overrides).toEqual([]);
  });

  it('prefers city overrides over country and default', () => {
    const table: LocationIndexTable = {
      defaultIndex: 0.95,
      overrides: [
        { countryName: 'Germany', index: 1.05 },
        { countryName: 'United States', cityName: 'Seattle', index: 1.3 },
      ],
    };

    expect(resolveLocationIndex(table, HAMBURG)).toBe(1.05);
    expect(resolveLocationIndex(table, SEATTLE)).toBe(1.3);
    expect(resolveLocationIndex(table, undefined)).toBe(0.95);
  });
});

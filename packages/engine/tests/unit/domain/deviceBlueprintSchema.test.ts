import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  deviceBlueprintSchema,
  parseDeviceBlueprint,
  toDeviceInstanceCapacity
} from '@/backend/src/domain/world.js';

import climateUnit from '../../../../../data/blueprints/device/climate/cooling/climate_unit_01.json' assert { type: 'json' };
import co2Injector from '../../../../../data/blueprints/device/climate/co2/co2injector-01.json' assert { type: 'json' };
import dehumidifier from '../../../../../data/blueprints/device/climate/dehumidifier/dehumidifier-01.json' assert { type: 'json' };
import exhaustFan from '../../../../../data/blueprints/device/airflow/exhaust/exhaust_fan_01.json' assert { type: 'json' };
import humidityControl from '../../../../../data/blueprints/device/climate/humidity-controller/humidity_control_unit_01.json' assert { type: 'json' };
import vegLight from '../../../../../data/blueprints/device/lighting/vegetative/veg_light_01.json' assert { type: 'json' };

const climateUnitPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/climate/cooling/climate_unit_01.json', import.meta.url)
);
const co2InjectorPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/climate/co2/co2injector-01.json', import.meta.url)
);
const dehumidifierPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/climate/dehumidifier/dehumidifier-01.json', import.meta.url)
);
const exhaustFanPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/airflow/exhaust/exhaust_fan_01.json', import.meta.url)
);
const humidityControlPath = fileURLToPath(
  new URL(
    '../../../../../data/blueprints/device/climate/humidity-controller/humidity_control_unit_01.json',
    import.meta.url
  )
);
const vegLightPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/lighting/vegetative/veg_light_01.json', import.meta.url)
);

const deviceFixtures = [
  { data: climateUnit, path: climateUnitPath },
  { data: co2Injector, path: co2InjectorPath },
  { data: dehumidifier, path: dehumidifierPath },
  { data: exhaustFan, path: exhaustFanPath },
  { data: humidityControl, path: humidityControlPath },
  { data: vegLight, path: vegLightPath }
] as const;

describe('deviceBlueprintSchema', () => {
  it('accepts canonical blueprint payloads', () => {
    const base = {
      id: '00000000-0000-4000-8000-000000000000',
      class: 'device.climate.cooling',
      name: 'Test Device',
      slug: 'test-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 500,
      efficiency01: 0.75,
      coverage_m2: 12,
      coverage: {
        maxArea_m2: 12
      },
      limits: {
        coolingCapacity_kW: 1
      },
      settings: {
        coolingCapacity: 0.5,
        targetTemperature: 24,
        targetTemperatureRange: [20, 26]
      }
    };

    expect(() => deviceBlueprintSchema.parse(base)).not.toThrow();
  });

  it('rejects blueprints missing both coverage and airflow', () => {
    const invalid = {
      id: '00000000-0000-4000-8000-000000000001',
      class: 'device.climate.cooling',
      name: 'Invalid Device',
      slug: 'invalid-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 200,
      efficiency01: 0.5
    };

    const result = deviceBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'coverage_m2'
    ]);
  });

  it('rejects efficiency values outside the unit interval', () => {
    const invalid = {
      id: '00000000-0000-4000-8000-000000000002',
      class: 'device.climate.cooling',
      name: 'Invalid Efficiency',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 200,
      efficiency01: 1.5,
      coverage_m2: 5
    };

    const result = deviceBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
      'efficiency01 must be <= 1.'
    );
  });

  it('parses repository device blueprints without modification', () => {
    for (const fixture of deviceFixtures) {
      expect(() => parseDeviceBlueprint(fixture.data, { filePath: fixture.path })).not.toThrow();
    }
  });

  it('rejects blueprints containing monetary fields', () => {
    const invalid = {
      ...co2Injector,
      maintenance: {
        ...co2Injector.maintenance,
        costPerService_eur: 99
      }
    } as typeof co2Injector;

    const result = deviceBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Monetary field "costPerService_eur" must be declared in /data/prices maps.');
    }
  });

  it('enforces slug uniqueness per class across fixtures', () => {
    const registry = new Map<string, string>();

    for (const fixture of deviceFixtures) {
      expect(() =>
        parseDeviceBlueprint(fixture.data, { filePath: fixture.path, slugRegistry: registry })
      ).not.toThrow();
    }
  });

  it('requires effect-specific settings based on class', () => {
    const invalid = {
      ...dehumidifier,
      settings: { ...dehumidifier.settings }
    } as typeof dehumidifier;

    delete (invalid.settings as Record<string, unknown>).latentRemovalKgPerTick;

    const result = deviceBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(issuePaths).toContain('settings.latentRemovalKgPerTick');
    }
  });

  it('maps blueprint capacity fields onto device instance props', () => {
    const parsed = parseDeviceBlueprint(
      {
        id: '00000000-0000-4000-8000-000000000003',
        class: 'device.climate.cooling',
        name: 'Mapper Device',
        slug: 'mapper-device',
        placementScope: 'zone',
        allowedRoomPurposes: ['growroom'],
        power_W: 420,
        efficiency01: 0.6,
        coverage_m2: 8,
        airflow_m3_per_h: 120,
        coverage: {
          maxArea_m2: 8
        },
        limits: {
          coolingCapacity_kW: 2
        },
        settings: {
          coolingCapacity: 1,
          targetTemperature: 22,
          targetTemperatureRange: [18, 26]
        }
      },
      { filePath: climateUnitPath }
    );

    expect(toDeviceInstanceCapacity(parsed)).toEqual({
      powerDraw_W: 420,
      efficiency01: 0.6,
      coverage_m2: 8,
      airflow_m3_per_h: 120
    });
  });
});

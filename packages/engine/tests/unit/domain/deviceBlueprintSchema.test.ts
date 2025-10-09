import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  deviceBlueprintSchema,
  parseDeviceBlueprint,
  toDeviceInstanceCapacity
} from '@/backend/src/domain/world';
import { unwrapErr } from '../../util/expectors';

import climateUnit from '../../../../../data/blueprints/device/climate/cool-air-split-3000.json' with { type: 'json' };
import co2Injector from '../../../../../data/blueprints/device/climate/co2-pulse.json' with { type: 'json' };
import dehumidifier from '../../../../../data/blueprints/device/climate/drybox-200.json' with { type: 'json' };
import exhaustFan from '../../../../../data/blueprints/device/airflow/exhaust-fan-4-inch.json' with { type: 'json' };
import humidityControl from '../../../../../data/blueprints/device/climate/humidity-control-unit-l1.json' with { type: 'json' };
import vegLight from '../../../../../data/blueprints/device/lighting/led-veg-light-600.json' with { type: 'json' };

const climateUnitPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/climate/cool-air-split-3000.json', import.meta.url)
);
const co2InjectorPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/climate/co2-pulse.json', import.meta.url)
);
const dehumidifierPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/climate/drybox-200.json', import.meta.url)
);
const exhaustFanPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/airflow/exhaust-fan-4-inch.json', import.meta.url)
);
const humidityControlPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/climate/humidity-control-unit-l1.json', import.meta.url)
);
const vegLightPath = fileURLToPath(
  new URL('../../../../../data/blueprints/device/lighting/led-veg-light-600.json', import.meta.url)
);

const blueprintsRoot = path.resolve(
  fileURLToPath(new URL('../../../../../data/blueprints/', import.meta.url))
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
      class: 'device.climate',
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
      },
      mode: 'thermal'
    };

    expect(() => deviceBlueprintSchema.parse(base)).not.toThrow();
  });

  it('accepts blueprint with effects array and thermal config', () => {
    const blueprint = {
      id: '00000000-0000-4000-8000-000000000010',
      class: 'device.climate',
      name: 'Thermal Effects Device',
      slug: 'thermal-effects-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 1_000,
      efficiency01: 0.6,
      coverage_m2: 12,
      effects: ['thermal'],
      thermal: { mode: 'cool', max_cool_W: 2_500 },
      coverage: { maxArea_m2: 12 },
      limits: { coolingCapacity_kW: 2.5 },
      settings: {
        coolingCapacity: 2,
        targetTemperature: 24,
        targetTemperatureRange: [20, 26]
      },
      mode: 'thermal'
    };

    expect(() => deviceBlueprintSchema.parse(blueprint)).not.toThrow();
  });

  it('accepts blueprint with effects array and humidity config', () => {
    const blueprint = {
      id: '00000000-0000-4000-8000-000000000011',
      class: 'device.climate',
      name: 'Humidity Effects Device',
      slug: 'humidity-effects-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 400,
      efficiency01: 0.5,
      coverage_m2: 8,
      effects: ['humidity'],
      humidity: { mode: 'dehumidify', capacity_g_per_h: 900 },
      coverage: { maxVolume_m3: 20 },
      limits: { removalRate_kg_h: 0.9 },
      settings: { latentRemovalKgPerTick: 0.025 },
      mode: 'dehumidifier'
    };

    expect(() => deviceBlueprintSchema.parse(blueprint)).not.toThrow();
  });

  it('accepts blueprint with effects array and lighting config', () => {
    const blueprint = {
      id: '00000000-0000-4000-8000-000000000012',
      class: 'device.lighting',
      name: 'Lighting Effects Device',
      slug: 'lighting-effects-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 600,
      efficiency01: 0.7,
      coverage_m2: 1.2,
      effects: ['lighting'],
      lighting: { ppfd_center_umol_m2s: 700, photonEfficacy_umol_per_J: 2.3 },
      coverage: { maxArea_m2: 1.2, effectivePPFD_at_m: 0.6, beamProfile: 'wide' },
      limits: { power_W: 600, maxPPFD: 1_200, minPPFD: 200 },
      settings: { ppfd: 700, power: 0.6, spectralRange: [400, 700], heatFraction: 0.3 },
      stage: 'vegetative'
    } as const;

    expect(() => deviceBlueprintSchema.parse(blueprint)).not.toThrow();
  });

  it('accepts blueprint with multiple effects and configs', () => {
    const blueprint = {
      id: '00000000-0000-4000-8000-000000000013',
      class: 'device.climate',
      name: 'Multi-Effect Device',
      slug: 'multi-effect-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 1_200,
      efficiency01: 0.65,
      coverage_m2: 25,
      airflow_m3_per_h: 300,
      effects: ['thermal', 'humidity', 'airflow'],
      thermal: { mode: 'cool', max_cool_W: 3_000 },
      humidity: { mode: 'dehumidify', capacity_g_per_h: 600 },
      airflow: { mode: 'recirculation', airflow_m3_per_h: 300 },
      coverage: { maxArea_m2: 25 },
      limits: { coolingCapacity_kW: 3 },
      settings: {
        coolingCapacity: 2.4,
        targetTemperature: 24,
        targetTemperatureRange: [20, 26]
      },
      mode: 'thermal'
    };

    expect(() => deviceBlueprintSchema.parse(blueprint)).not.toThrow();
  });

  it('rejects blueprints missing both coverage and airflow', () => {
    const invalid = {
      id: '00000000-0000-4000-8000-000000000001',
      class: 'device.climate',
      name: 'Invalid Device',
      slug: 'invalid-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 200,
      efficiency01: 0.5,
      mode: 'thermal'
    };

    const result = deviceBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected missing coverage to fail validation');
    }

    const issuePaths = unwrapErr(result).issues.map((issue) => issue.path);
    expect(issuePaths).toContainEqual(['coverage_m2']);
  });

  it('rejects efficiency values outside the unit interval', () => {
    const invalid = {
      id: '00000000-0000-4000-8000-000000000002',
      class: 'device.climate',
      name: 'Invalid Efficiency',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 200,
      efficiency01: 1.5,
      coverage_m2: 5,
      mode: 'thermal'
    };

    const result = deviceBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected efficiency outside unit interval to fail validation');
    }

    const messages = unwrapErr(result).issues.map((issue) => issue.message);
    expect(messages).toContain('efficiency01 must be <= 1.');
  });

  it('parses repository device blueprints without modification', () => {
    for (const fixture of deviceFixtures) {
      expect(() =>
        parseDeviceBlueprint(fixture.data, { filePath: fixture.path, blueprintsRoot })
      ).not.toThrow();
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
    if (result.success) {
      throw new Error('Expected monetary fields to fail validation');
    }

    const messages = unwrapErr(result).issues.map((issue) => issue.message);
    expect(messages).toContain('Monetary field "costPerService_eur" must be declared in /data/prices maps.');
  });

  it('enforces slug uniqueness per class across fixtures', () => {
    const registry = new Map<string, string>();

    for (const fixture of deviceFixtures) {
      expect(() =>
        parseDeviceBlueprint(fixture.data, {
          filePath: fixture.path,
          slugRegistry: registry,
          blueprintsRoot
        })
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
    if (result.success) {
      throw new Error('Expected missing latent removal setting to fail validation');
    }

    const issuePaths = unwrapErr(result).issues.map((issue) => issue.path.join('.'));
    expect(issuePaths).toContain('settings.latentRemovalKgPerTick');
  });

  it('maps blueprint capacity fields onto device instance props', () => {
    const parsed = parseDeviceBlueprint(
      {
        id: '00000000-0000-4000-8000-000000000003',
      class: 'device.climate',
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
      },
      mode: 'thermal'
    },
      { filePath: climateUnitPath, blueprintsRoot }
    );

    expect(toDeviceInstanceCapacity(parsed)).toEqual({
      powerDraw_W: 420,
      efficiency01: 0.6,
      coverage_m2: 8,
      airflow_m3_per_h: 120
    });
  });

  it('rejects blueprint with effects array but missing config', () => {
    const invalid = {
      id: '00000000-0000-4000-8000-000000000014',
      class: 'device.climate',
      name: 'Missing Thermal Config',
      slug: 'missing-thermal-config',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 800,
      efficiency01: 0.6,
      coverage_m2: 10,
      effects: ['thermal'],
      coverage: { maxArea_m2: 10 },
      limits: { coolingCapacity_kW: 1.5 },
      settings: {
        coolingCapacity: 1,
        targetTemperature: 24,
        targetTemperatureRange: [20, 26]
      },
      mode: 'thermal'
    };

    const result = deviceBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected missing thermal config to fail validation');
    }

    const messages = unwrapErr(result).issues.map((issue) => issue.message);
    expect(messages).toContain("thermal config is required when effects include 'thermal'.");
  });

  it('accepts blueprint without effects array for backward compatibility', () => {
    const legacy = {
      id: '00000000-0000-4000-8000-000000000015',
      class: 'device.airflow',
      name: 'Legacy Exhaust',
      slug: 'legacy-exhaust',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 40,
      efficiency01: 0.7,
      airflow_m3_per_h: 150,
      coverage_m2: 5,
      coverage: { maxVolume_m3: 12, ventilationPattern: 'exhaust' },
      limits: { power_W: 40, airflow_m3_h: 180, minAirflow_m3_h: 100, maxStaticPressure_Pa: 120 },
      settings: { airflow: 150, power: 0.04 },
      subtype: 'exhaust'
    } as const;

    expect(() => deviceBlueprintSchema.parse(legacy)).not.toThrow();
  });

  it('rejects invalid effect names in effects array', () => {
    const invalid = {
      id: '00000000-0000-4000-8000-000000000016',
      class: 'device.climate',
      name: 'Invalid Effect Device',
      slug: 'invalid-effect-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 800,
      efficiency01: 0.6,
      coverage_m2: 10,
      effects: ['invalid-effect'],
      coverage: { maxArea_m2: 10 },
      limits: { coolingCapacity_kW: 1.5 },
      settings: {
        coolingCapacity: 1,
        targetTemperature: 24,
        targetTemperatureRange: [20, 26]
      },
      mode: 'thermal'
    };

    const result = deviceBlueprintSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });
});

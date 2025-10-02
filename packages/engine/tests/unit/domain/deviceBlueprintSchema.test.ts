import { describe, expect, it } from 'vitest';

import {
  deviceBlueprintSchema,
  parseDeviceBlueprint,
  toDeviceInstanceCapacity
} from '@/backend/src/domain/world.js';

import climateUnit from '../../../../../data/blueprints/devices/climate_unit_01.json' assert { type: 'json' };
import co2Injector from '../../../../../data/blueprints/devices/co2injector-01.json' assert { type: 'json' };
import dehumidifier from '../../../../../data/blueprints/devices/dehumidifier-01.json' assert { type: 'json' };
import exhaustFan from '../../../../../data/blueprints/devices/exhaust_fan_01.json' assert { type: 'json' };
import humidityControl from '../../../../../data/blueprints/devices/humidity_control_unit_01.json' assert { type: 'json' };
import vegLight from '../../../../../data/blueprints/devices/veg_light_01.json' assert { type: 'json' };

describe('deviceBlueprintSchema', () => {
  it('accepts canonical blueprint payloads', () => {
    const base = {
      id: '00000000-0000-4000-8000-000000000000',
      name: 'Test Device',
      slug: 'test-device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 500,
      efficiency01: 0.75,
      coverage_m2: 12
    };

    expect(() => deviceBlueprintSchema.parse(base)).not.toThrow();
  });

  it('rejects blueprints missing both coverage and airflow', () => {
    const invalid = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Invalid Device',
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
    const fixtures = [climateUnit, co2Injector, dehumidifier, exhaustFan, humidityControl, vegLight];

    for (const fixture of fixtures) {
      expect(() => parseDeviceBlueprint(fixture)).not.toThrow();
    }
  });

  it('maps blueprint capacity fields onto device instance props', () => {
    const parsed = parseDeviceBlueprint({
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Mapper Device',
      placementScope: 'zone',
      allowedRoomPurposes: ['growroom'],
      power_W: 420,
      efficiency01: 0.6,
      coverage_m2: 8,
      airflow_m3_per_h: 120
    });

    expect(toDeviceInstanceCapacity(parsed)).toEqual({
      powerDraw_W: 420,
      efficiency01: 0.6,
      coverage_m2: 8,
      airflow_m3_per_h: 120
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  CP_AIR_J_PER_KG_K,
  HOURS_PER_TICK,
  SECONDS_PER_HOUR
} from '@/backend/src/constants/simConstants.js';
import { applyDeviceHeat } from '@/backend/src/engine/thermo/heat.js';

const ZONE_FLOOR_AREA_M2 = 50;
const ZONE_HEIGHT_M = 3;
const DEVICE_POWER_DRAW_W = 600;
const DEVICE_DUTY_CYCLE = 0.5;
const DEVICE_EFFICIENCY = 0.9;

const BASE_ZONE = {
  floorArea_m2: ZONE_FLOOR_AREA_M2,
  height_m: ZONE_HEIGHT_M,
  airMass_kg: ZONE_FLOOR_AREA_M2 * ZONE_HEIGHT_M * AIR_DENSITY_KG_PER_M3
} as const;

const BASE_DEVICE = {
  powerDraw_W: DEVICE_POWER_DRAW_W,
  dutyCycle01: DEVICE_DUTY_CYCLE,
  efficiency01: DEVICE_EFFICIENCY
} as const;

describe('applyDeviceHeat', () => {
  it('returns a positive temperature delta for waste heat', () => {
    const deltaC = applyDeviceHeat(BASE_ZONE, BASE_DEVICE);

    const airMassKg = BASE_ZONE.airMass_kg;
    const wastePower_W =
      BASE_DEVICE.powerDraw_W * (1 - BASE_DEVICE.efficiency01) * BASE_DEVICE.dutyCycle01;
    const expectedDelta =
      (wastePower_W * HOURS_PER_TICK * SECONDS_PER_HOUR) /
      (airMassKg * CP_AIR_J_PER_KG_K);

    expect(deltaC).toBeGreaterThan(0);
    expect(deltaC).toBeCloseTo(expectedDelta, 12);
  });

  it('returns zero when the duty cycle is zero', () => {
    const deltaC = applyDeviceHeat(BASE_ZONE, {
      ...BASE_DEVICE,
      dutyCycle01: 0
    });

    expect(deltaC).toBe(0);
  });

  it('returns zero when efficiency equals one', () => {
    const deltaC = applyDeviceHeat(BASE_ZONE, {
      ...BASE_DEVICE,
      efficiency01: 1
    });

    expect(deltaC).toBe(0);
  });

  it('throws an error when the efficiency lies outside the [0,1] range', () => {
    expect(() =>
      applyDeviceHeat(BASE_ZONE, {
        ...BASE_DEVICE,
        efficiency01: 1.2
      })
    ).toThrowError(RangeError);
  });
});

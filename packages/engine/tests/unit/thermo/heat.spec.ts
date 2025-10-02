import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  CP_AIR_J_PER_KG_K,
  HOURS_PER_TICK
} from '@/backend/src/constants/simConstants.js';
import { applyDeviceHeat } from '@/backend/src/engine/thermo/heat.js';

const BASE_ZONE = {
  floorArea_m2: 50,
  height_m: 3,
  airMass_kg: 50 * 3 * AIR_DENSITY_KG_PER_M3
} as const;

const BASE_DEVICE = {
  powerDraw_W: 600,
  dutyCycle01: 0.5,
  efficiency01: 0.9
} as const;

describe('applyDeviceHeat', () => {
  it('returns a positive temperature delta for waste heat', () => {
    const deltaC = applyDeviceHeat(BASE_ZONE, BASE_DEVICE);

    const airMassKg = BASE_ZONE.airMass_kg;
    const wastePower_W =
      BASE_DEVICE.powerDraw_W * (1 - BASE_DEVICE.efficiency01) * BASE_DEVICE.dutyCycle01;
    const expectedDelta =
      (wastePower_W * HOURS_PER_TICK * 3_600) / (airMassKg * CP_AIR_J_PER_KG_K);

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

import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  CP_AIR_J_PER_KG_K,
  HOURS_PER_TICK,
  SECONDS_PER_HOUR
} from '@/backend/src/constants/simConstants';
import { createThermalActuatorStub } from '@/backend/src/stubs/ThermalActuatorStub';

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

describe('ThermalActuatorStub', () => {
  const actuator = createThermalActuatorStub();
  const envState = { airTemperatureC: 25 };

  it('returns a positive temperature delta for waste heat in heat mode', () => {
    const inputs = {
      mode: 'heat' as const,
      power_W: BASE_DEVICE.powerDraw_W,
      efficiency01: BASE_DEVICE.efficiency01,
      dutyCycle01: BASE_DEVICE.dutyCycle01,
      max_heat_W: undefined
    };

    const result = actuator.computeEffect(inputs, envState, BASE_ZONE.airMass_kg, HOURS_PER_TICK);

    const airMassKg = BASE_ZONE.airMass_kg;
    const wastePower_W =
      BASE_DEVICE.powerDraw_W * (1 - BASE_DEVICE.efficiency01) * BASE_DEVICE.dutyCycle01;
    const expectedDelta =
      (wastePower_W * HOURS_PER_TICK * SECONDS_PER_HOUR) /
      (airMassKg * CP_AIR_J_PER_KG_K);

    expect(result.deltaT_K).toBeGreaterThan(0);
    expect(result.deltaT_K).toBeCloseTo(expectedDelta, 12);
  });

  it('returns zero when the duty cycle is zero', () => {
    const inputs = {
      mode: 'heat' as const,
      power_W: BASE_DEVICE.powerDraw_W,
      efficiency01: BASE_DEVICE.efficiency01,
      dutyCycle01: 0,
      max_heat_W: undefined
    };

    const result = actuator.computeEffect(inputs, envState, BASE_ZONE.airMass_kg, HOURS_PER_TICK);

    expect(result.deltaT_K).toBe(0);
  });

  it('returns zero when efficiency equals one', () => {
    const inputs = {
      mode: 'heat' as const,
      power_W: BASE_DEVICE.powerDraw_W,
      efficiency01: 1,
      dutyCycle01: BASE_DEVICE.dutyCycle01,
      max_heat_W: undefined
    };

    const result = actuator.computeEffect(inputs, envState, BASE_ZONE.airMass_kg, HOURS_PER_TICK);

    expect(result.deltaT_K).toBe(0);
  });

  it('throws an error when the efficiency lies outside the [0,1] range', () => {
    const inputs = {
      mode: 'heat' as const,
      power_W: BASE_DEVICE.powerDraw_W,
      efficiency01: 1.2,
      dutyCycle01: BASE_DEVICE.dutyCycle01,
      max_heat_W: undefined
    };

    expect(() =>
      actuator.computeEffect(inputs, envState, BASE_ZONE.airMass_kg, HOURS_PER_TICK)
    ).toThrowError(RangeError);
  });
});

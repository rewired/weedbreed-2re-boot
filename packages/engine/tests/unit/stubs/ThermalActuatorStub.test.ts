import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  CP_AIR_J_PER_KG_K,
  HOURS_PER_TICK,
  SECONDS_PER_HOUR
} from '@/backend/src/constants/simConstants.js';
import { createThermalActuatorStub } from '@/backend/src/stubs/ThermalActuatorStub.js';
import type { ThermalActuatorInputs } from '@/backend/src/domain/interfaces/IThermalActuator.js';
import type { ZoneEnvironment } from '@/backend/src/domain/entities.js';

const ZONE_VOLUME_M3 = 50;
const AIR_MASS_KG = ZONE_VOLUME_M3 * AIR_DENSITY_KG_PER_M3;
const BASE_ENV_STATE: ZoneEnvironment = { airTemperatureC: 22 };

function createInputs(overrides: Partial<ThermalActuatorInputs> = {}): ThermalActuatorInputs {
  return {
    power_W: 1_000,
    efficiency01: 0.9,
    mode: 'heat',
    ...overrides
  };
}

describe('ThermalActuatorStub', () => {
  const stub = createThermalActuatorStub();

  describe('heating mode', () => {
    it('matches the reference delta for a 1000 W heater at 90% efficiency', () => {
      const inputs = createInputs();
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.used_W).toBeCloseTo(100, 5);
      expect(result.energy_Wh).toBeCloseTo(1_000, 5);

      const expectedDelta =
        (result.used_W * HOURS_PER_TICK * SECONDS_PER_HOUR) / (AIR_MASS_KG * CP_AIR_J_PER_KG_K);
      expect(result.deltaT_K).toBeGreaterThan(0);
      expect(result.deltaT_K).toBeCloseTo(expectedDelta, 1);
    });

    it('respects the max_heat_W cap', () => {
      const inputs = createInputs({ max_heat_W: 40 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.used_W).toBe(40);
      expect(result.deltaT_K).toBeCloseTo(
        (40 * HOURS_PER_TICK * SECONDS_PER_HOUR) / (AIR_MASS_KG * CP_AIR_J_PER_KG_K),
      );
    });

    it('produces no heat when efficiency equals one', () => {
      const inputs = createInputs({ efficiency01: 1 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.deltaT_K).toBe(0);
      expect(result.used_W).toBe(0);
      expect(result.energy_Wh).toBeCloseTo(1_000, 5);
    });
  });

  describe('cooling mode', () => {
    it('produces a negative temperature delta proportional to cooling load', () => {
      const inputs = createInputs({ power_W: 3_000, efficiency01: 0.65, mode: 'cool', max_cool_W: 3_000 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.used_W).toBeCloseTo(1_950, 5);
      expect(result.energy_Wh).toBeCloseTo(3_000, 5);
      expect(result.deltaT_K).toBeLessThan(0);
      const expectedDelta =
        -(result.used_W * HOURS_PER_TICK * SECONDS_PER_HOUR) / (AIR_MASS_KG * CP_AIR_J_PER_KG_K);
      expect(result.deltaT_K).toBeCloseTo(expectedDelta, 5);
    });

    it('respects the max_cool_W cap', () => {
      const inputs = createInputs({ power_W: 3_000, efficiency01: 0.9, mode: 'cool', max_cool_W: 1_200 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.used_W).toBe(1_200);
      const expectedDelta =
        -(1_200 * HOURS_PER_TICK * SECONDS_PER_HOUR) / (AIR_MASS_KG * CP_AIR_J_PER_KG_K);
      expect(result.deltaT_K).toBeCloseTo(expectedDelta, 5);
    });

    it('returns zero effect when efficiency equals zero', () => {
      const inputs = createInputs({ mode: 'cool', efficiency01: 0, power_W: 2_000 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.deltaT_K).toBe(0);
      expect(result.used_W).toBe(0);
    });
  });

  describe('auto mode', () => {
    it('heats when the setpoint exceeds the current temperature', () => {
      const inputs = createInputs({ mode: 'auto', setpoint_C: BASE_ENV_STATE.airTemperatureC + 2 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.deltaT_K).toBeGreaterThan(0);
    });

    it('cools when the setpoint is below the current temperature', () => {
      const inputs = createInputs({ mode: 'auto', setpoint_C: BASE_ENV_STATE.airTemperatureC - 2, efficiency01: 0.5 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.deltaT_K).toBeLessThan(0);
    });

    it('returns neutral effect when the setpoint equals the current temperature', () => {
      const inputs = createInputs({ mode: 'auto', setpoint_C: BASE_ENV_STATE.airTemperatureC });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.deltaT_K).toBe(0);
      expect(result.used_W).toBe(0);
    });

    it('throws when setpoint is omitted', () => {
      const inputs = createInputs({ mode: 'auto' });

      expect(() => stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK)).toThrowError(
        'Auto mode requires setpoint_C'
      );
    });
  });

  describe('edge cases', () => {
    it('returns zeros when power draw is zero', () => {
      const inputs = createInputs({ power_W: 0 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result).toEqual({ deltaT_K: 0, energy_Wh: 0, used_W: 0 });
    });

    it('returns zeros when air mass is zero', () => {
      const inputs = createInputs();
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, 0, HOURS_PER_TICK);

      expect(result).toEqual({ deltaT_K: 0, energy_Wh: 0, used_W: 0 });
    });

    it('returns zeros when dt_h is zero', () => {
      const inputs = createInputs();
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, 0);

      expect(result).toEqual({ deltaT_K: 0, energy_Wh: 0, used_W: 0 });
    });

    it('throws when efficiency falls outside [0,1]', () => {
      const inputs = createInputs({ efficiency01: 1.2 });

      expect(() => stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK)).toThrowError(RangeError);
    });

    it('clamps negative power to zero', () => {
      const inputs = createInputs({ power_W: -500 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result).toEqual({ deltaT_K: 0, energy_Wh: 0, used_W: 0 });
    });
  });

  describe('output structure', () => {
    it('always returns finite numeric outputs and energy consistency', () => {
      const inputs = createInputs({ power_W: 1_500, efficiency01: 0.25 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, 0.5);

      expect(Number.isFinite(result.deltaT_K)).toBe(true);
      expect(Number.isFinite(result.energy_Wh)).toBe(true);
      expect(Number.isFinite(result.used_W)).toBe(true);
      expect(result.energy_Wh).toBeCloseTo(inputs.power_W * 0.5, 5);
    });
  });
});

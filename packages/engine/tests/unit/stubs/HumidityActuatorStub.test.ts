import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  AMBIENT_CO2_PPM,
  HOURS_PER_TICK
} from '@/backend/src/constants/simConstants';
import { createHumidityActuatorStub } from '@/backend/src/stubs/HumidityActuatorStub';
import type { HumidityActuatorInputs } from '@/backend/src/domain/interfaces/IHumidityActuator';
import type { ZoneEnvironment } from '@/backend/src/domain/entities';

const ZONE_VOLUME_M3 = 50;
const AIR_MASS_KG = ZONE_VOLUME_M3 * AIR_DENSITY_KG_PER_M3;
const BASE_ENV_STATE: ZoneEnvironment = {
  airTemperatureC: 25,
  relativeHumidity01: 0.6,
  co2_ppm: AMBIENT_CO2_PPM
};

function createInputs(
  overrides: Partial<HumidityActuatorInputs> = {}
): HumidityActuatorInputs {
  return {
    mode: 'dehumidify',
    capacity_g_per_h: 500,
    ...overrides
  };
}

describe('HumidityActuatorStub', () => {
  const stub = createHumidityActuatorStub();

  describe('dehumidify mode', () => {
    it('matches the reference delta for a 500 g/h dehumidifier', () => {
      const inputs = createInputs();
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.water_g).toBeCloseTo(500, 5);
      expect(result.deltaRH01).toBeLessThan(0);
      expect(result.deltaRH01).toBeCloseTo(-0.0125, 4);
    });

    it('removes water proportional to capacity and dt_h', () => {
      const inputs = createInputs({ capacity_g_per_h: 1_000 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, 0.5);

      expect(result.water_g).toBeCloseTo(500, 5);
      expect(result.deltaRH01).toBeLessThan(0);
    });

    it('converts capacity_L_per_h to grams correctly', () => {
      const inputs = createInputs({ capacity_g_per_h: undefined, capacity_L_per_h: 1.8 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.water_g).toBeCloseTo(1_800, 5);
      expect(result.deltaRH01).toBeLessThan(0);
    });
  });

  describe('humidify mode', () => {
    it('produces a positive humidity delta and negative water tally', () => {
      const inputs = createInputs({ mode: 'humidify', capacity_g_per_h: 300 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result.deltaRH01).toBeGreaterThan(0);
      expect(result.water_g).toBeCloseTo(-300, 5);
    });

    it('scales inversely with air mass', () => {
      const inputs = createInputs({ mode: 'humidify', capacity_g_per_h: 400 });
      const resultHalfMass = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG / 2, HOURS_PER_TICK);
      const resultFullMass = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(resultHalfMass.deltaRH01).toBeGreaterThan(resultFullMass.deltaRH01);
      expect(resultHalfMass.deltaRH01).toBeCloseTo(resultFullMass.deltaRH01 * 2, 5);
    });
  });

  describe('temperature dependency', () => {
    it('increases magnitude with higher temperatures', () => {
      const inputs = createInputs();
      const coolState: ZoneEnvironment = { ...BASE_ENV_STATE, airTemperatureC: 15 };
      const warmState: ZoneEnvironment = { ...BASE_ENV_STATE, airTemperatureC: 30 };

      const coolResult = stub.computeEffect(inputs, coolState, AIR_MASS_KG, HOURS_PER_TICK);
      const warmResult = stub.computeEffect(inputs, warmState, AIR_MASS_KG, HOURS_PER_TICK);

      expect(Math.abs(warmResult.deltaRH01)).toBeGreaterThan(Math.abs(coolResult.deltaRH01));
    });

    it('interpolates between lookup points', () => {
      const inputs = createInputs();
      const lowerState: ZoneEnvironment = { ...BASE_ENV_STATE, airTemperatureC: 20 };
      const midState: ZoneEnvironment = { ...BASE_ENV_STATE, airTemperatureC: 22.5 };
      const upperState: ZoneEnvironment = { ...BASE_ENV_STATE, airTemperatureC: 25 };

      const lower = stub.computeEffect(inputs, lowerState, AIR_MASS_KG, HOURS_PER_TICK);
      const mid = stub.computeEffect(inputs, midState, AIR_MASS_KG, HOURS_PER_TICK);
      const upper = stub.computeEffect(inputs, upperState, AIR_MASS_KG, HOURS_PER_TICK);

      expect(Math.abs(mid.deltaRH01)).toBeGreaterThan(Math.abs(lower.deltaRH01));
      expect(Math.abs(mid.deltaRH01)).toBeLessThan(Math.abs(upper.deltaRH01));
    });
  });

  describe('edge cases', () => {
    it('returns zeros when capacity is zero', () => {
      const inputs = createInputs({ capacity_g_per_h: 0 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK);

      expect(result).toEqual({ deltaRH01: 0, water_g: 0, energy_Wh: 0 });
    });

    it('returns zeros when air mass is zero', () => {
      const inputs = createInputs();
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, 0, HOURS_PER_TICK);

      expect(result).toEqual({ deltaRH01: 0, water_g: 0, energy_Wh: 0 });
    });

    it('returns zeros when dt_h is zero', () => {
      const inputs = createInputs();
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, 0);

      expect(result).toEqual({ deltaRH01: 0, water_g: 0, energy_Wh: 0 });
    });

    it('throws when neither capacity field is provided', () => {
      const inputs = createInputs({ capacity_g_per_h: undefined });

      expect(() => stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK)).toThrow(
        'Humidity actuator requires capacity_g_per_h or capacity_L_per_h'
      );
    });

    it('throws when capacity is negative', () => {
      const inputs = createInputs({ capacity_g_per_h: -10 });

      expect(() => stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK)).toThrow(RangeError);
    });

    it('throws when mode is invalid', () => {
      const inputs = createInputs({ mode: 'invalid' as never });

      expect(() => stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, HOURS_PER_TICK)).toThrow(
        'Unsupported humidity actuator mode'
      );
    });
  });

  describe('output structure', () => {
    it('always returns finite numeric outputs with zero energy coupling', () => {
      const inputs = createInputs({ capacity_g_per_h: 750 });
      const result = stub.computeEffect(inputs, BASE_ENV_STATE, AIR_MASS_KG, 0.75);

      expect(Number.isFinite(result.deltaRH01)).toBe(true);
      expect(Number.isFinite(result.water_g)).toBe(true);
      expect(result.energy_Wh).toBe(0);
    });
  });
});

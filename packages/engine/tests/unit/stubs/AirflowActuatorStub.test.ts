import { describe, expect, it } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants.js';
import { createAirflowActuatorStub } from '@/backend/src/stubs/AirflowActuatorStub.js';
import type { AirflowActuatorInputs } from '@/backend/src/domain/interfaces/IAirflowActuator.js';

const ZONE_VOLUME_M3 = 50;
const BASE_INPUTS: AirflowActuatorInputs = {
  airflow_m3_per_h: 200,
  mode: 'exhaust',
  dutyCycle01: 1
};

function createInputs(overrides: Partial<AirflowActuatorInputs> = {}): AirflowActuatorInputs {
  return {
    ...BASE_INPUTS,
    ...overrides
  };
}

describe('AirflowActuatorStub', () => {
  const stub = createAirflowActuatorStub();

  describe('basic calculations', () => {
    it('computes effective airflow with dutyCycle01 = 1.0', () => {
      const result = stub.computeEffect(BASE_INPUTS, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBeCloseTo(200, 5);
      expect(result.ach).toBeCloseTo(4, 5);
      expect(result.pressure_loss_pa).toBe(0);
      expect(result.energy_Wh).toBeUndefined();
    });

    it('computes effective airflow with dutyCycle01 = 0.5', () => {
      const inputs = createInputs({ dutyCycle01: 0.5 });
      const result = stub.computeEffect(inputs, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBeCloseTo(100, 5);
      expect(result.ach).toBeCloseTo(2, 5);
    });

    it('computes ACH correctly for varying zone volumes', () => {
      const inputs = createInputs({ airflow_m3_per_h: 300 });
      const result = stub.computeEffect(inputs, 75, HOURS_PER_TICK);

      expect(result.ach).toBeCloseTo(4, 5);
    });
  });

  describe('edge cases', () => {
    it('returns zeros when airflow_m3_per_h is zero', () => {
      const inputs = createInputs({ airflow_m3_per_h: 0 });
      const result = stub.computeEffect(inputs, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBe(0);
      expect(result.ach).toBe(0);
    });

    it('returns zeros when dutyCycle01 is zero', () => {
      const inputs = createInputs({ dutyCycle01: 0 });
      const result = stub.computeEffect(inputs, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBe(0);
      expect(result.ach).toBe(0);
    });

    it('returns zeros when zoneVolume_m3 is zero', () => {
      const result = stub.computeEffect(BASE_INPUTS, 0, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBe(0);
      expect(result.ach).toBe(0);
    });

    it('returns zeros when dt_h is zero', () => {
      const result = stub.computeEffect(BASE_INPUTS, ZONE_VOLUME_M3, 0);

      expect(result.effective_airflow_m3_per_h).toBe(0);
      expect(result.ach).toBe(0);
    });

    it('clamps negative airflow to zero', () => {
      const inputs = createInputs({ airflow_m3_per_h: -150 });
      const result = stub.computeEffect(inputs, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBe(0);
      expect(result.ach).toBe(0);
    });

    it('clamps dutyCycle01 above one to 1.0', () => {
      const inputs = createInputs({ dutyCycle01: 1.5 });
      const result = stub.computeEffect(inputs, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBeCloseTo(200, 5);
      expect(result.ach).toBeCloseTo(4, 5);
    });
  });

  describe('mode handling', () => {
    it('accepts recirculation mode without changing calculations', () => {
      const inputs = createInputs({ mode: 'recirculation' });
      const result = stub.computeEffect(inputs, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBeCloseTo(200, 5);
      expect(result.ach).toBeCloseTo(4, 5);
    });

    it('accepts intake mode without changing calculations', () => {
      const inputs = createInputs({ mode: 'intake' });
      const result = stub.computeEffect(inputs, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(result.effective_airflow_m3_per_h).toBeCloseTo(200, 5);
      expect(result.ach).toBeCloseTo(4, 5);
    });
  });

  describe('output structure', () => {
    it('always returns finite numeric outputs', () => {
      const inputs = createInputs({ airflow_m3_per_h: 180, dutyCycle01: 0.75 });
      const result = stub.computeEffect(inputs, ZONE_VOLUME_M3, HOURS_PER_TICK);

      expect(Number.isFinite(result.effective_airflow_m3_per_h)).toBe(true);
      expect(Number.isFinite(result.ach)).toBe(true);
      expect(result.pressure_loss_pa).toBe(0);
      expect(result.energy_Wh).toBeUndefined();
    });
  });
});

import { describe, expect, it } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants';
import { createFiltrationStub } from '@/backend/src/stubs/FiltrationStub';
import type { FiltrationUnitInputs } from '@/backend/src/domain/interfaces/IFiltrationUnit';

const BASE_INPUTS: FiltrationUnitInputs = {
  airflow_m3_per_h: 200,
  filterType: 'carbon',
  efficiency01: 0.9,
  condition01: 1,
  basePressureDrop_pa: 100
};

function createInputs(overrides: Partial<FiltrationUnitInputs> = {}): FiltrationUnitInputs {
  return {
    ...BASE_INPUTS,
    ...overrides
  };
}

describe('FiltrationStub', () => {
  const stub = createFiltrationStub();

  describe('pressure drop calculations', () => {
    it('computes pressure drop at perfect condition', () => {
      const result = stub.computeEffect(BASE_INPUTS, HOURS_PER_TICK);

      expect(result.pressure_drop_pa).toBeCloseTo(100, 5);
      expect(result.airflow_reduction_m3_per_h).toBeGreaterThan(0);
    });

    it('increases pressure drop when condition deteriorates', () => {
      const inputs = createInputs({ condition01: 0.5 });
      const result = stub.computeEffect(inputs, HOURS_PER_TICK);

      expect(result.pressure_drop_pa).toBeGreaterThan(100);
    });

    it('scales pressure drop with airflow throughput', () => {
      const lowFlow = stub.computeEffect(createInputs({ airflow_m3_per_h: 150 }), HOURS_PER_TICK);
      const highFlow = stub.computeEffect(createInputs({ airflow_m3_per_h: 400 }), HOURS_PER_TICK);

      expect(highFlow.pressure_drop_pa).toBeGreaterThan(lowFlow.pressure_drop_pa);
    });
  });

  describe('airflow reduction', () => {
    it('reduces airflow proportional to pressure drop', () => {
      const result = stub.computeEffect(BASE_INPUTS, HOURS_PER_TICK);

      expect(result.airflow_reduction_m3_per_h).toBeGreaterThan(0);
      expect(result.airflow_reduction_m3_per_h).toBeLessThan(BASE_INPUTS.airflow_m3_per_h);
    });

    it('clamps reduction to 30% of input airflow', () => {
      const inputs = createInputs({ airflow_m3_per_h: 500, basePressureDrop_pa: 300 });
      const result = stub.computeEffect(inputs, HOURS_PER_TICK);
      const maxReduction = inputs.airflow_m3_per_h * 0.3;

      expect(result.airflow_reduction_m3_per_h).toBeCloseTo(maxReduction, 5);
    });

    it('returns zero reduction when airflow is zero', () => {
      const result = stub.computeEffect(createInputs({ airflow_m3_per_h: 0 }), HOURS_PER_TICK);

      expect(result.airflow_reduction_m3_per_h).toBe(0);
      expect(result.pressure_drop_pa).toBe(0);
    });
  });

  describe('odor concentration', () => {
    it('reduces odor concentration proportionally to efficiency and condition', () => {
      const result = stub.computeEffect(BASE_INPUTS, HOURS_PER_TICK);

      expect(result.odor_concentration_delta).toBeLessThan(0);
    });

    it('scales odor reduction with volumetric flow and dt', () => {
      const lowFlow = stub.computeEffect(BASE_INPUTS, HOURS_PER_TICK);
      const highFlow = stub.computeEffect(createInputs({ airflow_m3_per_h: 400 }), HOURS_PER_TICK);

      expect(highFlow.odor_concentration_delta).toBeLessThan(lowFlow.odor_concentration_delta);
    });
  });

  describe('particulate removal', () => {
    it('reports near 99% removal for HEPA filters at full efficiency', () => {
      const result = stub.computeEffect(
        createInputs({ filterType: 'hepa', efficiency01: 1, basePressureDrop_pa: 200 }),
        HOURS_PER_TICK
      );

      expect(result.particulate_removal_pct).toBeCloseTo(99, 5);
    });

    it('reports 60% removal baseline for pre-filters at full efficiency', () => {
      const result = stub.computeEffect(
        createInputs({ filterType: 'pre-filter', efficiency01: 1, basePressureDrop_pa: 120 }),
        HOURS_PER_TICK
      );

      expect(result.particulate_removal_pct).toBeCloseTo(60, 5);
    });

    it('reports zero particulate removal for carbon filters', () => {
      const result = stub.computeEffect(BASE_INPUTS, HOURS_PER_TICK);

      expect(result.particulate_removal_pct).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('clamps efficiency and condition to [0,1]', () => {
      const result = stub.computeEffect(
        createInputs({ efficiency01: 1.5, condition01: -0.5, basePressureDrop_pa: 150 }),
        HOURS_PER_TICK
      );

      expect(result.odor_concentration_delta).toBeGreaterThanOrEqual(-BASE_INPUTS.airflow_m3_per_h);
      expect(result.pressure_drop_pa).toBeGreaterThanOrEqual(0);
    });

    it('returns zeros when basePressureDrop_pa is zero', () => {
      const result = stub.computeEffect(createInputs({ basePressureDrop_pa: 0 }), HOURS_PER_TICK);

      expect(result.pressure_drop_pa).toBe(0);
      expect(result.airflow_reduction_m3_per_h).toBe(0);
      expect(result.odor_concentration_delta).toBe(0);
    });
  });

  describe('output structure', () => {
    it('always returns finite numeric outputs', () => {
      const result = stub.computeEffect(
        createInputs({ airflow_m3_per_h: 250, efficiency01: 0.8, condition01: 0.7 }),
        HOURS_PER_TICK
      );

      expect(Number.isFinite(result.pressure_drop_pa)).toBe(true);
      expect(Number.isFinite(result.airflow_reduction_m3_per_h)).toBe(true);
      expect(Number.isFinite(result.particulate_removal_pct)).toBe(true);
      expect(Number.isFinite(result.odor_concentration_delta)).toBe(true);
      expect(result.odor_concentration_delta).toBeLessThanOrEqual(0);
      expect(result.airflow_reduction_m3_per_h).toBeGreaterThanOrEqual(0);
    });
  });
});

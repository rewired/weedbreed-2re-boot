import type {
  FiltrationUnitInputs,
  FiltrationUnitOutputs,
  IFiltrationUnit
} from '../domain/interfaces/IFiltrationUnit.ts';
import { clamp01 } from '../util/math.ts';
import { resolveAirflow } from '../util/environment.ts';

/* eslint-disable @typescript-eslint/no-magic-numbers -- Filtration stub uses fixed empirical constants */
const FILTRATION_REFERENCE_AIRFLOW_M3_PER_H = 200 as const;
const FILTRATION_PRESSURE_EXPONENT = 1.5 as const;
const FILTRATION_REDUCTION_MULTIPLIER = 0.005 as const;
const FILTRATION_MAX_REDUCTION_FACTOR = 0.3 as const;
const FILTRATION_HEPA_REMOVAL_FACTOR = 0.99 as const;
const FILTRATION_PREFILTER_REMOVAL_FACTOR = 0.6 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

function resolveBasePressureDrop(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

function resolveDtHours(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

/**
 * Factory producing a deterministic stub implementation of {@link IFiltrationUnit}.
 *
 * Implements the consolidated SEC spec (Section 4, Pattern C) where filters
 * introduce pressure drops that reduce upstream airflow, emit odour telemetry
 * and track particulate removal. Designed for chaining with
 * {@link createAirflowActuatorStub}.
 */
export function createFiltrationStub(): IFiltrationUnit {
  return {
    computeEffect(inputs: FiltrationUnitInputs, dt_h: number): FiltrationUnitOutputs {
      const airflow_m3_per_h = resolveAirflow(inputs.airflow_m3_per_h);
      const efficiency01 = clamp01(inputs.efficiency01);
      const condition01 = clamp01(inputs.condition01);
      const basePressureDrop_pa = resolveBasePressureDrop(inputs.basePressureDrop_pa);
      const resolvedDt_h = resolveDtHours(dt_h);

      if (airflow_m3_per_h === 0 || resolvedDt_h === 0 || basePressureDrop_pa === 0) {
        return {
          odor_concentration_delta: 0,
          particulateRemoval01: 0,
          pressure_drop_pa: 0,
          airflow_reduction_m3_per_h: 0
        } satisfies FiltrationUnitOutputs;
      }

      const conditionFactor = 1 + (1 - condition01) * 2;
      const airflowRatio = Math.max(airflow_m3_per_h / FILTRATION_REFERENCE_AIRFLOW_M3_PER_H, 0);
      const pressure_drop_pa =
        basePressureDrop_pa * conditionFactor * Math.pow(airflowRatio, FILTRATION_PRESSURE_EXPONENT);
      const unclampedReduction = pressure_drop_pa * FILTRATION_REDUCTION_MULTIPLIER * airflow_m3_per_h;
      const maxReduction = airflow_m3_per_h * FILTRATION_MAX_REDUCTION_FACTOR;
      const airflow_reduction_m3_per_h = Math.min(Math.max(unclampedReduction, 0), maxReduction);
      const odor_concentration_delta = -efficiency01 * condition01 * (airflow_m3_per_h / 100) * resolvedDt_h;

      let particulateRemoval01 = 0;

      if (inputs.filterType === 'hepa') {
        particulateRemoval01 = efficiency01 * FILTRATION_HEPA_REMOVAL_FACTOR;
      } else if (inputs.filterType === 'pre-filter') {
        particulateRemoval01 = efficiency01 * FILTRATION_PREFILTER_REMOVAL_FACTOR;
      }

      return {
        odor_concentration_delta,
        particulateRemoval01,
        pressure_drop_pa,
        airflow_reduction_m3_per_h
      } satisfies FiltrationUnitOutputs;
    }
  } satisfies IFiltrationUnit;
}

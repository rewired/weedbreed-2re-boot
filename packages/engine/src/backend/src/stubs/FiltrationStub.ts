import type {
  FiltrationUnitInputs,
  FiltrationUnitOutputs,
  IFiltrationUnit
} from '../domain/interfaces/IFiltrationUnit.ts';
import { clamp01 } from '../util/math.ts';
import { resolveAirflow } from '../util/environment.ts';

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
          particulate_removal_pct: 0,
          pressure_drop_pa: 0,
          airflow_reduction_m3_per_h: 0
        } satisfies FiltrationUnitOutputs;
      }

      const conditionFactor = 1 + (1 - condition01) * 2;
      const airflowRatio = Math.max(airflow_m3_per_h / 200, 0);
      const pressure_drop_pa = basePressureDrop_pa * conditionFactor * Math.pow(airflowRatio, 1.5);
      const unclampedReduction = pressure_drop_pa * 0.005 * airflow_m3_per_h;
      const maxReduction = airflow_m3_per_h * 0.3;
      const airflow_reduction_m3_per_h = Math.min(Math.max(unclampedReduction, 0), maxReduction);
      const odor_concentration_delta = -efficiency01 * condition01 * (airflow_m3_per_h / 100) * resolvedDt_h;

      let particulate_removal_pct = 0;

      if (inputs.filterType === 'hepa') {
        particulate_removal_pct = efficiency01 * 99;
      } else if (inputs.filterType === 'pre-filter') {
        particulate_removal_pct = efficiency01 * 60;
      }

      return {
        odor_concentration_delta,
        particulate_removal_pct,
        pressure_drop_pa,
        airflow_reduction_m3_per_h
      } satisfies FiltrationUnitOutputs;
    }
  } satisfies IFiltrationUnit;
}

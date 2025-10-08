import type {
  AirflowActuatorInputs,
  AirflowActuatorOutputs,
  IAirflowActuator
} from '../domain/interfaces/IAirflowActuator.ts';
import { clamp01 } from '../util/math.ts';
import { resolveAirflow } from '../util/environment.ts';
import { resolveTickHoursValue } from '../engine/resolveTickHours.ts';

const ZERO_OUTPUT: AirflowActuatorOutputs = {
  effective_airflow_m3_per_h: 0,
  ach: 0,
  pressure_loss_pa: 0,
  energy_Wh: undefined
};

function resolveVolume(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

/**
 * Factory producing a deterministic stub implementation of {@link IAirflowActuator}.
 *
 * Mirrors the consolidated SEC spec (Section 4, Pattern C) by modelling fans as
 * pure producers whose output may be reduced by downstream filtration units.
 * The stub intentionally omits intrinsic pressure losses, delegating those to
 * {@link createFiltrationStub} to support chained Fan→Filter pipelines.
 */
export function createAirflowActuatorStub(): IAirflowActuator {
  return {
    computeEffect(
      inputs: AirflowActuatorInputs,
      zoneVolume_m3: number,
      dt_h: number,
    ): AirflowActuatorOutputs {
      const dutyCycle01 = clamp01(inputs.dutyCycle01);
      const airflow_m3_per_h = resolveAirflow(inputs.airflow_m3_per_h);
      const resolvedVolume_m3 = resolveVolume(zoneVolume_m3);
      const resolvedDt_h = resolveTickHoursValue(dt_h);

      if (resolvedVolume_m3 <= 0 || resolvedDt_h <= 0 || airflow_m3_per_h === 0 || dutyCycle01 === 0) {
        return ZERO_OUTPUT;
      }

      const effective_airflow_m3_per_h = airflow_m3_per_h * dutyCycle01;
      const ach = effective_airflow_m3_per_h / resolvedVolume_m3;

      return {
        effective_airflow_m3_per_h,
        ach,
        pressure_loss_pa: 0,
        energy_Wh: undefined
      } satisfies AirflowActuatorOutputs;
    },
  } satisfies IAirflowActuator;
}

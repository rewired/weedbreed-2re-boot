import {
  CP_AIR_J_PER_KG_K,
  HOURS_PER_TICK,
  SECONDS_PER_HOUR
} from '../constants/simConstants.js';
import type {
  IThermalActuator,
  ThermalActuatorInputs,
  ThermalActuatorOutputs
} from '../domain/interfaces/IThermalActuator.js';
import type { ZoneEnvironment } from '../domain/entities.js';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function resolveTickHours(tickHours: number | undefined): number {
  if (typeof tickHours !== 'number') {
    return HOURS_PER_TICK;
  }

  if (!Number.isFinite(tickHours) || tickHours <= 0) {
    return HOURS_PER_TICK;
  }

  return tickHours;
}

function resolveAirMassKg(airMass_kg: number): number {
  if (!Number.isFinite(airMass_kg) || airMass_kg <= 0) {
    return 0;
  }

  return airMass_kg;
}

function ensureFiniteOutputs(outputs: ThermalActuatorOutputs): ThermalActuatorOutputs {
  const { deltaT_K, energy_Wh, used_W } = outputs;

  if (!Number.isFinite(deltaT_K) || !Number.isFinite(energy_Wh) || !Number.isFinite(used_W)) {
    throw new Error('Thermal actuator outputs must be finite numbers.');
  }

  return outputs;
}

/**
 * Factory producing a deterministic stub implementation of {@link IThermalActuator}.
 *
 * The stub mirrors the consolidated spec (Section 4.1 ThermalActuatorStub):
 *
 * - **Heating mode** converts unused electrical power (`wasteHeat_W`) into a
 *   positive sensible heat delta based on the canonical dry-air properties.
 * - **Cooling mode** removes sensible heat (`cooling_W`) while respecting the
 *   provided cooling capacity limit, yielding a negative temperature delta.
 * - **Auto mode** compares the requested setpoint against the current zone
 *   environment and dynamically selects heating or cooling. Equal temperatures
 *   short-circuit to a neutral effect.
 *
 * The implementation is intentionally pure to support composition with the
 * {@link compose} helper and remains aligned with the legacy heating-only
 * behaviour exposed by {@link applyDeviceHeat}.
 */
export function createThermalActuatorStub(): IThermalActuator {
  return {
    computeEffect(
      inputs: ThermalActuatorInputs,
      envState: ZoneEnvironment,
      airMass_kg: number,
      dt_h: number,
    ): ThermalActuatorOutputs {
      const efficiency = inputs.efficiency01;

      if (!Number.isFinite(efficiency) || efficiency < 0 || efficiency > 1) {
        throw new RangeError('Actuator efficiency must lie within [0,1].');
      }

      if (
        typeof dt_h === 'number' &&
        (!Number.isFinite(dt_h) || dt_h <= 0)
      ) {
        return { deltaT_K: 0, energy_Wh: 0, used_W: 0 };
      }

      const resolvedDt_h = resolveTickHours(dt_h);
      const resolvedAirMass = resolveAirMassKg(airMass_kg);
      const powerDraw_W = Math.max(0, inputs.power_W);

      if (powerDraw_W === 0 || resolvedDt_h === 0 || resolvedAirMass === 0) {
        return { deltaT_K: 0, energy_Wh: 0, used_W: 0 };
      }

      const mode = inputs.mode;

      if (mode === 'auto') {
        const setpoint = inputs.setpoint_C;

        if (typeof setpoint !== 'number' || !Number.isFinite(setpoint)) {
          throw new Error('Auto mode requires setpoint_C');
        }

        if (setpoint > envState.airTemperatureC) {
          return ensureFiniteOutputs(
            computeHeatingEffect(
              powerDraw_W,
              efficiency,
              inputs.max_heat_W,
              resolvedDt_h,
              resolvedAirMass,
            ),
          );
        }

        if (setpoint < envState.airTemperatureC) {
          return ensureFiniteOutputs(
            computeCoolingEffect(
              powerDraw_W,
              efficiency,
              inputs.max_cool_W,
              resolvedDt_h,
              resolvedAirMass,
            ),
          );
        }

        return { deltaT_K: 0, energy_Wh: 0, used_W: 0 };
      }

      if (mode === 'heat') {
        return ensureFiniteOutputs(
          computeHeatingEffect(
            powerDraw_W,
            efficiency,
            inputs.max_heat_W,
            resolvedDt_h,
            resolvedAirMass,
          ),
        );
      } else if (mode === 'cool') {
        return ensureFiniteOutputs(
          computeCoolingEffect(
            powerDraw_W,
            efficiency,
            inputs.max_cool_W,
            resolvedDt_h,
            resolvedAirMass,
          ),
        );
      }

      throw new Error('Unsupported thermal actuator mode');
    },
  } satisfies IThermalActuator;
}

function computeHeatingEffect(
  powerDraw_W: number,
  efficiency01: number,
  max_heat_W: number | undefined,
  dt_h: number,
  airMass_kg: number,
): ThermalActuatorOutputs {
  const effectiveMax =
    typeof max_heat_W === 'number' && Number.isFinite(max_heat_W)
      ? Math.max(0, max_heat_W)
      : Infinity;
  const wasteHeat_W = clamp(
    powerDraw_W * (1 - clamp01(efficiency01)),
    0,
    effectiveMax,
  );

  if (wasteHeat_W === 0) {
    return { deltaT_K: 0, energy_Wh: powerDraw_W * dt_h, used_W: 0 };
  }

  const joules = wasteHeat_W * dt_h * SECONDS_PER_HOUR;
  const deltaT_K = joules / (airMass_kg * CP_AIR_J_PER_KG_K);

  return {
    deltaT_K,
    energy_Wh: powerDraw_W * dt_h,
    used_W: wasteHeat_W,
  } satisfies ThermalActuatorOutputs;
}

function computeCoolingEffect(
  powerDraw_W: number,
  efficiency01: number,
  max_cool_W: number | undefined,
  dt_h: number,
  airMass_kg: number,
): ThermalActuatorOutputs {
  const effectiveMax =
    typeof max_cool_W === 'number' && Number.isFinite(max_cool_W)
      ? Math.max(0, max_cool_W)
      : Infinity;
  const cooling_W = clamp(powerDraw_W * clamp01(efficiency01), 0, effectiveMax);

  if (cooling_W === 0) {
    return { deltaT_K: 0, energy_Wh: powerDraw_W * dt_h, used_W: 0 };
  }

  const joules = cooling_W * dt_h * SECONDS_PER_HOUR;
  const deltaT_K = -joules / (airMass_kg * CP_AIR_J_PER_KG_K);

  return {
    deltaT_K,
    energy_Wh: powerDraw_W * dt_h,
    used_W: cooling_W,
  } satisfies ThermalActuatorOutputs;
}

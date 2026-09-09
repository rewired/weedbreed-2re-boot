import type { ThermalActuatorInputs } from '../../../domain/interfaces/index.ts';
import type { ZoneDeviceInstance } from '../../../domain/entities.ts';
import type { Zone } from '../../../domain/world.ts';
import { createThermalActuatorStub } from '../../../stubs/index.ts';
import { clamp01 } from '../../../util/math.ts';
import type { DeviceEffectsRuntime } from '../applyDeviceEffects.ts';

export function accumulateTemperatureDelta(
  runtime: DeviceEffectsRuntime,
  zoneId: Zone['id'],
  deltaC: number
): void {
  if (!Number.isFinite(deltaC) || deltaC === 0) {
    return;
  }

  const current = runtime.zoneTemperatureDeltaC.get(zoneId) ?? 0;
  runtime.zoneTemperatureDeltaC.set(zoneId, current + deltaC);
}

function deriveThermalInputs(device: ZoneDeviceInstance): ThermalActuatorInputs | null {
  const power_W = Number.isFinite(device.powerDraw_W) ? device.powerDraw_W : 0;
  const duty01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);

  if (power_W <= 0 || duty01 <= 0) {
    return null;
  }

  const efficiency01 = clamp01(Number.isFinite(device.efficiency01) ? device.efficiency01 : 0);
  const effectivePower_W = power_W * duty01;
  const effects = device.effects ?? [];

  if (effects.includes('thermal') && device.effectConfigs?.thermal) {
    const config = device.effectConfigs.thermal;
    return {
      power_W: effectivePower_W,
      efficiency01,
      mode: typeof config.setpoint_C === 'number' ? 'auto' : config.mode,
      ...(typeof config.max_heat_W === 'number'
        ? { max_heat_W: config.max_heat_W * duty01 }
        : {}),
      ...(typeof config.max_cool_W === 'number'
        ? { max_cool_W: config.max_cool_W * duty01 }
        : {}),
      ...(typeof config.setpoint_C === 'number' ? { setpoint_C: config.setpoint_C } : {}),
    } satisfies ThermalActuatorInputs;
  }

  const maxCool_W = Number.isFinite(device.sensibleHeatRemovalCapacity_W)
    ? device.sensibleHeatRemovalCapacity_W
    : 0;

  if (maxCool_W > 0) {
    const legacyCooling_W = Math.min(
      effectivePower_W * efficiency01,
      maxCool_W * duty01,
    );
    return {
      power_W: effectivePower_W,
      efficiency01,
      mode: 'cool',
      max_cool_W: efficiency01 > 0 ? legacyCooling_W / efficiency01 : 0,
    } satisfies ThermalActuatorInputs;
  }

  return {
    power_W: effectivePower_W,
    efficiency01,
    mode: 'heat'
  } satisfies ThermalActuatorInputs;
}

export interface ThermalEffectResult {
  readonly thermalInputs: ThermalActuatorInputs | null;
  readonly thermalDeltaK: number;
}

export function applyThermalEffect(
  device: ZoneDeviceInstance,
  zone: Zone,
  runtime: DeviceEffectsRuntime,
  tickHours: number,
  effectiveness01: number
): ThermalEffectResult {
  const thermalInputs = deriveThermalInputs(device);
  let thermalDeltaK = 0;

  if (thermalInputs) {
    const thermalStub = createThermalActuatorStub();
    const accumulatedDelta = runtime.zoneTemperatureDeltaC.get(zone.id) ?? 0;
    const projectedEnvironment = {
      ...zone.environment,
      airTemperatureC: zone.environment.airTemperatureC + accumulatedDelta,
    };
    const { deltaT_K } = thermalStub.computeEffect(
      thermalInputs,
      projectedEnvironment,
      zone.airMass_kg,
      tickHours
    );
    thermalDeltaK = deltaT_K;
    if (typeof thermalInputs.setpoint_C === 'number') {
      const projectedTemperature = zone.environment.airTemperatureC + accumulatedDelta;
      const remainingDelta = thermalInputs.setpoint_C - projectedTemperature;
      thermalDeltaK = remainingDelta > 0
        ? Math.max(0, Math.min(deltaT_K, remainingDelta))
        : Math.min(0, Math.max(deltaT_K, remainingDelta));
    }
    accumulateTemperatureDelta(runtime, zone.id, thermalDeltaK * effectiveness01);
  }

  return { thermalInputs, thermalDeltaK };
}

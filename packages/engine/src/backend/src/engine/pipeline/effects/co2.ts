import type { Co2InjectorInputs } from '../../../domain/interfaces/index.ts';
import type { ZoneDeviceInstance } from '../../../domain/entities.ts';
import type { Zone } from '../../../domain/world.ts';
import { createCo2InjectorStub } from '../../../stubs/index.ts';
import type { DeviceEffectsRuntime } from '../applyDeviceEffects.ts';

function deriveCo2Inputs(device: ZoneDeviceInstance): Co2InjectorInputs | null {
  const effects = device.effects ?? [];

  if (!effects.includes('co2') || !device.effectConfigs?.co2) {
    return null;
  }

  const config = device.effectConfigs.co2;
  const dutyCycle01 = Number.isFinite(device.dutyCycle01) ? Math.max(0, Math.min(1, device.dutyCycle01)) : 0;
  const power_W = Number.isFinite(device.powerDraw_W) ? Math.max(0, device.powerDraw_W) : 0;

  if (!Number.isFinite(config.target_ppm) || !Number.isFinite(config.pulse_ppm_per_tick)) {
    return null;
  }

  if (!Number.isFinite(config.safetyMax_ppm)) {
    return null;
  }

  return {
    power_W,
    dutyCycle01,
    target_ppm: config.target_ppm,
    safetyMax_ppm: config.safetyMax_ppm,
    pulse_ppm_per_tick: config.pulse_ppm_per_tick,
    min_ppm: config.min_ppm,
    ambient_ppm: config.ambient_ppm,
    hysteresis_ppm: config.hysteresis_ppm
  } satisfies Co2InjectorInputs;
}

function accumulateCo2Delta(runtime: DeviceEffectsRuntime, zoneId: Zone['id'], delta_ppm: number): void {
  if (!Number.isFinite(delta_ppm) || delta_ppm === 0) {
    return;
  }

  const current = runtime.zoneCo2Delta_ppm.get(zoneId) ?? 0;
  runtime.zoneCo2Delta_ppm.set(zoneId, current + delta_ppm);
}

export function applyCo2Effect(
  device: ZoneDeviceInstance,
  zone: Zone,
  runtime: DeviceEffectsRuntime,
  tickHours: number
): void {
  const co2Inputs = deriveCo2Inputs(device);

  if (!co2Inputs) {
    return;
  }

  const co2Stub = createCo2InjectorStub();
  const { delta_ppm } = co2Stub.computeEffect(co2Inputs, zone.environment, tickHours);
  accumulateCo2Delta(runtime, zone.id, delta_ppm);
}

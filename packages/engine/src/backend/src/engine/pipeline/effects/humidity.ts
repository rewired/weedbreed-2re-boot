import { CP_AIR_J_PER_KG_K, LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG } from '../../../constants/simConstants.ts';
import { LEGACY_DEHUMIDIFIER_CAPACITY_G_PER_H, LEGACY_HUMIDIFIER_CAPACITY_G_PER_H } from '../../../constants/climate.ts';
import type { HumidityActuatorInputs, ThermalActuatorInputs } from '../../../domain/interfaces/index.ts';
import type { ZoneDeviceInstance } from '../../../domain/entities.ts';
import type { Zone } from '../../../domain/world.ts';
import { createHumidityActuatorStub } from '../../../stubs/index.ts';
import { clamp01 } from '../../../util/math.ts';
import type { DeviceEffectsRuntime } from '../applyDeviceEffects.ts';
import { accumulateTemperatureDelta } from './thermal.ts';

const GRAMS_PER_KG = 1_000;

type LatentDisposition = -1 | 0 | 1;

function resolveLatentDisposition(
  thermalInputs: ThermalActuatorInputs | null,
  thermalDeltaK: number
): LatentDisposition {
  if (thermalInputs) {
    if (thermalInputs.mode === 'cool') {
      return -1;
    }

    if (thermalInputs.mode === 'heat') {
      return 1;
    }

    if (thermalInputs.mode === 'auto') {
      if (thermalDeltaK < 0) {
        return -1;
      }

      if (thermalDeltaK > 0) {
        return 1;
      }

      return 0;
    }
  }

  return 1;
}

function computeLatentTemperatureDelta(
  water_g: number,
  airMass_kg: number,
  effectiveness01: number,
  thermalInputs: ThermalActuatorInputs | null,
  thermalDeltaK: number
): number {
  if (!Number.isFinite(water_g) || water_g === 0) {
    return 0;
  }

  if (!Number.isFinite(airMass_kg) || airMass_kg <= 0) {
    return 0;
  }

  if (!Number.isFinite(effectiveness01) || effectiveness01 <= 0) {
    return 0;
  }

  const disposition = resolveLatentDisposition(thermalInputs, thermalDeltaK);

  if (disposition === 0) {
    return 0;
  }

  const latentHeat_J =
    (water_g / GRAMS_PER_KG) * LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG * disposition;
  const deltaK = latentHeat_J / (airMass_kg * CP_AIR_J_PER_KG_K);

  if (!Number.isFinite(deltaK) || deltaK === 0) {
    return 0;
  }

  return deltaK * effectiveness01;
}

function deriveHumidityInputs(device: ZoneDeviceInstance): HumidityActuatorInputs | null {
  const slug = (device.slug ?? '').toLowerCase();
  const name = (device.name ?? '').toLowerCase();
  const duty01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);

  if (duty01 <= 0) {
    return null;
  }

  const effects = device.effects ?? [];

  if (effects.includes('humidity') && device.effectConfigs?.humidity) {
    const config = device.effectConfigs.humidity;

    if (!Number.isFinite(config.capacity_g_per_h) || config.capacity_g_per_h <= 0) {
      return null;
    }

    return {
      mode: config.mode,
      capacity_g_per_h: config.capacity_g_per_h * duty01
    } satisfies HumidityActuatorInputs;
  }

  if (slug.includes('dehumid') || name.includes('dehumid')) {
    return {
      mode: 'dehumidify',
      capacity_g_per_h: LEGACY_DEHUMIDIFIER_CAPACITY_G_PER_H * duty01
    } satisfies HumidityActuatorInputs;
  }

  if (slug.includes('humid') || name.includes('humid')) {
    return {
      mode: 'humidify',
      capacity_g_per_h: LEGACY_HUMIDIFIER_CAPACITY_G_PER_H * duty01
    } satisfies HumidityActuatorInputs;
  }

  return null;
}

function accumulateHumidityDelta(
  runtime: DeviceEffectsRuntime,
  zoneId: Zone['id'],
  deltaPct: number
): void {
  if (!Number.isFinite(deltaPct) || deltaPct === 0) {
    return;
  }

  const current = runtime.zoneHumidityDeltaPct.get(zoneId) ?? 0;
  runtime.zoneHumidityDeltaPct.set(zoneId, current + deltaPct);
}

export interface HumidityEffectResult {
  readonly latentDeltaK: number;
}

export function applyHumidityEffect(
  device: ZoneDeviceInstance,
  zone: Zone,
  runtime: DeviceEffectsRuntime,
  tickHours: number,
  effectiveness01: number,
  thermalInputs: ThermalActuatorInputs | null,
  thermalDeltaK: number
): HumidityEffectResult {
  const humidityInputs = deriveHumidityInputs(device);
  let latentDeltaK = 0;

  if (humidityInputs) {
    const humidityStub = createHumidityActuatorStub();
    const { deltaRH_pct, water_g } = humidityStub.computeEffect(
      humidityInputs,
      zone.environment,
      zone.airMass_kg,
      tickHours
    );
    accumulateHumidityDelta(runtime, zone.id, deltaRH_pct);

    latentDeltaK = computeLatentTemperatureDelta(
      water_g,
      zone.airMass_kg,
      effectiveness01,
      thermalInputs,
      thermalDeltaK
    );

    if (latentDeltaK !== 0) {
      accumulateTemperatureDelta(runtime, zone.id, latentDeltaK);
    }
  }

  return { latentDeltaK };
}

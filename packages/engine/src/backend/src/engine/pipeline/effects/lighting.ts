import { LEGACY_PHOTON_EFFICACY_UMOL_PER_J } from '../../../constants/lighting.ts';
import type { LightEmitterInputs } from '../../../domain/interfaces/index.ts';
import type { ZoneDeviceInstance } from '../../../domain/entities.ts';
import type { Zone } from '../../../domain/world.ts';
import { createLightEmitterStub } from '../../../stubs/index.ts';
import { clamp01 } from '../../../util/math.ts';
import type { DeviceEffectsRuntime } from '../applyDeviceEffects.ts';

function deriveLightingInputs(device: ZoneDeviceInstance): LightEmitterInputs | null {
  const coverage_m2 = Number.isFinite(device.coverage_m2) ? device.coverage_m2 : 0;
  const power_W = Number.isFinite(device.powerDraw_W) ? device.powerDraw_W : 0;

  if (coverage_m2 <= 0 || power_W <= 0) {
    return null;
  }

  const efficiency01 = clamp01(Number.isFinite(device.efficiency01) ? device.efficiency01 : 0);
  const dim01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);
  const effects = device.effects ?? [];

  if (effects.includes('lighting') && device.effectConfigs?.lighting) {
    const config = device.effectConfigs.lighting;

    if (!Number.isFinite(config.ppfd_center_umol_m2s) || config.ppfd_center_umol_m2s <= 0) {
      return null;
    }

    return {
      ppfd_center_umol_m2s: config.ppfd_center_umol_m2s,
      coverage_m2,
      dim01
    } satisfies LightEmitterInputs;
  }

  const photonEfficacy_umol_per_J = LEGACY_PHOTON_EFFICACY_UMOL_PER_J;
  const ppfd_center_umol_m2s = power_W * efficiency01 * photonEfficacy_umol_per_J;

  if (ppfd_center_umol_m2s <= 0) {
    return null;
  }

  return {
    ppfd_center_umol_m2s,
    coverage_m2,
    dim01
  } satisfies LightEmitterInputs;
}

function accumulatePPFD(runtime: DeviceEffectsRuntime, zoneId: Zone['id'], ppfd: number): void {
  if (!Number.isFinite(ppfd) || ppfd === 0) {
    return;
  }

  const current = runtime.zonePPFD_umol_m2s.get(zoneId) ?? 0;
  runtime.zonePPFD_umol_m2s.set(zoneId, current + ppfd);
}

function accumulateDLI(runtime: DeviceEffectsRuntime, zoneId: Zone['id'], dli: number): void {
  if (!Number.isFinite(dli) || dli === 0) {
    return;
  }

  const current = runtime.zoneDLI_mol_m2d_inc.get(zoneId) ?? 0;
  runtime.zoneDLI_mol_m2d_inc.set(zoneId, current + dli);
}

export function applyLightingEffect(
  device: ZoneDeviceInstance,
  zone: Zone,
  runtime: DeviceEffectsRuntime,
  tickHours: number
): void {
  const lightingInputs = deriveLightingInputs(device);

  if (!lightingInputs) {
    return;
  }

  const lightingStub = createLightEmitterStub();
  const { ppfd_effective_umol_m2s, dli_mol_m2d_inc } = lightingStub.computeEffect(
    lightingInputs,
    tickHours
  );

  accumulatePPFD(runtime, zone.id, ppfd_effective_umol_m2s);
  accumulateDLI(runtime, zone.id, dli_mol_m2d_inc);
}

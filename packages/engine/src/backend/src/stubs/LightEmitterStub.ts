import { HOURS_PER_TICK, SECONDS_PER_HOUR } from '../constants/simConstants.js';
import type {
  ILightEmitter,
  LightEmitterInputs,
  LightEmitterOutputs
} from '../domain/interfaces/ILightEmitter.js';

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

function clamp01(value: number): number {
  return clamp(value, 0, 1);
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

function ensureFiniteOutputs(outputs: LightEmitterOutputs): LightEmitterOutputs {
  const { ppfd_effective_umol_m2s, dli_mol_m2d_inc, energy_Wh } = outputs;

  if (
    !Number.isFinite(ppfd_effective_umol_m2s) ||
    !Number.isFinite(dli_mol_m2d_inc) ||
    !Number.isFinite(energy_Wh ?? 0)
  ) {
    throw new Error('Light emitter outputs must be finite numbers.');
  }

  return outputs;
}

function resolveEnergyWh(
  inputs: LightEmitterInputs,
  dt_h: number
): number | undefined {
  const maybePower = (inputs as LightEmitterInputs & { power_W?: number }).power_W;

  if (typeof maybePower === 'undefined') {
    return undefined;
  }

  if (!Number.isFinite(maybePower)) {
    throw new RangeError('power_W must be a finite number when provided.');
  }

  if (maybePower < 0) {
    throw new RangeError('power_W must be non-negative when provided.');
  }

  if (dt_h === 0) {
    return 0;
  }

  return maybePower * dt_h;
}

function zeroEffect(): LightEmitterOutputs {
  return { ppfd_effective_umol_m2s: 0, dli_mol_m2d_inc: 0, energy_Wh: undefined };
}

export function createLightEmitterStub(): ILightEmitter {
  return {
    computeEffect(inputs: LightEmitterInputs, dt_h: number): LightEmitterOutputs {
      const { ppfd_center_umol_m2s, coverage_m2, dim01 } = inputs;

      if (!Number.isFinite(ppfd_center_umol_m2s)) {
        throw new RangeError('ppfd_center_umol_m2s must be a finite number.');
      }

      if (ppfd_center_umol_m2s < 0) {
        throw new RangeError('ppfd_center_umol_m2s must be non-negative.');
      }

      if (!Number.isFinite(coverage_m2)) {
        throw new RangeError('coverage_m2 must be a finite number.');
      }

      if (coverage_m2 < 0) {
        throw new RangeError('coverage_m2 must be non-negative.');
      }

      if (
        typeof dt_h === 'number' &&
        (!Number.isFinite(dt_h) || dt_h <= 0)
      ) {
        return zeroEffect();
      }

      const resolvedDt_h = resolveTickHours(dt_h);

      if (resolvedDt_h === 0 || coverage_m2 === 0 || ppfd_center_umol_m2s === 0) {
        return zeroEffect();
      }

      const dim = clamp01(dim01);

      if (dim === 0) {
        return zeroEffect();
      }

      const ppfd_effective_umol_m2s = ppfd_center_umol_m2s * dim;
      const tickSeconds = resolvedDt_h * SECONDS_PER_HOUR;
      const dli_mol_m2d_inc =
        (ppfd_effective_umol_m2s * tickSeconds) / 1_000_000;
      const energy_Wh = resolveEnergyWh(inputs, resolvedDt_h);

      return ensureFiniteOutputs({
        ppfd_effective_umol_m2s,
        dli_mol_m2d_inc,
        energy_Wh
      });
    }
  } satisfies ILightEmitter;
}

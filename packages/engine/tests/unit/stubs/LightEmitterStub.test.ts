import { describe, expect, it } from 'vitest';

import {
  HOURS_PER_TICK,
  SECONDS_PER_HOUR
} from '@/backend/src/constants/simConstants';
import { createLightEmitterStub } from '@/backend/src/stubs/LightEmitterStub';
import type { LightEmitterInputs } from '@/backend/src/domain/interfaces/ILightEmitter';

function createInputs(overrides: Partial<LightEmitterInputs> = {}): LightEmitterInputs {
  return {
    ppfd_center_umol_m2s: 600,
    coverage_m2: 1.2,
    dim01: 1,
    ...overrides
  } satisfies LightEmitterInputs;
}

describe('LightEmitterStub', () => {
  const stub = createLightEmitterStub();

  describe('reference test vector', () => {
    it('matches the reference delta for 600 µmol·m⁻²·s⁻¹ over 0.25 h', () => {
      const inputs = createInputs();
      const result = stub.computeEffect(inputs, 0.25);

      expect(result.ppfd_effective_umol_m2s).toBeCloseTo(600, 5);
      expect(result.dli_mol_m2d_inc).toBeCloseTo(0.54, 2);
    });
  });

  describe('dimming factor', () => {
    it('scales PPFD linearly with dim01', () => {
      const inputs = createInputs({ dim01: 0.5 });
      const result = stub.computeEffect(inputs, HOURS_PER_TICK);

      expect(result.ppfd_effective_umol_m2s).toBeCloseTo(300, 5);
      const expectedDli = (300 * HOURS_PER_TICK * SECONDS_PER_HOUR) / 1_000_000;
      expect(result.dli_mol_m2d_inc).toBeCloseTo(expectedDli, 5);
    });

    it('returns zero effect when dim01 is zero', () => {
      const inputs = createInputs({ dim01: 0 });
      const result = stub.computeEffect(inputs, HOURS_PER_TICK);

      expect(result).toEqual({
        ppfd_effective_umol_m2s: 0,
        dli_mol_m2d_inc: 0,
        energy_Wh: undefined
      });
    });

    it('clamps dim01 to the [0,1] interval', () => {
      const highDim = stub.computeEffect(createInputs({ dim01: 1.5 }), HOURS_PER_TICK);
      const lowDim = stub.computeEffect(createInputs({ dim01: -0.2 }), HOURS_PER_TICK);

      expect(highDim.ppfd_effective_umol_m2s).toBeCloseTo(600, 5);
      expect(lowDim.ppfd_effective_umol_m2s).toBe(0);
    });
  });

  describe('DLI calculation', () => {
    it('accumulates DLI proportionally to the tick duration', () => {
      const fullHour = stub.computeEffect(createInputs(), 1);
      const halfHour = stub.computeEffect(createInputs(), 0.5);

      expect(halfHour.dli_mol_m2d_inc).toBeCloseTo(fullHour.dli_mol_m2d_inc / 2, 5);
    });

    it('converts PPFD to mol·m⁻²·d⁻¹ increments', () => {
      const inputs = createInputs({ ppfd_center_umol_m2s: 800 });
      const dt = 0.75;
      const result = stub.computeEffect(inputs, dt);
      const expectedDli = (800 * dt * SECONDS_PER_HOUR) / 1_000_000;

      expect(result.dli_mol_m2d_inc).toBeCloseTo(expectedDli, 5);
    });
  });

  describe('energy accounting', () => {
    it('returns undefined energy when no power draw is provided', () => {
      const inputs = createInputs();
      const result = stub.computeEffect(inputs, HOURS_PER_TICK);

      expect(result.energy_Wh).toBeUndefined();
    });

    it('tracks energy when power_W is supplied', () => {
      const inputs = {
        ...createInputs(),
        power_W: 600
      } as LightEmitterInputs & { power_W: number };
      const dt = 0.5;
      const result = stub.computeEffect(inputs, dt);

      expect(result.energy_Wh).toBeCloseTo(600 * dt, 5);
    });
  });

  describe('edge cases', () => {
    it('returns zeros when PPFD is zero', () => {
      const result = stub.computeEffect(createInputs({ ppfd_center_umol_m2s: 0 }), HOURS_PER_TICK);

      expect(result).toEqual({
        ppfd_effective_umol_m2s: 0,
        dli_mol_m2d_inc: 0,
        energy_Wh: undefined
      });
    });

    it('returns zeros when coverage is zero', () => {
      const result = stub.computeEffect(createInputs({ coverage_m2: 0 }), HOURS_PER_TICK);

      expect(result).toEqual({
        ppfd_effective_umol_m2s: 0,
        dli_mol_m2d_inc: 0,
        energy_Wh: undefined
      });
    });

    it('returns zeros when dt_h is zero', () => {
      const result = stub.computeEffect(createInputs(), 0);

      expect(result).toEqual({
        ppfd_effective_umol_m2s: 0,
        dli_mol_m2d_inc: 0,
        energy_Wh: undefined
      });
    });

    it('returns zeros when dim01 is non-finite', () => {
      const result = stub.computeEffect(createInputs({ dim01: Number.NaN }), HOURS_PER_TICK);

      expect(result).toEqual({
        ppfd_effective_umol_m2s: 0,
        dli_mol_m2d_inc: 0,
        energy_Wh: undefined
      });
    });

    it('throws when PPFD is negative', () => {
      expect(() => stub.computeEffect(createInputs({ ppfd_center_umol_m2s: -1 }), HOURS_PER_TICK)).toThrowError(
        RangeError
      );
    });

    it('throws when coverage is negative', () => {
      expect(() => stub.computeEffect(createInputs({ coverage_m2: -0.1 }), HOURS_PER_TICK)).toThrowError(RangeError);
    });

    it('throws when provided power_W is non-finite', () => {
      const inputs = {
        ...createInputs(),
        power_W: Number.NaN
      } as LightEmitterInputs & { power_W: number };

      expect(() => stub.computeEffect(inputs, HOURS_PER_TICK)).toThrowError(RangeError);
    });
  });

  describe('output structure', () => {
    it('always returns finite PPFD and DLI values', () => {
      const inputs = {
        ...createInputs({ ppfd_center_umol_m2s: 450, dim01: 0.8 }),
        power_W: 450
      } as LightEmitterInputs & { power_W: number };
      const result = stub.computeEffect(inputs, 0.5);

      expect(Number.isFinite(result.ppfd_effective_umol_m2s)).toBe(true);
      expect(Number.isFinite(result.dli_mol_m2d_inc)).toBe(true);
      expect(Number.isFinite(result.energy_Wh ?? 0)).toBe(true);
    });
  });
});

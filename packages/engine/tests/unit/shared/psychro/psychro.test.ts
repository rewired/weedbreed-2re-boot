import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  PSYCHRO_MAX_TEMP_C,
  PSYCHRO_MIN_TEMP_C,
  PSYCHRO_PRECISION_DIGITS,
  PSYCHRO_REFERENCE_HUMIDITY_PCT,
  PSYCHRO_REFERENCE_TEMP_C,
  PSYCHRO_REFERENCE_VPD_KPA
} from '../../../constants';

import { computeVpd_kPa } from '../../../../src/shared/psychro/psychro.ts';

describe('computeVpd_kPa', () => {
  it('matches a known reference point (25°C, 50% RH)', () => {
    expect(computeVpd_kPa(PSYCHRO_REFERENCE_TEMP_C, PSYCHRO_REFERENCE_HUMIDITY_PCT)).toBeCloseTo(
      PSYCHRO_REFERENCE_VPD_KPA,
      PSYCHRO_PRECISION_DIGITS
    );
  });

  it('returns finite, non-negative VPD across a broad SI range', () => {
    const temp = fc.double({
      min: PSYCHRO_MIN_TEMP_C,
      max: PSYCHRO_MAX_TEMP_C,
      noNaN: true,
      noDefaultInfinity: true
    });
    const humidity = fc.double({
      min: 0,
      max: 100,
      noNaN: true,
      noDefaultInfinity: true
    });

    fc.assert(
      fc.property(temp, humidity, (T_c, RH_pct) => {
        const vpd = computeVpd_kPa(T_c, RH_pct);
        expect(Number.isFinite(vpd)).toBe(true);
        expect(vpd).toBeGreaterThanOrEqual(0);
      }),
      { verbose: false }
    );
  });
});

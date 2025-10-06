import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { computeVpd_kPa } from '../../../../src/shared/psychro/psychro.js';

describe('computeVpd_kPa', () => {
  it('matches a known reference point (25°C, 50% RH)', () => {
    expect(computeVpd_kPa(25, 50)).toBeCloseTo(1.5846, 4);
  });

  it('returns finite, non-negative VPD across a broad SI range', () => {
    const temp = fc.double({
      min: -40,
      max: 60,
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

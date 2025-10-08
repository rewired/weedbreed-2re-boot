import { describe, expect, it } from 'vitest';

import {
  computeDewPoint_C,
  computeSaturationVapourPressure_kPa,
  computeVpd_kPa
} from '../../../src/backend/src/physiology/vpd.ts';

describe('physiology VPD utilities', () => {
  it('computes saturation vapour pressure using Magnus approximation', () => {
    const saturation = computeSaturationVapourPressure_kPa(25);
    expect(saturation).toBeGreaterThan(3);
    expect(saturation).toBeCloseTo(3.1678, 4);
  });

  it('returns deterministic VPD values for standard reference point', () => {
    expect(computeVpd_kPa(25, 50)).toBeCloseTo(1.5839, 4);
  });

  it('clamps extreme humidity inputs to produce finite VPD outputs', () => {
    const dryVpd = computeVpd_kPa(30, 0);
    const saturatedVpd = computeVpd_kPa(30, 100);

    expect(Number.isFinite(dryVpd)).toBe(true);
    expect(dryVpd).toBeGreaterThan(0);
    expect(saturatedVpd).toBe(0);
  });

  it('computes dew point with finite results at humidity bounds', () => {
    // The Magnus approximation introduces ~1e-5 °C drift at full saturation so
    // we assert closeness rather than exact equality to document the tolerance.
    expect(computeDewPoint_C(22, 1)).toBeCloseTo(22, 4);
    const aridDewPoint = computeDewPoint_C(22, 0);
    expect(Number.isFinite(aridDewPoint)).toBe(true);
    expect(aridDewPoint).toBeLessThan(-80);
  });
});

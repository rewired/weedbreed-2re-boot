import { describe, expect, it } from 'vitest';

import { estimateIrrigationCharge } from '@/backend/src/domain/world.js';

const SUBSTRATE = { densityFactor_L_per_kg: 1.4 } as const;

describe('estimateIrrigationCharge', () => {
  it('estimates absorbed and delivered volumes respecting runoff', () => {
    const result = estimateIrrigationCharge({
      substrate: SUBSTRATE,
      containerVolume_L: 10,
      plantCount: 24,
      targetMoistureFraction01: 0.6,
      fillFraction01: 0.85,
      runoffFraction01: 0.1
    });

    expect(result.absorbedVolume_L).toBeCloseTo(87.4285, 4);
    expect(result.deliveredVolume_L).toBeCloseTo(result.absorbedVolume_L / 0.9, 4);
    expect(result.runoffVolume_L).toBeCloseTo(result.deliveredVolume_L - result.absorbedVolume_L, 4);
    expect(result.absorbedWaterMass_kg).toBeCloseTo(result.absorbedVolume_L, 5);
    expect(result.substrateMass_kg).toBeCloseTo(145.7142, 4);
  });

  it('handles zero runoff and zero plants gracefully', () => {
    const result = estimateIrrigationCharge({
      substrate: SUBSTRATE,
      containerVolume_L: 8,
      plantCount: 0,
      targetMoistureFraction01: 0.5
    });

    expect(result.absorbedVolume_L).toBe(0);
    expect(result.deliveredVolume_L).toBe(0);
    expect(result.runoffVolume_L).toBe(0);
  });
});

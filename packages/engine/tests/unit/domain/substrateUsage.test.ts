import { describe, expect, it } from 'vitest';

import {
  estimateSubstrateMassForPlanting,
  estimateSubstrateMassPerContainer
} from '@/backend/src/domain/world';

const SUBSTRATE = { densityFactor_L_per_kg: 1.25 } as const;

describe('estimateSubstrateMassPerContainer', () => {
  it('converts container volume into substrate mass', () => {
    const mass = estimateSubstrateMassPerContainer({
      substrate: SUBSTRATE,
      containerVolume_L: 15,
      fillFraction01: 0.9
    });

    expect(mass).toBeCloseTo(10.8, 5);
  });

  it('defaults the fill fraction to 100%', () => {
    const mass = estimateSubstrateMassPerContainer({
      substrate: SUBSTRATE,
      containerVolume_L: 12
    });

    expect(mass).toBeCloseTo(9.6, 5);
  });
});

describe('estimateSubstrateMassForPlanting', () => {
  it('scales container mass by plant count', () => {
    const totalMass = estimateSubstrateMassForPlanting({
      substrate: SUBSTRATE,
      containerVolume_L: 12,
      plantCount: 20,
      fillFraction01: 0.85
    });

    expect(totalMass).toBeCloseTo(163.2, 5);
  });
});

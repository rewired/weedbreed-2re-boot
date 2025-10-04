import { describe, expect, it } from 'vitest';

import {
  calculateBiomassIncrement,
  calculateHealthDecay,
  calculateHealthRecovery,
  calculateTemperatureGrowthFactor,
  getDryMatterFraction,
  getHarvestIndex
} from '../../../src/backend/src/util/growth.js';
import type { StrainBlueprint } from '../../../src/backend/src/domain/blueprints/strainBlueprint.js';
import type { RandomNumberGenerator } from '../../../src/backend/src/util/rng.js';

const mockStrain = (): StrainBlueprint => ({
  id: '22222222-2222-2222-2222-222222222222',
  slug: 'mock',
  class: 'strain.hybrid.mock',
  name: 'Mock Strain',
  generalResilience: 0.8,
  germinationRate: 0.9,
  envBands: {
    default: {
      temp_C: { green: [20, 26], yellowLow: 18, yellowHigh: 28 },
      rh_frac: { green: [0.5, 0.65], yellowLow: 0.4, yellowHigh: 0.7 },
      ppfd_umol_m2s: { green: [450, 700], yellowLow: 350, yellowHigh: 850 }
    }
  },
  stressTolerance: {
    temp_C: 1.8,
    rh_frac: 0.07,
    co2_ppm: 130,
    ppfd_umol_m2s: 60,
    vpd_kPa: 0.18
  },
  growthModel: {
    maxBiomassDry: 0.15,
    baseLightUseEfficiency: 0.45,
    maintenanceFracPerDay: 0.02,
    dryMatterFraction: 0.2,
    harvestIndex: 0.7,
    phaseCapMultiplier: { vegetation: 1, flowering: 0.8 },
    temperature: {
      Q10: 2,
      T_ref_C: 25,
      min_C: 18,
      max_C: 30
    }
  },
  phaseDurations: {
    seedlingDays: 10,
    vegDays: 28,
    flowerDays: 56,
    ripeningDays: 8
  },
  stageChangeThresholds: {
    vegetative: { minLightHours: 180, maxStressForStageChange: 0.4 },
    flowering: { minLightHours: 336, maxStressForStageChange: 0.35 }
  },
  photoperiod: {
    vegetationTime: 2_419_200,
    floweringTime: 5_184_000,
    transitionTrigger: 43_200
  }
});

describe('growth utilities', () => {
  const rng = (value: number): RandomNumberGenerator => () => value;

  describe('calculateTemperatureGrowthFactor', () => {
    const strain = mockStrain();

    it('returns 1 at the reference temperature', () => {
      expect(calculateTemperatureGrowthFactor(25, strain.growthModel)).toBeCloseTo(1, 5);
    });

    it('increases above the reference temperature', () => {
      expect(calculateTemperatureGrowthFactor(30, strain.growthModel)).toBeGreaterThan(1);
    });

    it('decreases below the reference temperature', () => {
      expect(calculateTemperatureGrowthFactor(20, strain.growthModel)).toBeLessThan(1);
    });

    it('penalises temperatures outside the allowable band', () => {
      expect(calculateTemperatureGrowthFactor(35, strain.growthModel)).toBeLessThan(0.3);
    });
  });

  describe('calculateBiomassIncrement', () => {
    it('returns positive growth under optimal conditions', () => {
      const strain = mockStrain();
      const growth = calculateBiomassIncrement(20, 25, 0, strain, 'vegetative', 10, 1, rng(0.5));
      expect(growth).toBeGreaterThan(0);
    });

    it('reduces growth under high stress', () => {
      const strain = mockStrain();
      const optimal = calculateBiomassIncrement(20, 25, 0, strain, 'vegetative', 10, 1, rng(0.5));
      const stressed = calculateBiomassIncrement(20, 25, 0.8, strain, 'vegetative', 10, 1, rng(0.5));
      expect(stressed).toBeLessThan(optimal);
    });

    it('accounts for maintenance cost at higher biomass', () => {
      const strain = mockStrain();
      const low = calculateBiomassIncrement(20, 25, 0, strain, 'vegetative', 10, 1, rng(0.5));
      const high = calculateBiomassIncrement(20, 25, 0, strain, 'vegetative', 100, 1, rng(0.5));
      expect(high).toBeLessThan(low);
    });

    it('applies deterministic noise when enabled', () => {
      const strain = mockStrain();
      strain.noise = { enabled: true, pct: 0.1 };
      const lower = calculateBiomassIncrement(20, 25, 0, strain, 'vegetative', 10, 1, rng(0));
      const higher = calculateBiomassIncrement(20, 25, 0, strain, 'vegetative', 10, 1, rng(1));
      expect(lower).toBeLessThan(higher);
    });

    it('respects maximum biomass limit', () => {
      const strain = mockStrain();
      const nearMax = calculateBiomassIncrement(40, 25, 0, strain, 'vegetative', 149, 1, rng(0.5));
      expect(149 + nearMax).toBeLessThanOrEqual(strain.growthModel.maxBiomassDry * 1_000);
    });

    it('returns zero when net growth would be negative', () => {
      const strain = mockStrain();
      const growth = calculateBiomassIncrement(0.1, 10, 1, strain, 'vegetative', 500, 1, rng(0.5));
      expect(growth).toBe(0);
    });

    it('scales with tick duration', () => {
      const strain = mockStrain();
      const oneHour = calculateBiomassIncrement(20, 25, 0, strain, 'vegetative', 10, 1, rng(0.5));
      const twoHour = calculateBiomassIncrement(20, 25, 0, strain, 'vegetative', 10, 2, rng(0.5));
      expect(twoHour).toBeGreaterThan(oneHour);
    });

    it('scales growth by stage-specific dry matter fraction', () => {
      const strain = mockStrain();
      strain.growthModel.dryMatterFraction = { vegetation: 0.5, flowering: 0.2 };
      const vegetativeGrowth = calculateBiomassIncrement(
        20,
        25,
        0,
        strain,
        'vegetative',
        10,
        1,
        rng(0.5)
      );
      const floweringGrowth = calculateBiomassIncrement(
        20,
        25,
        0,
        strain,
        'flowering',
        10,
        1,
        rng(0.5)
      );

      expect(vegetativeGrowth).toBeGreaterThan(floweringGrowth);
    });
  });

  describe('health modifiers', () => {
    it('returns zero decay when stress is zero', () => {
      expect(calculateHealthDecay(0, 0.8, 1, rng(0.5))).toBe(0);
    });

    it('increases decay with stress', () => {
      const low = calculateHealthDecay(0.3, 0.8, 1, rng(0.5));
      const high = calculateHealthDecay(0.8, 0.8, 1, rng(0.5));
      expect(high).toBeGreaterThan(low);
    });

    it('scales decay with tick duration', () => {
      const oneHour = calculateHealthDecay(1, 0.8, 1, rng(0.5));
      const twoHour = calculateHealthDecay(1, 0.8, 2, rng(0.5));
      expect(twoHour).toBeGreaterThan(oneHour);
    });

    it('applies recovery when stress is low', () => {
      expect(calculateHealthRecovery(0.1, 0.6, 1)).toBeGreaterThan(0);
    });

    it('returns zero recovery when stress is high or health maxed', () => {
      expect(calculateHealthRecovery(0.5, 0.6, 1)).toBe(0);
      expect(calculateHealthRecovery(0, 1, 1)).toBe(0);
    });

    it('recovers faster when health is low', () => {
      const highHealth = calculateHealthRecovery(0.05, 0.8, 1);
      const lowHealth = calculateHealthRecovery(0.05, 0.3, 1);
      expect(lowHealth).toBeGreaterThan(highHealth);
    });
  });

  describe('fraction helpers', () => {
    it('returns numeric dry matter fraction for all stages', () => {
      const strain = mockStrain();
      expect(getDryMatterFraction(strain.growthModel, 'seedling')).toBeCloseTo(0.2);
      expect(getDryMatterFraction(strain.growthModel, 'vegetative')).toBeCloseTo(0.2);
      expect(getDryMatterFraction(strain.growthModel, 'flowering')).toBeCloseTo(0.2);
      expect(getDryMatterFraction(strain.growthModel, 'harvest-ready')).toBeCloseTo(0.2);
    });

    it('returns stage-specific dry matter fraction when configured as object', () => {
      const strain = mockStrain();
      strain.growthModel.dryMatterFraction = { vegetation: 0.3, flowering: 0.18 };
      expect(getDryMatterFraction(strain.growthModel, 'seedling')).toBeCloseTo(0.3);
      expect(getDryMatterFraction(strain.growthModel, 'vegetative')).toBeCloseTo(0.3);
      expect(getDryMatterFraction(strain.growthModel, 'flowering')).toBeCloseTo(0.18);
      expect(getDryMatterFraction(strain.growthModel, 'harvest-ready')).toBeCloseTo(0.18);
    });

    it('falls back to flowering dry matter fraction when vegetation missing', () => {
      const strain = mockStrain();
      strain.growthModel.dryMatterFraction = { flowering: 0.22 };
      expect(getDryMatterFraction(strain.growthModel, 'vegetative')).toBeCloseTo(0.22);
    });

    it('returns numeric harvest index across stages', () => {
      const strain = mockStrain();
      expect(getHarvestIndex(strain.growthModel, 'seedling')).toBeCloseTo(0.7);
      expect(getHarvestIndex(strain.growthModel, 'vegetative')).toBeCloseTo(0.7);
      expect(getHarvestIndex(strain.growthModel, 'flowering')).toBeCloseTo(0.7);
      expect(getHarvestIndex(strain.growthModel, 'harvest-ready')).toBeCloseTo(0.7);
    });

    it('returns flowering harvest index when configured as object', () => {
      const strain = mockStrain();
      strain.growthModel.harvestIndex = { targetFlowering: 0.74 };
      expect(getHarvestIndex(strain.growthModel, 'flowering')).toBeCloseTo(0.74);
      expect(getHarvestIndex(strain.growthModel, 'harvest-ready')).toBeCloseTo(0.74);
      expect(getHarvestIndex(strain.growthModel, 'vegetative')).toBeCloseTo(0.74);
    });
  });
});

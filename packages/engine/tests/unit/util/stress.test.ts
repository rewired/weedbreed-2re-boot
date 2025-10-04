import { describe, expect, it } from 'vitest';

import {
  calculateCombinedStress,
  calculateEnvironmentalStress,
  calculateHumidityStress,
  calculateLightStress,
  calculateTemperatureStress
} from '../../../src/backend/src/util/stress.js';
import type { ZoneEnvironment } from '../../../src/backend/src/domain/entities.js';
import type { EnvBand, StrainBlueprint } from '../../../src/backend/src/domain/blueprints/strainBlueprint.js';

const envBand = (overrides: Partial<EnvBand> = {}): EnvBand => ({
  green: [20, 25],
  yellowLow: 18,
  yellowHigh: 28,
  ...overrides
});

const baseStrain = (): StrainBlueprint => ({
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'mock-strain',
  class: 'strain.hybrid.mock',
  name: 'Mock Strain',
  generalResilience: 0.8,
  germinationRate: 0.9,
  envBands: {
    default: {
      temp_C: envBand(),
      rh_frac: envBand({ green: [0.5, 0.65], yellowLow: 0.4, yellowHigh: 0.7 }),
      ppfd_umol_m2s: envBand({ green: [450, 700], yellowLow: 350, yellowHigh: 850 })
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

describe('stress calculations', () => {
  describe('calculateEnvironmentalStress', () => {
    it('returns 0 within the green range', () => {
      expect(calculateEnvironmentalStress(22, envBand(), 2)).toBe(0);
      expect(calculateEnvironmentalStress(20, envBand(), 2)).toBe(0);
      expect(calculateEnvironmentalStress(25, envBand(), 2)).toBe(0);
    });

    it('increases stress below the green range', () => {
      expect(calculateEnvironmentalStress(19, envBand(), 2)).toBeCloseTo(0.5, 2);
      expect(calculateEnvironmentalStress(18, envBand(), 2)).toBeCloseTo(1, 5);
      expect(calculateEnvironmentalStress(16, envBand(), 2)).toBe(1);
    });

    it('increases stress above the green range', () => {
      expect(calculateEnvironmentalStress(26, envBand(), 2)).toBeCloseTo(0.5, 2);
      expect(calculateEnvironmentalStress(27, envBand(), 2)).toBeCloseTo(1, 5);
      expect(calculateEnvironmentalStress(30, envBand(), 2)).toBe(1);
    });

    it('returns maximal stress when tolerance is zero', () => {
      expect(calculateEnvironmentalStress(19, envBand(), 0)).toBe(1);
    });
  });

  describe('calculateTemperatureStress', () => {
    it('uses vegetative band for seedling stage', () => {
      const strain = baseStrain();
      expect(calculateTemperatureStress(22, strain, 'seedling')).toBe(0);
    });

    it('uses flowering band when available', () => {
      const strain = baseStrain();
      strain.envBands.flower = {
        temp_C: envBand({ green: [21, 26], yellowLow: 19, yellowHigh: 28 })
      };
      expect(calculateTemperatureStress(23, strain, 'flowering')).toBe(0);
    });

    it('falls back to default band when stage-specific band missing', () => {
      const strain = baseStrain();
      strain.envBands.flower = undefined;
      expect(() => calculateTemperatureStress(24, strain, 'flowering')).not.toThrow();
    });
  });

  describe('calculateHumidityStress', () => {
    it('converts percentage to fraction', () => {
      const strain = baseStrain();
      expect(calculateHumidityStress(60, strain, 'vegetative')).toBe(0);
    });

    it('returns stress for low humidity', () => {
      const strain = baseStrain();
      expect(calculateHumidityStress(45, strain, 'vegetative')).toBeGreaterThan(0);
    });
  });

  describe('calculateLightStress', () => {
    it('returns 0 for optimal PPFD', () => {
      const strain = baseStrain();
      expect(calculateLightStress(600, strain, 'vegetative')).toBe(0);
    });

    it('returns stress for insufficient light', () => {
      const strain = baseStrain();
      expect(calculateLightStress(400, strain, 'vegetative')).toBeGreaterThan(0);
      expect(calculateLightStress(300, strain, 'vegetative')).toBeCloseTo(1, 5);
    });
  });

  describe('calculateCombinedStress', () => {
    const environment: ZoneEnvironment = { airTemperatureC: 22, relativeHumidity_pct: 60 };

    it('returns 0 when all conditions optimal', () => {
      const strain = baseStrain();
      expect(calculateCombinedStress(environment, 600, strain, 'vegetative')).toBeCloseTo(0, 5);
    });

    it('combines multiple stress sources', () => {
      const strain = baseStrain();
      const stressedEnvironment: ZoneEnvironment = { airTemperatureC: 18.5, relativeHumidity_pct: 40 };
      const stress = calculateCombinedStress(stressedEnvironment, 400, strain, 'vegetative');
      expect(stress).toBeGreaterThan(0);
      expect(stress).toBeLessThanOrEqual(1);
    });

    it('clamps combined stress to [0,1]', () => {
      const strain = baseStrain();
      const extremeEnvironment: ZoneEnvironment = { airTemperatureC: 10, relativeHumidity_pct: 5 };
      const stress = calculateCombinedStress(extremeEnvironment, 50, strain, 'vegetative');
      expect(stress).toBeGreaterThanOrEqual(0);
      expect(stress).toBeLessThanOrEqual(1);
    });
  });
});

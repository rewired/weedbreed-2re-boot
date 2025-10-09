import { describe, expect, it } from 'vitest';

import {
  calculateCombinedStress,
  calculateHumidityStress,
  calculateTemperatureStress,
  calculateVpdStress
} from '../../../src/backend/src/physiology/stressModel.ts';
import type { ZoneEnvironment } from '../../../src/backend/src/domain/entities.ts';
import type { EnvBand, StrainBlueprint } from '../../../src/backend/src/domain/blueprints/strainBlueprint.ts';
import { AMBIENT_CO2_PPM } from '../../../src/backend/src/constants/simConstants.ts';

const envBand = (overrides: Partial<EnvBand> = {}): EnvBand => ({
  green: [20, 25],
  yellowLow: 18,
  yellowHigh: 28,
  ...overrides
});

const baseStrain = (): StrainBlueprint => ({
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'mock-strain',
  class: 'strain',
  name: 'Mock Strain',
  generalResilience: 0.8,
  germinationRate: 0.9,
  envBands: {
    default: {
      temp_C: envBand(),
      rh_frac: envBand({ green: [0.5, 0.65], yellowLow: 0.4, yellowHigh: 0.7 }),
      ppfd_umol_m2s: envBand({ green: [450, 700], yellowLow: 350, yellowHigh: 850 }),
      vpd_kPa: envBand({ green: [1, 1.4], yellowLow: 0.8, yellowHigh: 1.6 })
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

describe('stress model tolerance curves', () => {
  describe('calculateTemperatureStress', () => {
    it('returns zero stress within the green band', () => {
      const strain = baseStrain();
      expect(calculateTemperatureStress(22, strain, 'vegetative')).toBe(0);
    });

    it('ramps quadratically outside the tolerance window', () => {
      const strain = baseStrain();
      const mild = calculateTemperatureStress(19.5, strain, 'vegetative');
      const severe = calculateTemperatureStress(17.5, strain, 'vegetative');
      expect(mild).toBeGreaterThan(0);
      expect(severe).toBeGreaterThanOrEqual(mild);
      expect(severe).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateHumidityStress', () => {
    it('operates on canonical humidity fractions', () => {
      const strain = baseStrain();
      expect(calculateHumidityStress(0.6, strain, 'vegetative')).toBeCloseTo(0, 5);
    });

    it('caps invalid humidity inputs before evaluation', () => {
      const strain = baseStrain();
      expect(calculateHumidityStress(2, strain, 'vegetative')).toBeGreaterThan(0);
    });
  });

  describe('calculateVpdStress', () => {
    it('returns null when no VPD band is provided', () => {
      const strain = baseStrain();
      strain.envBands.default.vpd_kPa = undefined;
      expect(calculateVpdStress(
        { airTemperatureC: 24, relativeHumidity01: 0.6, co2_ppm: AMBIENT_CO2_PPM },
        strain,
        'vegetative'
      )).toBeNull();
    });

    it('produces higher stress for larger VPD deficits', () => {
      const strain = baseStrain();
      const environment: ZoneEnvironment = {
        airTemperatureC: 26,
        relativeHumidity01: 0.65,
        co2_ppm: AMBIENT_CO2_PPM
      };
      const comfortable = calculateVpdStress(environment, strain, 'vegetative');
      const stressed = calculateVpdStress(
        { ...environment, relativeHumidity01: 0.2 },
        strain,
        'vegetative'
      );
      expect(comfortable ?? 0).toBeLessThan(1);
      expect(stressed).toBeGreaterThan(comfortable ?? 0);
    });
  });

  describe('calculateCombinedStress', () => {
    it('averages temperature, VPD and light stress contributions', () => {
      const strain = baseStrain();
      const environment: ZoneEnvironment = {
        airTemperatureC: 22,
        relativeHumidity01: 0.6,
        co2_ppm: AMBIENT_CO2_PPM
      };
      const stress = calculateCombinedStress(environment, 600, strain, 'vegetative');
      expect(stress).toBeGreaterThanOrEqual(0);
      expect(stress).toBeLessThan(0.2);
    });

    it('falls back to humidity stress when VPD band is missing', () => {
      const strain = baseStrain();
      strain.envBands.default.vpd_kPa = undefined;
      const environment: ZoneEnvironment = {
        airTemperatureC: 30,
        relativeHumidity01: 0.3,
        co2_ppm: AMBIENT_CO2_PPM
      };
      const stress = calculateCombinedStress(environment, 400, strain, 'vegetative');
      expect(stress).toBeGreaterThan(0);
    });
  });
});

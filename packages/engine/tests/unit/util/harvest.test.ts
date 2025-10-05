import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  calculateHarvestQuality,
  calculateHarvestYield,
  createHarvestLot
} from '../../../src/backend/src/util/harvest.js';
import type { StrainBlueprint } from '../../../src/backend/src/domain/blueprints/strainBlueprint.js';
import type { HarvestLot, Uuid } from '../../../src/backend/src/domain/entities.js';

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

describe('harvest utilities', () => {
  describe('calculateHarvestQuality', () => {
    it('returns near perfect quality under optimal conditions', () => {
      const quality = calculateHarvestQuality(1, 0, 1);
      expect(quality).toBeCloseTo(0.975, 3);
    });

    it('returns balanced quality under baseline conditions', () => {
      const quality = calculateHarvestQuality(0.7, 0.3, 0.7);
      expect(quality).toBeCloseTo(0.7, 2);
    });

    it('clamps result to the [0, 1] range for extreme inputs', () => {
      const quality = calculateHarvestQuality(1.5, -0.5, 2.0);
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(1);
    });

    it('drops quality significantly under poor conditions', () => {
      const quality = calculateHarvestQuality(0.3, 0.8, 0.5);
      expect(quality).toBeLessThan(0.45);
    });

    it('weights health more heavily than stress or genetics', () => {
      const base = calculateHarvestQuality(0.5, 0.5, 0.5);
      const higherHealth = calculateHarvestQuality(0.7, 0.5, 0.5);
      const lowerStress = calculateHarvestQuality(0.5, 0.3, 0.5);
      const betterGenetics = calculateHarvestQuality(0.5, 0.5, 0.7);
      expect(higherHealth - base).toBeGreaterThan(lowerStress - base);
      expect(higherHealth - base).toBeGreaterThan(betterGenetics - base);
    });

    it('applies method modifier scaling to the computed quality', () => {
      const base = calculateHarvestQuality(0.85, 0.2, 0.75, 1);
      const advanced = calculateHarvestQuality(0.85, 0.2, 0.75, 1.1);
      const basic = calculateHarvestQuality(0.85, 0.2, 0.75, 0.9);
      expect(advanced).toBeGreaterThan(base);
      expect(basic).toBeLessThan(base);
      expect(advanced).toBeCloseTo(base * 1.1, 3);
    });

    it('scales quality with the method modifier', () => {
      const base = calculateHarvestQuality(0.9, 0.1, 0.8, 1);
      const reduced = calculateHarvestQuality(0.9, 0.1, 0.8, 0.9);
      const increased = calculateHarvestQuality(0.9, 0.1, 0.8, 1.1);
      expect(reduced).toBeCloseTo(base * 0.9, 3);
      expect(increased).toBeGreaterThan(base);
    });

    it('applies a soft cap above 0.95 quality', () => {
      const uncapped = 0.97;
      const quality = calculateHarvestQuality(1, 0, 1, uncapped / 0.995);
      expect(quality).toBeLessThan(0.98);
      expect(quality).toBeCloseTo(0.962437, 5);
    });

    it('applies diminishing returns above the 0.95 soft cap', () => {
      const quality = calculateHarvestQuality(1, 0, 1);
      const overshoot = 1 - 0.95;
      expect(quality).toBeGreaterThan(0.95);
      expect(quality - 0.95).toBeCloseTo(0.5 * overshoot, 5);
    });

    it('clamps invalid inputs into range', () => {
      const quality = calculateHarvestQuality(NaN, -1, 2);
      expect(quality).toBeCloseTo(0.45, 2);
    });

    it('defaults method modifier to neutral scale', () => {
      const withDefault = calculateHarvestQuality(0.8, 0.2, 0.8);
      const explicit = calculateHarvestQuality(0.8, 0.2, 0.8, 1);
      expect(withDefault).toBeCloseTo(explicit, 5);
    });
  });

  describe('calculateHarvestYield', () => {
    it('returns the expected dry weight under standard parameters', () => {
      const strain = mockStrain();
      const yield_g = calculateHarvestYield(100, strain, 'flowering');
      expect(yield_g).toBeCloseTo(14, 5);
    });

    it('returns zero for zero biomass input', () => {
      const strain = mockStrain();
      const yield_g = calculateHarvestYield(0, strain, 'flowering');
      expect(yield_g).toBe(0);
    });

    it('resolves object-based harvest index configurations', () => {
      const strain = mockStrain();
      strain.growthModel.harvestIndex = {
        targetFlowering: 0.65
      } as StrainBlueprint['growthModel']['harvestIndex'];
      const flowering = calculateHarvestYield(120, strain, 'flowering');
      const harvestReady = calculateHarvestYield(120, strain, 'harvest-ready');
      expect(flowering).toBeCloseTo(120 * 0.65 * 0.2, 5);
      expect(harvestReady).toBeCloseTo(flowering, 5);
    });

    it('resolves stage specific dry matter fraction configurations', () => {
      const strain = mockStrain();
      strain.growthModel.dryMatterFraction = {
        vegetation: 0.25,
        flowering: 0.3
      } as unknown as StrainBlueprint['growthModel']['dryMatterFraction'];
      const vegetative = calculateHarvestYield(80, strain, 'vegetative');
      const flowering = calculateHarvestYield(80, strain, 'flowering');
      expect(flowering).toBeGreaterThan(vegetative);
    });

    it('produces consistent results across lifecycle stages when parameters are uniform', () => {
      const strain = mockStrain();
      const seedling = calculateHarvestYield(50, strain, 'seedling');
      const vegetative = calculateHarvestYield(50, strain, 'vegetative');
      const flowering = calculateHarvestYield(50, strain, 'flowering');
      const harvestReady = calculateHarvestYield(50, strain, 'harvest-ready');
      expect(seedling).toBeCloseTo(7, 5);
      expect(vegetative).toBeCloseTo(7, 5);
      expect(flowering).toBeCloseTo(7, 5);
      expect(harvestReady).toBeCloseTo(7, 5);
    });
  });

  describe('createHarvestLot', () => {
    it('constructs a harvest lot with the provided parameters', () => {
      const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        '11111111-1111-1111-1111-111111111111'
      );
      const lot = createHarvestLot(
        '22222222-2222-2222-2222-222222222222' as Uuid,
        'mock',
        0.85,
        50,
        1_000,
        '33333333-3333-3333-3333-333333333333' as Uuid
      );
      spy.mockRestore();

      expect(lot).toMatchObject<Partial<HarvestLot>>({
        id: '11111111-1111-1111-1111-111111111111',
        strainId: '22222222-2222-2222-2222-222222222222',
        strainSlug: 'mock',
        quality01: 0.85,
        dryWeight_g: 50,
        harvestedAtSimHours: 1_000,
        sourceZoneId: '33333333-3333-3333-3333-333333333333'
      });
      expect(lot.name).toContain('Harvest Lot mock');
      expect(lot.name).toContain('1970-02-11');
    });

    it('generates unique identifiers for each lot', () => {
      const spy = vi.spyOn(crypto, 'randomUUID');
      spy.mockReturnValueOnce('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').mockReturnValueOnce(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      );

      const first = createHarvestLot(
        '22222222-2222-2222-2222-222222222222' as Uuid,
        'mock',
        0.9,
        60,
        500,
        '33333333-3333-3333-3333-333333333333' as Uuid
      );
      const second = createHarvestLot(
        '22222222-2222-2222-2222-222222222222' as Uuid,
        'mock',
        0.92,
        55,
        600,
        '33333333-3333-3333-3333-333333333333' as Uuid
      );
      spy.mockRestore();

      expect(first.id).not.toEqual(second.id);
    });

    it('clamps quality to valid range', () => {
      const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        '44444444-4444-4444-4444-444444444444'
      );
      const lot = createHarvestLot(
        '22222222-2222-2222-2222-222222222222' as Uuid,
        'mock',
        1.2,
        40,
        700,
        '33333333-3333-3333-3333-333333333333' as Uuid
      );
      spy.mockRestore();
      expect(lot.quality01).toBe(1);
    });

    it('generates UUID v4 identifiers for each lot', () => {
      const lotA = createHarvestLot(
        '22222222-2222-2222-2222-222222222222' as Uuid,
        'mock',
        0.8,
        45,
        800,
        '33333333-3333-3333-3333-333333333333' as Uuid
      );
      const lotB = createHarvestLot(
        '22222222-2222-2222-2222-222222222222' as Uuid,
        'mock',
        0.75,
        30,
        900,
        '33333333-3333-3333-3333-333333333333' as Uuid
      );
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(lotA.id).not.toEqual(lotB.id);
      expect(lotA.id).toMatch(uuidPattern);
      expect(lotB.id).toMatch(uuidPattern);
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  calculateAccumulatedLightHours,
  isLightOn,
  shouldTransitionToFlowering,
  shouldTransitionToHarvestReady,
  shouldTransitionToVegetative
} from '../../../src/backend/src/util/photoperiod.js';
import type { LightSchedule, Plant, Zone } from '../../../src/backend/src/domain/entities.js';
import type {
  PhaseDurations,
  StageChangeThresholds
} from '../../../src/backend/src/domain/blueprints/strainBlueprint.js';

describe('photoperiod utilities', () => {
  const schedule = (overrides: Partial<LightSchedule> = {}): LightSchedule => ({
    onHours: 18,
    offHours: 6,
    startHour: 0,
    ...overrides
  });

  const plant = (overrides: Partial<Plant> = {}): Plant => ({
    id: '00000000-0000-0000-0000-000000000000' as Plant['id'],
    name: 'Test Plant',
    slug: 'test-plant',
    strainId: '00000000-0000-0000-0000-000000000001' as Plant['strainId'],
    lifecycleStage: 'seedling',
    ageHours: 0,
    health01: 1,
    biomass_g: 0,
    containerId: '00000000-0000-0000-0000-000000000010' as Plant['containerId'],
    substrateId: '00000000-0000-0000-0000-000000000020' as Plant['substrateId'],
    ...overrides
  });

  const zone = (overrides: Partial<Zone> = {}): Zone => ({
    id: '00000000-0000-0000-0000-000000000100' as Zone['id'],
    name: 'Zone',
    slug: 'zone',
    cultivationMethodId: '00000000-0000-0000-0000-000000000200' as Zone['cultivationMethodId'],
    irrigationMethodId: '00000000-0000-0000-0000-000000000300' as Zone['irrigationMethodId'],
    containerId: '00000000-0000-0000-0000-000000000400' as Zone['containerId'],
    substrateId: '00000000-0000-0000-0000-000000000500' as Zone['substrateId'],
    lightSchedule: schedule(),
    photoperiodPhase: 'vegetative',
    plants: [],
    devices: [],
    floorArea_m2: 10,
    height_m: 3,
    airMass_kg: 1,
    environment: { airTemperatureC: 23, relativeHumidity_pct: 60 },
    ppfd_umol_m2s: 600,
    dli_mol_m2d_inc: 20,
    nutrientBuffer_mg: {},
    moisture01: 0.5,
    ...overrides
  });

  describe('isLightOn', () => {
    it('returns true when within light window without midnight overflow', () => {
      const light = schedule({ startHour: 6, onHours: 18 });
      expect(isLightOn(12, light)).toBe(true);
      expect(isLightOn(23, light)).toBe(true);
      expect(isLightOn(3, light)).toBe(false);
    });

    it('returns true when within light window with midnight overflow', () => {
      const light = schedule({ startHour: 18, onHours: 18 });
      expect(isLightOn(20, light)).toBe(true);
      expect(isLightOn(2, light)).toBe(true);
      expect(isLightOn(14, light)).toBe(false);
    });

    it('handles multi-day simulation time', () => {
      const light = schedule({ startHour: 6, onHours: 12 });
      expect(isLightOn(50, light)).toBe(false);
      expect(isLightOn(54, light)).toBe(true);
    });

    it('returns false when onHours is zero', () => {
      const light = schedule({ onHours: 0, offHours: 24 });
      expect(isLightOn(0, light)).toBe(false);
      expect(isLightOn(12, light)).toBe(false);
    });
  });

  describe('calculateAccumulatedLightHours', () => {
    it('calculates light hours for complete days', () => {
      expect(calculateAccumulatedLightHours(24, schedule({ onHours: 18 }))).toBeCloseTo(18, 5);
      expect(calculateAccumulatedLightHours(48, schedule({ onHours: 18 }))).toBeCloseTo(36, 5);
    });

    it('calculates light hours with partial day remainder', () => {
      const light = schedule({ onHours: 12, startHour: 6 });
      expect(calculateAccumulatedLightHours(30, light)).toBeCloseTo(18, 5);
    });

    it('handles midnight overflow schedules', () => {
      const light = schedule({ onHours: 18, startHour: 18 });
      expect(calculateAccumulatedLightHours(24, light)).toBeCloseTo(18, 5);
    });
  });

  describe('stage transitions', () => {
    const thresholds: StageChangeThresholds = {
      vegetative: { minLightHours: 180, maxStressForStageChange: 0.35 },
      flowering: { minLightHours: 336, maxStressForStageChange: 0.25 }
    };

    const phases: PhaseDurations = {
      seedlingDays: 10,
      vegDays: 28,
      flowerDays: 56,
      ripeningDays: 8
    };

    it('transitions from seedling to vegetative with sufficient light', () => {
      const candidate = plant({ ageHours: 240, lifecycleStage: 'seedling' });
      expect(shouldTransitionToVegetative(candidate, schedule({ onHours: 18 }), thresholds.vegetative)).toBe(true);
    });

    it('does not transition to vegetative when insufficient light', () => {
      const candidate = plant({ ageHours: 120, lifecycleStage: 'seedling' });
      expect(shouldTransitionToVegetative(candidate, schedule({ onHours: 18 }), thresholds.vegetative)).toBe(false);
    });

    it('transitions to flowering when photoperiod phase is flowering', () => {
      const candidate = plant({ ageHours: 672, lifecycleStage: 'vegetative' });
      const floweringZone = zone({ photoperiodPhase: 'flowering', lightSchedule: schedule({ onHours: 12 }) });
      expect(shouldTransitionToFlowering(candidate, floweringZone, thresholds.flowering)).toBe(true);
    });

    it('does not transition to flowering when zone is vegetative', () => {
      const candidate = plant({ ageHours: 672, lifecycleStage: 'vegetative' });
      expect(shouldTransitionToFlowering(candidate, zone(), thresholds.flowering)).toBe(false);
    });

    it('transitions to harvest-ready after flowering duration', () => {
      const candidate = plant({ ageHours: (10 + 28 + 56) * 24, lifecycleStage: 'flowering' });
      expect(shouldTransitionToHarvestReady(candidate, zone(), phases)).toBe(true);
    });

    it('does not transition to harvest-ready before threshold', () => {
      const candidate = plant({ ageHours: 500, lifecycleStage: 'flowering' });
      expect(shouldTransitionToHarvestReady(candidate, zone(), phases)).toBe(false);
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  AREA_QUANTUM_M2,
  DAYS_PER_MONTH,
  HOURS_PER_DAY,
  HOURS_PER_MONTH,
  HOURS_PER_TICK,
  HOURS_PER_YEAR,
  LIGHT_SCHEDULE_GRID_HOURS,
  MONTHS_PER_YEAR,
  ROOM_DEFAULT_HEIGHT_M,
  SIM_CONSTANTS
} from '@/backend/src/constants/simConstants.js';

describe('simConstants', () => {
  it('exposes canonical SEC values', () => {
    expect(AREA_QUANTUM_M2).toBe(LIGHT_SCHEDULE_GRID_HOURS);
    expect(LIGHT_SCHEDULE_GRID_HOURS).toBeCloseTo(1 / 4);
    expect(ROOM_DEFAULT_HEIGHT_M).toBe(3);
    expect(HOURS_PER_TICK).toBe(1);
    expect(HOURS_PER_DAY).toBe(24);
    expect(DAYS_PER_MONTH).toBe(30);
    expect(MONTHS_PER_YEAR).toBe(12);
    expect(HOURS_PER_MONTH).toBe(24 * 30);
    expect(HOURS_PER_YEAR).toBe(24 * 30 * 12);
  });

  it('provides immutable aggregate exports', () => {
    expect(Object.isFrozen(SIM_CONSTANTS)).toBe(true);
    expect(Reflect.set(SIM_CONSTANTS, 'AREA_QUANTUM_M2', 1)).toBe(false);
    expect(SIM_CONSTANTS.AREA_QUANTUM_M2).toBe(AREA_QUANTUM_M2);
    expect(SIM_CONSTANTS.LIGHT_SCHEDULE_GRID_HOURS).toBe(
      LIGHT_SCHEDULE_GRID_HOURS
    );
  });

});

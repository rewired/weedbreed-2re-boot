import { describe, expect, it } from 'vitest';

import {
  LIGHT_SCHEDULE_GRID_HOURS,
  SIM_CONSTANTS,
  getSimulationConstant,
  type SimulationConstantName
} from '@wb/engine';

describe('engine exports', () => {
  it('re-exports canonical simulation constants', () => {
    expect(SIM_CONSTANTS.AREA_QUANTUM_M2).toBe(LIGHT_SCHEDULE_GRID_HOURS);
    expect(SIM_CONSTANTS.LIGHT_SCHEDULE_GRID_HOURS).toBe(
      LIGHT_SCHEDULE_GRID_HOURS
    );
    expect(SIM_CONSTANTS.ROOM_DEFAULT_HEIGHT_M).toBe(3);
  });

  it('ensures entry point and backend alias stay in sync', () => {
    for (const [name, value] of Object.entries(SIM_CONSTANTS) as [
      SimulationConstantName,
      number
    ][]) {
      expect(getSimulationConstant(name)).toBe(value);
    }
  });
});

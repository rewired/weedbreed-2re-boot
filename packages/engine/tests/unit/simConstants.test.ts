import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  AREA_QUANTUM_M2,
  CP_AIR_J_PER_KG_K,
  DAYS_PER_MONTH,
  HOURS_PER_DAY,
  HOURS_PER_MONTH,
  HOURS_PER_TICK,
  HOURS_PER_YEAR,
  LIGHT_SCHEDULE_GRID_HOURS,
  MONTHS_PER_YEAR,
  ROOM_DEFAULT_HEIGHT_M,
  SIM_CONSTANTS
} from '@/backend/src/constants/simConstants';
import type { SensorReading } from '@/backend/src/domain/interfaces/ISensor';

describe('simConstants', () => {
  afterEach(() => {
    vi.doUnmock('@/backend/src/constants/simConstants');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('exposes canonical SEC values', () => {
    expect(AREA_QUANTUM_M2).toBe(LIGHT_SCHEDULE_GRID_HOURS);
    expect(LIGHT_SCHEDULE_GRID_HOURS).toBeCloseTo(1 / 4);
    expect(ROOM_DEFAULT_HEIGHT_M).toBe(3);
    expect(CP_AIR_J_PER_KG_K).toBe(1_005);
    expect(AIR_DENSITY_KG_PER_M3).toBeCloseTo(1.2041);
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
    expect(SIM_CONSTANTS.CP_AIR_J_PER_KG_K).toBe(CP_AIR_J_PER_KG_K);
    expect(SIM_CONSTANTS.AIR_DENSITY_KG_PER_M3).toBe(AIR_DENSITY_KG_PER_M3);
  });

  it('allows sensor pipeline modules to consume canonical CO2 safety bounds', async () => {
    const mockedSafetyLimit = 1_234;

    vi.resetModules();
    vi.doMock('@/backend/src/constants/simConstants', async () => {
      const actual = (await vi.importActual(
        '@/backend/src/constants/simConstants'
      )) as typeof import('@/backend/src/constants/simConstants');

      return {
        ...actual,
        SAFETY_MAX_CO2_PPM: mockedSafetyLimit
      } satisfies typeof actual;
    });

    const { createSensorStub } = await import('@/backend/src/stubs/SensorStub');
    const co2Sensor = createSensorStub('co2');
    const reading = co2Sensor.computeEffect(
      {
        trueValue: mockedSafetyLimit * 10,
        noise01: 0,
        condition01: 1
      },
      () => 0.5
    );

    expect(reading.measuredValue).toBe(mockedSafetyLimit);

    const { assertValidSensorReading } = await import(
      '@/backend/src/engine/pipeline/sensorReadingSchema'
    );

    const baseReading: SensorReading<number> = {
      measurementType: 'co2',
      rngStreamId: 'telemetry',
      sampledAtSimTimeHours: 0,
      sampledTick: 0,
      tickDurationHours: 1,
      trueValue: mockedSafetyLimit,
      measuredValue: mockedSafetyLimit,
      error: 0,
      noise01: 0,
      condition01: 1,
      noiseSample: 0
    } as const;

    expect(() => assertValidSensorReading(baseReading)).not.toThrow();
    expect(() =>
      assertValidSensorReading({
        ...baseReading,
        measuredValue: mockedSafetyLimit + 1
      })
    ).toThrowError();
  });

  it('allows physiology modules to clamp humidity using the canonical float tolerance', async () => {
    const mockedTolerance = 0.5;

    vi.resetModules();
    vi.doMock('@/backend/src/constants/simConstants', async () => {
      const actual = (await vi.importActual(
        '@/backend/src/constants/simConstants'
      )) as typeof import('@/backend/src/constants/simConstants');

      return {
        ...actual,
        FLOAT_TOLERANCE: mockedTolerance
      } satisfies typeof actual;
    });

    const { computeDewPoint_C } = await import('@/backend/src/physiology/vpd');

    const dewPointAtZero = computeDewPoint_C(20, 0);
    const dewPointAtTolerance = computeDewPoint_C(20, mockedTolerance);

    expect(dewPointAtZero).toBeCloseTo(dewPointAtTolerance);
  });
});

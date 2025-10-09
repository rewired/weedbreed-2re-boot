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
import {
  SEC_AIR_DENSITY_KG_PER_M3,
  SEC_CP_AIR_J_PER_KG_K,
  SEC_DAYS_PER_MONTH,
  SEC_HOURS_PER_DAY,
  SEC_LIGHT_SCHEDULE_GRID_HOURS,
  SEC_MONTHS_PER_YEAR,
  SEC_ROOM_DEFAULT_HEIGHT_M,
  SIM_DEW_POINT_REFERENCE_TEMP_C,
  SIM_MOCKED_CO2_LIMIT_PPM,
  SIM_TOLERANCE_MOCK
} from '../constants';
import type { SensorReading } from '@/backend/src/domain/interfaces/ISensor';

describe('simConstants', () => {
  afterEach(() => {
    vi.doUnmock('@/backend/src/constants/simConstants');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('exposes canonical SEC values', () => {
    expect(AREA_QUANTUM_M2).toBe(LIGHT_SCHEDULE_GRID_HOURS);
    expect(LIGHT_SCHEDULE_GRID_HOURS).toBeCloseTo(SEC_LIGHT_SCHEDULE_GRID_HOURS);
    expect(ROOM_DEFAULT_HEIGHT_M).toBe(SEC_ROOM_DEFAULT_HEIGHT_M);
    expect(CP_AIR_J_PER_KG_K).toBe(SEC_CP_AIR_J_PER_KG_K);
    expect(AIR_DENSITY_KG_PER_M3).toBeCloseTo(SEC_AIR_DENSITY_KG_PER_M3);
    expect(HOURS_PER_TICK).toBe(1);
    expect(HOURS_PER_DAY).toBe(SEC_HOURS_PER_DAY);
    expect(DAYS_PER_MONTH).toBe(SEC_DAYS_PER_MONTH);
    expect(MONTHS_PER_YEAR).toBe(SEC_MONTHS_PER_YEAR);
    expect(HOURS_PER_MONTH).toBe(SEC_HOURS_PER_DAY * SEC_DAYS_PER_MONTH);
    expect(HOURS_PER_YEAR).toBe(
      SEC_HOURS_PER_DAY * SEC_DAYS_PER_MONTH * SEC_MONTHS_PER_YEAR
    );
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
    const mockedSafetyLimit = SIM_MOCKED_CO2_LIMIT_PPM;

    vi.resetModules();
    vi.doMock('@/backend/src/constants/simConstants', async () => {
      const actual = await vi.importActual<typeof import('@/backend/src/constants/simConstants')>(
        '@/backend/src/constants/simConstants'
      );

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
      () => SIM_TOLERANCE_MOCK
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
    };

    expect(() => assertValidSensorReading(baseReading)).not.toThrow();
    expect(() =>
      assertValidSensorReading({
        ...baseReading,
        measuredValue: mockedSafetyLimit + 1
      })
    ).toThrowError();
  });

  it('allows physiology modules to clamp humidity using the canonical float tolerance', async () => {
    const mockedTolerance = SIM_TOLERANCE_MOCK;

    vi.resetModules();
    vi.doMock('@/backend/src/constants/simConstants', async () => {
      const actual = await vi.importActual<typeof import('@/backend/src/constants/simConstants')>(
        '@/backend/src/constants/simConstants'
      );

      return {
        ...actual,
        FLOAT_TOLERANCE: mockedTolerance
      } satisfies typeof actual;
    });

    const { computeDewPoint_C } = await import('@/backend/src/physiology/vpd');

    const dewPointAtZero = computeDewPoint_C(SIM_DEW_POINT_REFERENCE_TEMP_C, 0);
    const dewPointAtTolerance = computeDewPoint_C(
      SIM_DEW_POINT_REFERENCE_TEMP_C,
      mockedTolerance
    );

    expect(dewPointAtZero).toBeCloseTo(dewPointAtTolerance);
  });
});

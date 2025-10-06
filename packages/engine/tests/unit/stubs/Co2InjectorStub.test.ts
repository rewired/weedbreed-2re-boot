import { describe, expect, it } from 'vitest';

import {
  AMBIENT_CO2_PPM,
  HOURS_PER_TICK
} from '@/backend/src/constants/simConstants.js';
import { createCo2InjectorStub } from '@/backend/src/stubs/Co2InjectorStub.js';
import type { Co2InjectorInputs } from '@/backend/src/domain/interfaces/ICo2Injector.js';
import type { ZoneEnvironment } from '@/backend/src/domain/entities.js';

const BASE_ENVIRONMENT: ZoneEnvironment = {
  airTemperatureC: 24,
  relativeHumidity_pct: 55,
  co2_ppm: AMBIENT_CO2_PPM
};

function inputs(overrides: Partial<Co2InjectorInputs> = {}): Co2InjectorInputs {
  return {
    power_W: 150,
    dutyCycle01: 1,
    target_ppm: 1_000,
    safetyMax_ppm: 1_200,
    pulse_ppm_per_tick: 200,
    ...overrides
  } satisfies Co2InjectorInputs;
}

describe('Co2InjectorStub', () => {
  const stub = createCo2InjectorStub();

  it('injects up to the commanded capacity', () => {
    const result = stub.computeEffect(inputs(), BASE_ENVIRONMENT, HOURS_PER_TICK);

    expect(result.delta_ppm).toBeCloseTo(200, 6);
    expect(result.effectiveDuty01).toBeCloseTo(1, 6);
    expect(result.energy_Wh).toBeCloseTo(150, 6);
    expect(result.clampedByTarget).toBe(true);
    expect(result.clampedBySafety).toBe(false);
  });

  it('scales duty and energy when the target is near the setpoint', () => {
    const result = stub.computeEffect(
      inputs({ target_ppm: AMBIENT_CO2_PPM + 50 }),
      BASE_ENVIRONMENT,
      HOURS_PER_TICK
    );

    expect(result.delta_ppm).toBeCloseTo(50, 6);
    expect(result.effectiveDuty01).toBeCloseTo(0.25, 6);
    expect(result.energy_Wh).toBeCloseTo(150 * 0.25, 6);
    expect(result.clampedByTarget).toBe(true);
  });

  it('respects the safety ceiling clamp', () => {
    const result = stub.computeEffect(
      inputs({ safetyMax_ppm: AMBIENT_CO2_PPM + 80 }),
      BASE_ENVIRONMENT,
      HOURS_PER_TICK
    );

    expect(result.delta_ppm).toBeCloseTo(80, 6);
    expect(result.clampedBySafety).toBe(true);
  });

  it('scales capacity with tick duration and duty cycle', () => {
    const result = stub.computeEffect(
      inputs({ dutyCycle01: 0.5 }),
      BASE_ENVIRONMENT,
      HOURS_PER_TICK / 2
    );

    // capacityAtDuty1 = 200 * 0.5 = 100; commanded duty 0.5 -> capacity 50
    expect(result.delta_ppm).toBeCloseTo(50, 6);
    expect(result.effectiveDuty01).toBeCloseTo(0.5, 6);
    expect(result.energy_Wh).toBeCloseTo(150 * 0.5 * 0.5, 6);
  });

  it('returns zero when within hysteresis window', () => {
    const result = stub.computeEffect(
      inputs({
        target_ppm: AMBIENT_CO2_PPM + 5,
        hysteresis_ppm: 10
      }),
      BASE_ENVIRONMENT,
      HOURS_PER_TICK
    );

    expect(result.delta_ppm).toBe(0);
    expect(result.energy_Wh).toBe(0);
    expect(result.clampedByTarget).toBe(true);
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  CP_AIR_J_PER_KG_K,
  FLOAT_TOLERANCE,
  SAFETY_MAX_CO2_PPM
} from '@/backend/src/constants/simConstants';
import type { EngineRunContext } from '@/backend/src/engine/Engine';
import { applyDeviceEffects } from '@/backend/src/engine/pipeline/applyDeviceEffects';
import { updateEnvironment } from '@/backend/src/engine/pipeline/updateEnvironment';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type {
  SimulationWorld,
  ZoneDeviceInstance,
  Uuid,
} from '@/backend/src/domain/world';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type HumidityMode = 'humidify' | 'dehumidify';

function computeSpecificEnthalpy_kJ_per_kg(temperatureC: number, humidityPct: number): number {
  const T = Number.isFinite(temperatureC) ? temperatureC : 0;
  const Tk = T + 273.15;
  const phi = Math.min(1, Math.max(0, humidityPct / 100));
  const saturation_kPa = 0.61094 * Math.exp((17.625 * T) / (T + 243.04));
  const partialPressure_kPa = Math.max(0, Math.min(phi * saturation_kPa, saturation_kPa));
  const totalPressure_kPa = 101.325;
  const humidityRatio = partialPressure_kPa >= totalPressure_kPa
    ? 0
    : Math.max(
        0,
        (0.621945 * partialPressure_kPa) /
          Math.max(FLOAT_TOLERANCE, totalPressure_kPa - partialPressure_kPa),
      );
  const dryAirContribution = (CP_AIR_J_PER_KG_K * Tk) / 1_000;
  const latentContribution = humidityRatio * (2_501 + 1.86 * T);
  return Math.max(0, dryAirContribution + latentContribution);
}

function createHumidityDevice(mode: HumidityMode, dutyCycle01: number): ZoneDeviceInstance {
  return {
    id: '00000000-0000-4000-9000-000000000101' as Uuid,
    slug: `test-humidity-${mode}`,
    name: 'Test Humidity Controller',
    blueprintId: '00000000-0000-4000-9000-000000000201' as Uuid,
    placementScope: 'zone',
    quality01: 1,
    condition01: 1,
    powerDraw_W: 500,
    dutyCycle01,
    efficiency01: 1,
    coverage_m2: 40,
    airflow_m3_per_h: 0,
    sensibleHeatRemovalCapacity_W: 0,
    effects: ['humidity'],
    effectConfigs: {
      humidity: {
        mode,
        capacity_g_per_h: 10_000,
      },
    },
  } satisfies ZoneDeviceInstance;
}

function createCo2Device(dutyCycle01: number): ZoneDeviceInstance {
  const safetyCeiling = Math.max(0, SAFETY_MAX_CO2_PPM - 250);
  return {
    id: '00000000-0000-4000-9000-000000000102' as Uuid,
    slug: 'test-co2-injector',
    name: 'Test CO2 Injector',
    blueprintId: '00000000-0000-4000-9000-000000000202' as Uuid,
    placementScope: 'zone',
    quality01: 1,
    condition01: 1,
    powerDraw_W: 750,
    dutyCycle01,
    efficiency01: 1,
    coverage_m2: 40,
    airflow_m3_per_h: 0,
    sensibleHeatRemovalCapacity_W: 0,
    effects: ['co2'],
    effectConfigs: {
      co2: {
        target_ppm: SAFETY_MAX_CO2_PPM * 2,
        safetyMax_ppm: safetyCeiling,
        pulse_ppm_per_tick: 3_000,
        min_ppm: 420,
        ambient_ppm: 420,
        hysteresis_ppm: 0,
      },
    },
  } satisfies ZoneDeviceInstance;
}

describe('applyDeviceEffects invariants', () => {
  it('clamps humidity and CO₂ to safe bounds under extreme actuator commands', () => {
    const world = createDemoWorld() as Mutable<SimulationWorld>;
    const structure = world.company.structures[0] as Mutable<(typeof world.company.structures)[number]>;
    const room = structure.rooms[0] as Mutable<(typeof structure.rooms)[number]>;
    const zone = room.zones[0] as Mutable<(typeof room.zones)[number]>;

    zone.environment = {
      ...zone.environment,
      airTemperatureC: 24,
      relativeHumidity_pct: 5,
      co2_ppm: 450,
    };

    zone.devices = [
      createHumidityDevice('dehumidify', 1),
      createCo2Device(1),
    ];

    const ctx: EngineRunContext = { tickDurationHours: 1 };
    const afterEffects = applyDeviceEffects(world, ctx);
    const updatedWorld = updateEnvironment(afterEffects, ctx);
    const nextZone = updatedWorld.company.structures[0].rooms[0].zones[0];

    expect(nextZone.environment.relativeHumidity_pct).toBeGreaterThanOrEqual(0);
    expect(nextZone.environment.relativeHumidity_pct).toBeLessThanOrEqual(100);
    expect(nextZone.environment.co2_ppm).toBeLessThanOrEqual(SAFETY_MAX_CO2_PPM);
    expect(nextZone.environment.co2_ppm).toBeGreaterThanOrEqual(0);

    const enthalpy = computeSpecificEnthalpy_kJ_per_kg(
      nextZone.environment.airTemperatureC,
      nextZone.environment.relativeHumidity_pct,
    );
    expect(Number.isFinite(enthalpy)).toBe(true);
    expect(enthalpy).toBeGreaterThanOrEqual(0);
  });

  it('preserves humidity, CO₂, and enthalpy invariants across randomized device intensities', () => {
    const duty = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
    const humidity = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });
    const co2 = fc.double({ min: 0, max: SAFETY_MAX_CO2_PPM, noNaN: true, noDefaultInfinity: true });
    const temperature = fc.double({ min: -10, max: 45, noNaN: true, noDefaultInfinity: true });
    const humidityMode = fc.constantFrom<HumidityMode>('humidify', 'dehumidify');

    fc.assert(
      fc.property(duty, humidity, co2, temperature, humidityMode, (dutyCycle01, rh, co2_ppm, tempC, mode) => {
        const world = createDemoWorld() as Mutable<SimulationWorld>;
        const structure = world.company.structures[0] as Mutable<(typeof world.company.structures)[number]>;
        const room = structure.rooms[0] as Mutable<(typeof structure.rooms)[number]>;
        const zone = room.zones[0] as Mutable<(typeof room.zones)[number]>;

        zone.environment = {
          ...zone.environment,
          airTemperatureC: tempC,
          relativeHumidity_pct: rh,
          co2_ppm,
        };

        zone.devices = [
          createHumidityDevice(mode, dutyCycle01),
          createCo2Device(dutyCycle01),
        ];

        const ctx: EngineRunContext = { tickDurationHours: 1 };
        const afterEffects = applyDeviceEffects(world, ctx);
        const updatedWorld = updateEnvironment(afterEffects, ctx);
        const nextZone = updatedWorld.company.structures[0].rooms[0].zones[0];

        expect(nextZone.environment.relativeHumidity_pct).toBeGreaterThanOrEqual(0);
        expect(nextZone.environment.relativeHumidity_pct).toBeLessThanOrEqual(100);
        expect(nextZone.environment.co2_ppm).toBeGreaterThanOrEqual(0);
        expect(nextZone.environment.co2_ppm).toBeLessThanOrEqual(SAFETY_MAX_CO2_PPM);

        const enthalpy = computeSpecificEnthalpy_kJ_per_kg(
          nextZone.environment.airTemperatureC,
          nextZone.environment.relativeHumidity_pct,
        );
        expect(Number.isFinite(enthalpy)).toBe(true);
        expect(enthalpy).toBeGreaterThanOrEqual(0);
      }),
      { seed: 0xdeca_fb, numRuns: 64 },
    );
  });
});

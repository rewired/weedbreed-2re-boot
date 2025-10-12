import { describe, expect, it } from 'vitest';

import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine';
import { getSensorReadingsRuntime } from '@/backend/src/engine/pipeline/applySensors';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type { SensorReading } from '@/backend/src/domain/interfaces/ISensor';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint';
import { type DeviceQualityPolicy, type Uuid, type ZoneDeviceInstance } from '@/backend/src/domain/world';
import { deviceQuality } from '../../testUtils/deviceHelpers.ts';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'sensor-seed';

const SENSOR_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000000',
  slug: 'temperature-sensor',
  class: 'device.test.sensor',
  name: 'Temperature Sensor',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 0,
  efficiency01: 1,
  coverage_m2: 0,
  airflow_m3_per_h: 0,
  effects: ['sensor'],
  sensor: {
    measurementType: 'temperature',
    noise01: 0
  }
};

const HEATER_BLUEPRINT: DeviceBlueprint = {
  id: '40000000-0000-0000-0000-000000000001',
  slug: 'integration-heater',
  class: 'device.test.heater',
  name: 'Integration Heater',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 1_000,
  efficiency01: 0.2,
  coverage_m2: 20,
  airflow_m3_per_h: 0,
  effects: ['thermal'],
  thermal: {
    mode: 'heat'
  }
};

function runSensorTick(
  world: ReturnType<typeof createDemoWorld>,
  deviceId: Uuid
): SensorReading<number>[] {
  const readings: SensorReading<number>[] = [];
  const ctx: EngineRunContext = {
    instrumentation: {
      onStageComplete(stage) {
        if (stage !== 'applySensors') {
          return;
        }

        const runtime = getSensorReadingsRuntime(ctx);
        const deviceReadings = runtime?.deviceSensorReadings.get(deviceId);

        if (deviceReadings?.[0]) {
          readings.push(deviceReadings[0]);
        }
      }
    }
  };

  runTick(world, ctx);

  return readings;
}

describe('Tick pipeline — sensor readings', () => {
  it('registers applySensors in the pipeline trace before updateEnvironment', () => {
    const world = createDemoWorld();
    const ctx: EngineRunContext = {};

    const { trace } = runTick(world, ctx, { trace: true });

    expect(trace).toBeDefined();
    const stepNames = trace?.steps.map((step) => step.name) ?? [];
    const deviceEffectsIndex = stepNames.indexOf('applyDeviceEffects');
    const sensorIndex = stepNames.indexOf('applySensors');
    const updateIndex = stepNames.indexOf('updateEnvironment');
    const advanceIndex = stepNames.indexOf('advancePhysiology');

    expect(deviceEffectsIndex).toBeGreaterThanOrEqual(0);
    expect(sensorIndex).toBe(deviceEffectsIndex + 1);
    expect(updateIndex).toBe(sensorIndex + 1);
    expect(sensorIndex).toBeLessThan(advanceIndex);
    expect(getSensorReadingsRuntime(ctx)).toBeUndefined();
  });

  it('sensors capture the pre-integration environment state after actuators run', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    zone.environment = {
      ...zone.environment,
      airTemperatureC: 20
    };

    const baselineTemperature = zone.environment.airTemperatureC;

    const heaterId = uuid('40000000-0000-0000-0000-000000000010');
    const heater: ZoneDeviceInstance = {
      id: heaterId,
      slug: HEATER_BLUEPRINT.slug,
      name: HEATER_BLUEPRINT.name,
      blueprintId: HEATER_BLUEPRINT.id,
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, heaterId, HEATER_BLUEPRINT),
      condition01: 1,
      powerDraw_W: HEATER_BLUEPRINT.power_W,
      dutyCycle01: 1,
      efficiency01: HEATER_BLUEPRINT.efficiency01,
      coverage_m2: HEATER_BLUEPRINT.coverage_m2 ?? 0,
      airflow_m3_per_h: HEATER_BLUEPRINT.airflow_m3_per_h ?? 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['thermal'],
      effectConfigs: { thermal: { mode: 'heat' } }
    } satisfies ZoneDeviceInstance;

    const sensorId = uuid('40000000-0000-0000-0000-000000000011');
    const sensor: ZoneDeviceInstance = {
      id: sensorId,
      slug: SENSOR_BLUEPRINT.slug,
      name: SENSOR_BLUEPRINT.name,
      blueprintId: SENSOR_BLUEPRINT.id,
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, sensorId, SENSOR_BLUEPRINT),
      condition01: 1,
      powerDraw_W: 0,
      dutyCycle01: 1,
      efficiency01: 1,
      coverage_m2: 0,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['sensor'],
      effectConfigs: {
        sensor: {
          measurementType: 'temperature',
          noise01: 0
        }
      }
    } satisfies ZoneDeviceInstance;

    zone.devices = [heater, sensor];

    const captured: SensorReading<number>[] = [];
    const ctx: EngineRunContext = {
      instrumentation: {
        onStageComplete(stage) {
          if (stage !== 'applySensors') {
            return;
          }

          const runtime = getSensorReadingsRuntime(ctx);
          const readings = runtime?.deviceSensorReadings.get(sensorId) ?? [];
          captured.push(...readings);
        }
      }
    };

    const { world: nextWorld } = runTick(world, ctx);
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    expect(captured).toHaveLength(1);
    const [reading] = captured;

    expect(reading.measuredValue).toBeCloseTo(baselineTemperature, 5);
    expect(nextZone.environment.airTemperatureC).toBeGreaterThan(baselineTemperature);
    expect(reading.error).toBe(0);
    expect(reading.trueValue).toBeCloseTo(baselineTemperature, 5);
    expect(reading.measurementType).toBe('temperature');
    expect(reading.noise01).toBe(0);
    expect(reading.noiseSample).toBe(0);
    expect(reading.rngStreamId).toBe(`sensor:${sensorId}`);
    expect(reading.sampledAtSimTimeHours).toBe(world.simTimeHours);
    expect(reading.sampledTick).toBe(0);
    expect(reading.tickDurationHours).toBeGreaterThan(0);
  });

  it('records readings from multiple sensors', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];

    const temperatureSensorId = uuid('40000000-0000-0000-0000-000000000012');
    const humiditySensorId = uuid('40000000-0000-0000-0000-000000000013');

    const temperatureSensor: ZoneDeviceInstance = {
      id: temperatureSensorId,
      slug: 'temp-sensor',
      name: 'Temp Sensor',
      blueprintId: SENSOR_BLUEPRINT.id,
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, temperatureSensorId, SENSOR_BLUEPRINT),
      condition01: 0.9,
      powerDraw_W: 0,
      dutyCycle01: 1,
      efficiency01: 1,
      coverage_m2: 0,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['sensor'],
      effectConfigs: {
        sensor: { measurementType: 'temperature', noise01: 0.05 }
      }
    } satisfies ZoneDeviceInstance;

    const humiditySensor: ZoneDeviceInstance = {
      id: humiditySensorId,
      slug: 'humidity-probe',
      name: 'Humidity Probe',
      blueprintId: SENSOR_BLUEPRINT.id,
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, humiditySensorId, SENSOR_BLUEPRINT),
      condition01: 0.8,
      powerDraw_W: 0,
      dutyCycle01: 1,
      efficiency01: 1,
      coverage_m2: 0,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['sensor'],
      effectConfigs: {
        sensor: { measurementType: 'humidity', noise01: 0.1 }
      }
    } satisfies ZoneDeviceInstance;

    zone.devices = [temperatureSensor, humiditySensor];

    const readingsByDevice = new Map<Uuid, SensorReading<number>[]>();
    const ctx: EngineRunContext = {
      instrumentation: {
        onStageComplete(stage) {
          if (stage !== 'applySensors') {
            return;
          }

          const runtime = getSensorReadingsRuntime(ctx);

          if (!runtime) {
            return;
          }

          for (const [deviceId, readings] of runtime.deviceSensorReadings.entries()) {
            readingsByDevice.set(deviceId, readings.slice());
          }
        }
      }
    };

    runTick(world, ctx);

    expect(readingsByDevice.size).toBe(2);
    const temperatureReadings = readingsByDevice.get(temperatureSensorId);
    const humidityReadings = readingsByDevice.get(humiditySensorId);

    if (!temperatureReadings || temperatureReadings.length === 0) {
      throw new Error('Expected temperature sensor readings');
    }

    if (!humidityReadings || humidityReadings.length === 0) {
      throw new Error('Expected humidity sensor readings');
    }

    const temperatureReading = temperatureReadings[0];
    const humidityReading = humidityReadings[0];

    expect(temperatureReading.measuredValue).toBeDefined();
    expect(temperatureReading.measurementType).toBe('temperature');
    expect(humidityReading.measuredValue).toBeDefined();
    expect(humidityReading.measurementType).toBe('humidity');
  });

  it('produces error telemetry when noise is applied', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];

    const sensorId = uuid('40000000-0000-0000-0000-000000000017');
    zone.devices = [
      {
        id: sensorId,
        slug: 'noisy-temp-sensor',
        name: 'Noisy Temp Sensor',
        blueprintId: SENSOR_BLUEPRINT.id,
        placementScope: 'zone',
        quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, sensorId, SENSOR_BLUEPRINT),
        condition01: 0.5,
        powerDraw_W: 0,
        dutyCycle01: 1,
        efficiency01: 1,
        coverage_m2: 0,
        airflow_m3_per_h: 0,
        sensibleHeatRemovalCapacity_W: 0,
        effects: ['sensor'],
        effectConfigs: {
          sensor: {
            measurementType: 'temperature',
            noise01: 0.4
          }
        }
      } satisfies ZoneDeviceInstance
    ];

    const errors: number[] = [];
    const ctx: EngineRunContext = {
      instrumentation: {
        onStageComplete(stage) {
          if (stage !== 'applySensors') {
            return;
          }

          const runtime = getSensorReadingsRuntime(ctx);
          const readings = runtime?.deviceSensorReadings.get(sensorId) ?? [];

          if (readings[0]) {
            errors.push(readings[0].error);
          }
        }
      }
    };

    runTick(world, ctx);

    expect(errors[0]).toBeGreaterThan(0);
  });

  it('yields exact readings when noise is zero regardless of condition', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];

    zone.devices = [
      {
        id: uuid('40000000-0000-0000-0000-000000000014'),
        slug: 'ppfd-sensor',
        name: 'PPFD Sensor',
        blueprintId: SENSOR_BLUEPRINT.id,
        placementScope: 'zone',
        quality01: 1,
        condition01: 0.2,
        powerDraw_W: 0,
        dutyCycle01: 1,
        efficiency01: 1,
        coverage_m2: 0,
        airflow_m3_per_h: 0,
        sensibleHeatRemovalCapacity_W: 0,
        effects: ['sensor'],
        effectConfigs: {
          sensor: {
            measurementType: 'ppfd',
            noise01: 0
          }
        }
      } satisfies ZoneDeviceInstance
    ];

    const ctx: EngineRunContext = {
      instrumentation: {
        onStageComplete(stage) {
          if (stage !== 'applySensors') {
            return;
          }

          const runtime = getSensorReadingsRuntime(ctx);
          const readings = runtime?.deviceSensorReadings.values().next().value;

          if (readings?.[0]) {
            expect(readings[0].measuredValue).toBe(zone.ppfd_umol_m2s);
            expect(readings[0].error).toBe(0);
            expect(readings[0].noiseSample).toBe(0);
            expect(readings[0].trueValue).toBe(zone.ppfd_umol_m2s);
          }
        }
      }
    };

    runTick(world, ctx);
  });

  it('produces deterministic readings for the same seed', () => {
    const firstWorld = createDemoWorld();
    const secondWorld = createDemoWorld();

    const sensorBlueprint: DeviceBlueprint = {
      ...SENSOR_BLUEPRINT,
      slug: 'deterministic-sensor'
    };

    const firstZone = firstWorld.company.structures[0].rooms[0].zones[0];
    const secondZone = secondWorld.company.structures[0].rooms[0].zones[0];

    const sensorId = uuid('40000000-0000-0000-0000-000000000015');
    const buildSensor = (id: Uuid): ZoneDeviceInstance => ({
      id,
      slug: sensorBlueprint.slug,
      name: sensorBlueprint.name,
      blueprintId: sensorBlueprint.id,
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, id, sensorBlueprint),
      condition01: 0.7,
      powerDraw_W: 0,
      dutyCycle01: 1,
      efficiency01: 1,
      coverage_m2: 0,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['sensor'],
      effectConfigs: {
        sensor: {
          measurementType: 'temperature',
          noise01: 0.2
        }
      }
    });

    firstZone.devices = [buildSensor(sensorId)];
    secondZone.devices = [buildSensor(sensorId)];

    const readingsA = runSensorTick(firstWorld, sensorId);
    const readingsB = runSensorTick(secondWorld, sensorId);

    expect(readingsA).toHaveLength(1);
    expect(readingsB).toHaveLength(1);

    const readingA = readingsA.at(0);
    const readingB = readingsB.at(0);

    if (!readingA || !readingB) {
      throw new Error('Expected deterministic sensor readings for identical seeds');
    }

    expect(readingA.measuredValue).toBe(readingB.measuredValue);
    expect(readingA.error).toBe(readingB.error);
    expect(readingA.noiseSample).toBe(readingB.noiseSample);
    expect(readingA.sampledAtSimTimeHours).toBe(readingB.sampledAtSimTimeHours);
  });

  it('changes sensor readings when the device id changes', () => {
    const firstWorld = createDemoWorld();
    const secondWorld = createDemoWorld();

    const sensorBlueprint: DeviceBlueprint = {
      ...SENSOR_BLUEPRINT,
      slug: 'deterministic-sensor'
    };

    const firstZone = firstWorld.company.structures[0].rooms[0].zones[0];
    const secondZone = secondWorld.company.structures[0].rooms[0].zones[0];

    const sensorIdA = uuid('40000000-0000-0000-0000-000000000015');
    const sensorIdB = uuid('40000000-0000-0000-0000-000000000016');

    const buildSensor = (id: Uuid): ZoneDeviceInstance => ({
      id,
      slug: sensorBlueprint.slug,
      name: sensorBlueprint.name,
      blueprintId: sensorBlueprint.id,
      placementScope: 'zone',
      quality01: deviceQuality(QUALITY_POLICY, WORLD_SEED, id, sensorBlueprint),
      condition01: 0.7,
      powerDraw_W: 0,
      dutyCycle01: 1,
      efficiency01: 1,
      coverage_m2: 0,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['sensor'],
      effectConfigs: {
        sensor: {
          measurementType: 'temperature',
          noise01: 0.2
        }
      }
    });

    firstZone.devices = [buildSensor(sensorIdA)];
    secondZone.devices = [buildSensor(sensorIdB)];

    const readingsA = runSensorTick(firstWorld, sensorIdA);
    const readingsB = runSensorTick(secondWorld, sensorIdB);

    expect(readingsA).toHaveLength(1);
    expect(readingsB).toHaveLength(1);

    const readingA = readingsA.at(0);
    const readingB = readingsB.at(0);

    if (!readingA || !readingB) {
      throw new Error('Expected sensor readings when comparing device ids');
    }

    expect(readingA.measuredValue).not.toBe(readingB.measuredValue);
    expect(readingA.error).not.toBe(readingB.error);
  });
});

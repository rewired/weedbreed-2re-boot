import { describe, expect, it } from 'vitest';

import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { getSensorReadingsRuntime } from '@/backend/src/engine/pipeline/applySensors.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import type { SensorOutputs } from '@/backend/src/domain/interfaces/ISensor.js';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint.js';
import {
  createDeviceInstance,
  type DeviceQualityPolicy,
  type Uuid,
  type ZoneDeviceInstance
} from '@/backend/src/domain/world.js';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

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

function deviceQuality(id: Uuid, blueprint: DeviceBlueprint): number {
  return createDeviceInstance(QUALITY_POLICY, 'sensor-seed', id, blueprint).quality01;
}

function runSensorTick(
  world: ReturnType<typeof createDemoWorld>,
  deviceId: Uuid
): SensorOutputs<number>[] {
  const readings: SensorOutputs<number>[] = [];
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
    expect(sensorIndex).toBeGreaterThan(deviceEffectsIndex);
    expect(updateIndex).toBeGreaterThan(sensorIndex);
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
      quality01: deviceQuality(heaterId, HEATER_BLUEPRINT),
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
      quality01: deviceQuality(sensorId, SENSOR_BLUEPRINT),
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

    const captured: SensorOutputs<number>[] = [];
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
    expect(captured[0]?.measuredValue).toBeCloseTo(baselineTemperature, 5);
    expect(nextZone.environment.airTemperatureC).toBeGreaterThan(baselineTemperature);
    expect(captured[0]?.error).toBe(0);
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
      quality01: deviceQuality(temperatureSensorId, SENSOR_BLUEPRINT),
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
      quality01: deviceQuality(humiditySensorId, SENSOR_BLUEPRINT),
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

    const readingsByDevice = new Map<Uuid, SensorOutputs<number>[]>();
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
    expect(readingsByDevice.get(temperatureSensorId)?.[0]?.measuredValue).toBeDefined();
    expect(readingsByDevice.get(humiditySensorId)?.[0]?.measuredValue).toBeDefined();
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
        quality01: deviceQuality(sensorId, SENSOR_BLUEPRINT),
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
          const readings = runtime?.deviceSensorReadings.values().next().value as
            | SensorOutputs<number>[]
            | undefined;

          if (readings?.[0]) {
            expect(readings[0].measuredValue).toBe(zone.ppfd_umol_m2s);
            expect(readings[0].error).toBe(0);
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
      quality01: deviceQuality(id, sensorBlueprint),
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
    expect(readingsA[0]?.measuredValue).toBe(readingsB[0]?.measuredValue);
    expect(readingsA[0]?.error).toBe(readingsB[0]?.error);
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
      quality01: deviceQuality(id, sensorBlueprint),
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
    expect(readingsA[0]?.measuredValue).not.toBe(readingsB[0]?.measuredValue);
    expect(readingsA[0]?.error).not.toBe(readingsB[0]?.error);
  });
});

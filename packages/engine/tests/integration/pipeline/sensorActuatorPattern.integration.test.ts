import { describe, expect, it } from 'vitest';

import { getSensorReadingsRuntime } from '@/backend/src/engine/pipeline/applySensors.js';
import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import type { ZoneDeviceInstance, Uuid } from '@/backend/src/domain/world.js';

type SensorSnapshot = {
  readonly measured: number;
};

function uuid(value: string): Uuid {
  return value as Uuid;
}

describe('Tick pipeline — sensor + actuator pattern', () => {
  it('Pattern D: Sensor reads pre-tick, actuator applies post-read', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];

    zone.environment = {
      ...zone.environment,
      airTemperatureC: 20,
    };

    const deviceId = uuid('60000000-0000-0000-0000-000000000001');
    const tempController: ZoneDeviceInstance = {
      id: deviceId,
      slug: 'temp-controller',
      name: 'Temperature Controller',
      blueprintId: uuid('60000000-0000-0000-0000-000000000002'),
      placementScope: 'zone',
      quality01: 1,
      condition01: 1,
      powerDraw_W: 500,
      dutyCycle01: 1,
      efficiency01: 0.8,
      coverage_m2: zone.floorArea_m2 ?? 0,
      airflow_m3_per_h: 0,
      sensibleHeatRemovalCapacity_W: 0,
      effects: ['sensor', 'thermal'],
      effectConfigs: {
        sensor: { measurementType: 'temperature', noise01: 0 },
        thermal: { mode: 'heat', max_heat_W: 500 },
      },
    } satisfies ZoneDeviceInstance;

    zone.devices = [tempController];

    const initialTemperature = zone.environment.airTemperatureC;

    const tickOneSnapshots: SensorSnapshot[] = [];
    const ctxTickOne: EngineRunContext = {
      instrumentation: {
        onStageComplete(stage) {
          if (stage !== 'applySensors') {
            return;
          }

          const runtime = getSensorReadingsRuntime(ctxTickOne);
          const readings = runtime?.deviceSensorReadings.get(deviceId) ?? [];
          tickOneSnapshots.push(
            ...readings.map((reading) => ({ measured: reading.measuredValue })),
          );
        },
      },
    } satisfies EngineRunContext;

    const { world: afterFirst } = runTick(world, ctxTickOne);
    const firstZone = afterFirst.company.structures[0].rooms[0].zones[0];

    expect(tickOneSnapshots).toHaveLength(1);
    expect(tickOneSnapshots[0]?.measured).toBeCloseTo(initialTemperature, 5);
    expect(firstZone.environment.airTemperatureC).toBeGreaterThan(initialTemperature);

    const tickTwoSnapshots: SensorSnapshot[] = [];
    const baselineSecondTemp = firstZone.environment.airTemperatureC;
    const ctxTickTwo: EngineRunContext = {
      instrumentation: {
        onStageComplete(stage) {
          if (stage !== 'applySensors') {
            return;
          }

          const runtime = getSensorReadingsRuntime(ctxTickTwo);
          const readings = runtime?.deviceSensorReadings.get(deviceId) ?? [];
          tickTwoSnapshots.push(
            ...readings.map((reading) => ({ measured: reading.measuredValue })),
          );
        },
      },
    } satisfies EngineRunContext;

    const { world: afterSecond } = runTick(afterFirst, ctxTickTwo);
    const secondZone = afterSecond.company.structures[0].rooms[0].zones[0];

    expect(tickTwoSnapshots).toHaveLength(1);
    expect(tickTwoSnapshots[0]?.measured).toBeCloseTo(baselineSecondTemp, 5);
    expect(secondZone.environment.airTemperatureC).toBeGreaterThan(baselineSecondTemp);
  });
});

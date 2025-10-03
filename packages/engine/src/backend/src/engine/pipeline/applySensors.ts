import type { SensorOutputs } from '../../domain/interfaces/ISensor.js';
import type { SensorMeasurementType, ZoneDeviceInstance } from '../../domain/entities.js';
import type { SimulationWorld, Zone } from '../../domain/world.js';
import { createSensorStub } from '../../stubs/index.js';
import type { EngineDiagnostic, EngineRunContext } from '../Engine.js';
import { createRng } from '../../util/rng.js';

export interface SensorReadingsRuntime {
  readonly deviceSensorReadings: Map<ZoneDeviceInstance['id'], SensorOutputs<number>[]>;
}

const SENSOR_READINGS_CONTEXT_KEY = '__wb_sensorReadings' as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type SensorRuntimeCarrier = Mutable<EngineRunContext> & {
  [SENSOR_READINGS_CONTEXT_KEY]?: SensorReadingsRuntime;
};

function setSensorRuntime(ctx: EngineRunContext, runtime: SensorReadingsRuntime): SensorReadingsRuntime {
  (ctx as SensorRuntimeCarrier)[SENSOR_READINGS_CONTEXT_KEY] = runtime;
  return runtime;
}

export function ensureSensorReadingsRuntime(ctx: EngineRunContext): SensorReadingsRuntime {
  return setSensorRuntime(ctx, {
    deviceSensorReadings: new Map()
  });
}

export function getSensorReadingsRuntime(ctx: EngineRunContext): SensorReadingsRuntime | undefined {
  return (ctx as SensorRuntimeCarrier)[SENSOR_READINGS_CONTEXT_KEY];
}

export function clearSensorReadingsRuntime(ctx: EngineRunContext): void {
  delete (ctx as SensorRuntimeCarrier)[SENSOR_READINGS_CONTEXT_KEY];
}

function emitDiagnostic(ctx: EngineRunContext, diagnostic: EngineDiagnostic): void {
  ctx.diagnostics?.emit(diagnostic);
}

function resolveMeasurement(measurementType: SensorMeasurementType, zone: Zone): number | null {
  switch (measurementType) {
    case 'temperature':
      return Number.isFinite(zone.environment.airTemperatureC)
        ? zone.environment.airTemperatureC
        : 0;
    case 'humidity':
      return Number.isFinite(zone.environment.relativeHumidity_pct)
        ? zone.environment.relativeHumidity_pct
        : 0;
    case 'ppfd':
      return Number.isFinite(zone.ppfd_umol_m2s) ? zone.ppfd_umol_m2s : 0;
    default:
      return null;
  }
}

function isSensorDevice(device: ZoneDeviceInstance): boolean {
  return Array.isArray(device.effects) && device.effects.includes('sensor');
}

function recordSensorReading(
  runtime: SensorReadingsRuntime,
  deviceId: ZoneDeviceInstance['id'],
  reading: SensorOutputs<number>
): void {
  const existing = runtime.deviceSensorReadings.get(deviceId);

  if (existing) {
    existing.push(reading);
    return;
  }

  runtime.deviceSensorReadings.set(deviceId, [reading]);
}

export function applySensors(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const runtime = ensureSensorReadingsRuntime(ctx);

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        for (const device of zone.devices) {
          if (!isSensorDevice(device)) {
            continue;
          }

          const sensorConfig = device.effectConfigs?.sensor;

          if (!sensorConfig) {
            emitDiagnostic(ctx, {
              scope: 'zone',
              code: 'sensor.config.missing',
              zoneId: zone.id,
              message: `Sensor device "${device.name}" is missing sensor configuration payload.`,
              metadata: {
                deviceId: device.id,
                deviceSlug: device.slug
              }
            });
            continue;
          }

          const { measurementType, noise01 } = sensorConfig;
          const trueValue = resolveMeasurement(measurementType, zone);

          if (trueValue === null) {
            emitDiagnostic(ctx, {
              scope: 'zone',
              code: 'sensor.config.invalid',
              zoneId: zone.id,
              message: `Sensor device "${device.name}" has unsupported measurement type "${measurementType}".`,
              metadata: {
                deviceId: device.id,
                deviceSlug: device.slug,
                measurementType
              }
            });
            continue;
          }

          const stub = createSensorStub(measurementType);
          const rng = createRng(world.seed, `sensor:${device.id}`);
          const reading = stub.computeEffect(
            {
              trueValue,
              noise01,
              condition01: device.condition01
            },
            rng
          );

          recordSensorReading(runtime, device.id, reading);
        }
      }
    }
  }

  return world;
}


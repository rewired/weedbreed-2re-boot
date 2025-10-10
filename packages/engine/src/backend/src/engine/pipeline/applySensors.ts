import type { SensorReading } from '../../domain/interfaces/ISensor.ts';
import type { SensorMeasurementType, ZoneDeviceInstance } from '../../domain/entities.ts';
import type { SimulationWorld, Zone } from '../../domain/world.ts';
import { createSensorStub } from '../../stubs/index.ts';
import type { EngineDiagnostic, EngineRunContext } from '../Engine.ts';
import { createRng } from '../../util/rng.ts';
import { resolveTickHours } from '../resolveTickHours.ts';
import { HOURS_PER_TICK } from '../../constants/simConstants.ts';
import { assertValidSensorReading } from './sensorReadingSchema.ts';

export interface SensorReadingsRuntime {
  readonly sampledAtSimTimeHours: number;
  readonly sampledTick: number;
  readonly tickDurationHours: number;
  readonly deviceSensorReadings: Map<ZoneDeviceInstance['id'], SensorReading<number>[]>;
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

export function ensureSensorReadingsRuntime(
  ctx: EngineRunContext,
  metadata: Pick<SensorReadingsRuntime, 'sampledAtSimTimeHours' | 'sampledTick' | 'tickDurationHours'>
): SensorReadingsRuntime {
  return setSensorRuntime(ctx, {
    ...metadata,
    deviceSensorReadings: new Map()
  });
}

export function getSensorReadingsRuntime(ctx: EngineRunContext): SensorReadingsRuntime | undefined {
  return (ctx as SensorRuntimeCarrier)[SENSOR_READINGS_CONTEXT_KEY];
}

export function clearSensorReadingsRuntime(ctx: EngineRunContext): void {
  const carrier = ctx as SensorRuntimeCarrier;

  if (SENSOR_READINGS_CONTEXT_KEY in carrier) {
    carrier[SENSOR_READINGS_CONTEXT_KEY] = undefined;
  }
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
      return Number.isFinite(zone.environment.relativeHumidity01)
        ? zone.environment.relativeHumidity01
        : 0;
    case 'ppfd':
      return Number.isFinite(zone.ppfd_umol_m2s) ? zone.ppfd_umol_m2s : 0;
    case 'co2':
      return Number.isFinite(zone.environment.co2_ppm)
        ? zone.environment.co2_ppm
        : 0;
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
  reading: SensorReading<number>
): void {
  const existing = runtime.deviceSensorReadings.get(deviceId);

  if (existing) {
    existing.push(reading);
    return;
  }

  runtime.deviceSensorReadings.set(deviceId, [reading]);
}

export function applySensors(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const sampledAtSimTimeHours = Number.isFinite(world.simTimeHours) ? world.simTimeHours : 0;
  const tickDurationCandidate = resolveTickHours(ctx);
  const tickDurationHours = tickDurationCandidate > 0 ? tickDurationCandidate : HOURS_PER_TICK;
  const sampledTick = Math.max(0, Math.trunc(sampledAtSimTimeHours / tickDurationHours));

  const runtime = ensureSensorReadingsRuntime(ctx, {
    sampledAtSimTimeHours,
    sampledTick,
    tickDurationHours
  });

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
          const rngStreamId = `sensor:${device.id}`;
          const rng = createRng(world.seed, rngStreamId);
          const reading = stub.computeEffect(
            {
              trueValue,
              noise01,
              condition01: device.condition01
            },
            rng
          );
          const validatedReading = assertValidSensorReading({
            ...reading,
            measurementType,
            rngStreamId,
            sampledAtSimTimeHours,
            sampledTick,
            tickDurationHours
          });
          const enrichedReading = Object.freeze(validatedReading) as SensorReading<number>;

          recordSensorReading(runtime, device.id, enrichedReading);
        }
      }
    }
  }

  return world;
}


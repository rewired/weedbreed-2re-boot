import { z } from 'zod';
import { deterministicUuid, hashCanonicalState } from '@wb/engine';
import type { TelemetryEvent, TelemetryEventInput } from '@wb/transport-sio';

import {
  TELEMETRY_HARVEST_CREATED_V1,
  TELEMETRY_TICK_COMPLETED_V1,
  TELEMETRY_WORKFORCE_KPI_V1,
  TELEMETRY_ZONE_SNAPSHOT_V1,
} from '@/backend/src/telemetry/topics.js';

const finite = () => z.number().finite();

const tickSchema = z
  .object({
    simTimeHours: finite(),
    targetTicksPerHour: finite().optional(), actualTicksPerHour: finite().optional(),
    operatingCostPerHour: finite().optional(), labourCostPerHour: finite().optional(),
    utilitiesCostPerHour: finite().optional(), energyKwhPerDay: finite().optional(),
    energyCostPerHour: finite().optional(), waterCubicMetersPerDay: finite().optional(),
    waterCostPerHour: finite().optional(),
  })
  .passthrough();

const zoneWarningSchema = z
  .object({ code: z.string(), message: z.string(), severity: z.union([z.literal('info'), z.literal('warning'), z.literal('critical')]) })
  .passthrough();

const zoneSchema = z
  .object({
    zoneId: z.string(), simTime: finite(), ppfd: finite(), dli_incremental: finite(), temp_c: finite(),
    relativeHumidity01: finite(), co2_ppm: finite(), ach: finite(),
    warnings: z.array(zoneWarningSchema).readonly(),
  })
  .passthrough();

const workforceSchema = z.object({
  snapshot: z.object({
    simTimeHours: finite(), tasksCompleted: finite(), queueDepth: finite(), laborHoursCommitted: finite(),
    overtimeHoursCommitted: finite(), overtimeMinutes: finite(), utilization01: z.number().min(0).max(1),
    p95WaitTimeHours: z.number().min(0).finite(), maintenanceBacklog: z.number().min(0).finite(),
    averageMorale01: z.number().min(0).max(1), averageFatigue01: z.number().min(0).max(1),
  }),
});

const harvestSchema = z
  .object({
    structureId: z.string(), roomId: z.string(), plantId: z.string(), zoneId: z.string(), lotId: z.string(),
    createdAt_tick: finite(), freshWeight_kg: finite(), moisture01: finite(), quality01: z.number().min(0).max(1),
  })
  .passthrough();

interface TopicEntry {
  readonly schema: z.ZodType<unknown>;
  readonly map?: (value: unknown) => unknown;
}

const topicRegistry = new Map<string, TopicEntry>([
  [TELEMETRY_TICK_COMPLETED_V1, { schema: tickSchema }],
  [TELEMETRY_ZONE_SNAPSHOT_V1, { schema: zoneSchema }],
  [TELEMETRY_WORKFORCE_KPI_V1, { schema: workforceSchema, map: (value) => (value as { snapshot: unknown }).snapshot }],
  [TELEMETRY_HARVEST_CREATED_V1, { schema: harvestSchema }],
]);

export interface TelemetryIdentitySource {
  readonly getSeed: () => string;
  readonly getSimTick: () => number;
}

export interface TelemetryPublisherOptions {
  readonly sink: (event: TelemetryEvent) => void;
  readonly identity: TelemetryIdentitySource;
}

export interface TelemetryPublisher {
  publish(event: TelemetryEventInput): void;
  reset(): void;
}

function finiteTick(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

function resolveEventSimTick(payload: unknown, fallback: number): number {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const direct = finiteTick(record.simTick)
      ?? finiteTick(record.createdAt_tick)
      ?? finiteTick(record.simTimeHours)
      ?? finiteTick(record.simTime);
    if (direct !== null) return direct;
    if (record.snapshot && typeof record.snapshot === 'object') {
      const nested = finiteTick((record.snapshot as Record<string, unknown>).simTimeHours);
      if (nested !== null) return nested;
    }
  }
  const tick = finiteTick(fallback);
  if (tick === null) throw new TypeError('Telemetry identity source returned an invalid sim tick.');
  return tick;
}

export function createTelemetryPublisher({ sink, identity }: TelemetryPublisherOptions): TelemetryPublisher {
  const ordinalsByTick = new Map<string, number>();
  return {
    publish(event: TelemetryEventInput) {
      if (typeof event.topic !== 'string') {
        throw new TypeError('Telemetry event topic must be a string');
      }
      const entry = topicRegistry.get(event.topic);
      const parsed = entry ? entry.schema.parse(event.payload) : event.payload;
      const payload = entry?.map ? entry.map(parsed) : parsed;
      const seed = identity.getSeed();
      if (typeof seed !== 'string' || seed.length === 0) {
        throw new TypeError('Telemetry identity source returned an invalid seed.');
      }
      const simTick = resolveEventSimTick(payload, identity.getSimTick());
      const bucket = `${seed}:${String(simTick)}`;
      const ordinal = ordinalsByTick.get(bucket) ?? 0;
      ordinalsByTick.set(bucket, ordinal + 1);
      const payloadHash = hashCanonicalState(payload);
      const eventId = deterministicUuid(
        seed,
        `telemetry:${String(simTick)}:${String(ordinal)}:${event.topic}:${payloadHash}`,
      );
      sink({ topic: event.topic, payload, simTick, eventId });
    },
    reset() {
      ordinalsByTick.clear();
    },
  } satisfies TelemetryPublisher;
}

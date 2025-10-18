import { z } from 'zod';

import {
  TELEMETRY_HARVEST_CREATED_V1,
  TELEMETRY_TICK_COMPLETED_V1,
  TELEMETRY_WORKFORCE_KPI_V1,
  TELEMETRY_ZONE_SNAPSHOT_V1,
} from '@/backend/src/telemetry/topics.ts';

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

interface TelemetryEnvelope {
  readonly topic: string;
  readonly payload: unknown;
}

export interface TelemetryPublisherOptions {
  readonly sink: (event: TelemetryEnvelope) => void;
}

export interface TelemetryPublisher {
  publish(event: TelemetryEnvelope): void;
}

export function createTelemetryPublisher({ sink }: TelemetryPublisherOptions): TelemetryPublisher {
  return {
    publish(event: TelemetryEnvelope) {
      if (typeof event.topic !== 'string') {
        throw new TypeError('Telemetry event topic must be a string');
      }
      const entry = topicRegistry.get(event.topic);
      if (!entry) {
        sink(event);
        return;
      }
      const parsed = entry.schema.parse(event.payload);
      const payload = entry.map ? entry.map(parsed) : parsed;
      sink({ topic: event.topic, payload });
    },
  } satisfies TelemetryPublisher;
}

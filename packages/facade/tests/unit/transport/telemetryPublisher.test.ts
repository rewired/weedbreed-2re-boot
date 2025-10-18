import { describe, expect, it, vi } from 'vitest';

import {
  TELEMETRY_HARVEST_CREATED_V1,
  TELEMETRY_TICK_COMPLETED_V1,
  TELEMETRY_WORKFORCE_KPI_V1,
  TELEMETRY_ZONE_SNAPSHOT_V1,
} from '@/backend/src/telemetry/topics.ts';
import type { TelemetryEvent } from '@wb/transport-sio';

import { createTelemetryPublisher } from '../../../src/transport/telemetryPublisher';

describe('createTelemetryPublisher', () => {
  it('validates and normalises registered telemetry topics', () => {
    const sink = vi.fn<(event: TelemetryEvent) => void>();
    const publisher = createTelemetryPublisher({ sink });
    const ensureRecord = (value: unknown): Record<string, unknown> => {
      if (typeof value !== 'object' || value === null) {
        throw new TypeError('Expected record payload');
      }
      return value as Record<string, unknown>;
    };
    const scenarios = [
      { topic: TELEMETRY_TICK_COMPLETED_V1, valid: { simTimeHours: 1, targetTicksPerHour: 1, actualTicksPerHour: 1 }, invalid: { simTimeHours: '1' }, assert(payload: Record<string, unknown>) { expect(payload.simTimeHours).toBe(1); } },
      { topic: TELEMETRY_ZONE_SNAPSHOT_V1, valid: { zoneId: 'zone-1', simTime: 1, ppfd: 350, dli_incremental: 12, temp_c: 24, relativeHumidity01: 0.65, co2_ppm: 420, ach: 1.1, warnings: [{ code: 'ok', message: 'nominal', severity: 'info' }] }, invalid: { zoneId: 42 }, assert(payload: Record<string, unknown>) { expect(payload.zoneId).toBe('zone-1'); expect(Array.isArray(payload.warnings)).toBe(true); } },
      { topic: TELEMETRY_WORKFORCE_KPI_V1, valid: { snapshot: { simTimeHours: 1, tasksCompleted: 2, queueDepth: 3, laborHoursCommitted: 4, overtimeHoursCommitted: 0.5, overtimeMinutes: 30, utilization01: 0.5, p95WaitTimeHours: 1.2, maintenanceBacklog: 1, averageMorale01: 0.8, averageFatigue01: 0.2 } }, invalid: { snapshot: { simTimeHours: 'bad' } }, assert(payload: Record<string, unknown>) { expect(payload.tasksCompleted).toBe(2); expect(payload.queueDepth).toBe(3); } },
      { topic: TELEMETRY_HARVEST_CREATED_V1, valid: { structureId: 'structure-1', roomId: 'room-1', plantId: 'plant-1', zoneId: 'zone-1', lotId: 'lot-1', createdAt_tick: 10, freshWeight_kg: 1.2, moisture01: 0.6, quality01: 0.9 }, invalid: { structureId: 42 }, assert(payload: Record<string, unknown>) { expect(payload.structureId).toBe('structure-1'); expect(payload.quality01).toBe(0.9); } },
    ] as const;

    for (const scenario of scenarios) {
      sink.mockClear();
      publisher.publish({ topic: scenario.topic, payload: scenario.valid });
      const forwarded = sink.mock.calls.at(0)?.at(0);
      if (!forwarded) {
        throw new Error('Expected telemetry event to be forwarded');
      }
      expect(forwarded.topic).toBe(scenario.topic);
      scenario.assert(ensureRecord(forwarded.payload));
      expect(() => {
        publisher.publish({ topic: scenario.topic, payload: scenario.invalid as unknown });
      }).toThrow();
    }
  });

  it('passes through unregistered topics without validation', () => {
    const sink = vi.fn<(event: TelemetryEvent) => void>();
    const publisher = createTelemetryPublisher({ sink });
    const event: TelemetryEvent = { topic: 'telemetry.custom.topic', payload: { arbitrary: 'payload' } };

    publisher.publish(event);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(event);
  });
});

import { describe, expect, it } from 'vitest';

import {
  TELEMETRY_TICK_COMPLETED_TOPIC,
  TELEMETRY_TOPIC_SCHEMAS,
  TELEMETRY_WORKFORCE_KPI_TOPIC,
  TELEMETRY_ZONE_SNAPSHOT_TOPIC,
} from '../../src/contracts/events.ts';

const SAMPLES: Record<string, unknown> = {
  [TELEMETRY_TICK_COMPLETED_TOPIC]: {
    simTimeHours: 72,
    targetTicksPerHour: 1,
    operatingCostPerHour: 125.5,
    labourCostPerHour: 82.25,
    utilitiesCostPerHour: 43.25,
  },
  [TELEMETRY_ZONE_SNAPSHOT_TOPIC]: {
    zoneId: 'zone-001',
    simTime: 72,
    ppfd: 650,
    dli_incremental: 35.2,
    temp_c: 24.5,
    relativeHumidity01: 0.6,
    co2_ppm: 900,
    ach: 12,
    warnings: [
      {
        code: 'humidity-high',
        message: 'Relative humidity trending above target.',
        severity: 'warning',
      },
    ],
  },
  [TELEMETRY_WORKFORCE_KPI_TOPIC]: {
    snapshot: {
      simTimeHours: 72,
      tasksCompleted: 18,
      queueDepth: 2,
      laborHoursCommitted: 24,
      overtimeHoursCommitted: 1.5,
      overtimeMinutes: 90,
      p95WaitTimeHours: 1.25,
      maintenanceBacklog: 3,
      utilization01: 0.58,
      averageMorale01: 0.74,
      averageFatigue01: 0.41,
    },
  },
};

const isBounded01 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

describe('TELEMETRY_TOPIC_SCHEMAS', () => {
  it('aligns canonical samples with documented field sets', () => {
    for (const schema of TELEMETRY_TOPIC_SCHEMAS) {
      const record = SAMPLES[schema.topic] as Record<string, unknown> | undefined;
      expect(record, `Missing sample for ${schema.topic}`).toBeDefined();

      for (const field of schema.required) {
        expect(record?.[field]).toBeDefined();
      }
      if (schema.bounded01) {
        for (const field of schema.bounded01) {
          expect(isBounded01(record?.[field])).toBe(true);
        }
      }

      schema.nested?.forEach((nested) => {
        const value = record?.[nested.key];

        if (nested.kind === 'object') {
          const obj = value as Record<string, unknown> | undefined;
          expect(obj).toBeDefined();
          for (const field of nested.required) {
            expect(obj?.[field]).toBeDefined();
          }
          if (nested.bounded01) {
            for (const field of nested.bounded01) {
              expect(isBounded01(obj?.[field])).toBe(true);
            }
          }
        } else {
          const entries = value as readonly Record<string, unknown>[] | undefined;
          expect(Array.isArray(entries)).toBe(true);
          entries?.forEach((entry) => {
            for (const field of nested.required) {
              expect(entry[field]).toBeDefined();
            }
            if (nested.enumValues) {
              for (const [field, allowed] of Object.entries(nested.enumValues)) {
                expect(allowed).toContain(entry[field]);
              }
            }
          });
        }
      });
    }
  });
});

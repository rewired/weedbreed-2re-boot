import { describe, expect, it } from 'vitest';

import { commitAndTelemetry } from '@/backend/src/engine/pipeline/commitAndTelemetry';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type { EngineRunContext } from '@/backend/src/engine/Engine';
import type {
  WorkforcePayrollState,
} from '@/backend/src/domain/world';
import {
  TELEMETRY_TICK_COMPLETED_V1,
} from '@/backend/src/telemetry/topics';

interface TelemetryEvent {
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

function createTelemetryRecorder() {
  const events: TelemetryEvent[] = [];
  return {
    events,
    emit(topic: string, payload: Record<string, unknown>) {
      events.push({ topic, payload });
    },
  };
}

describe('commitAndTelemetry (unit)', () => {
  it('increments sim time and emits tick telemetry with economy rollup', () => {
    const world = createDemoWorld();
    const telemetry = createTelemetryRecorder();

    const payrollState: WorkforcePayrollState = {
      dayIndex: 0,
      totals: {
        baseMinutes: 180,
        otMinutes: 60,
        baseCost: 315,
        otCost: 105,
        totalLaborCost: 420,
      },
      byStructure: [],
    } satisfies WorkforcePayrollState;

    const ctx: EngineRunContext & {
      __wb_worldMutated: boolean;
      economyAccruals: {
        workforce: { current: WorkforcePayrollState };
        deviceMaintenance: { current: { costCc_per_h: number } };
        utilities: {
          current: {
            dayIndex: number;
            hoursAccrued: number;
            energyConsumption_kWh: number;
            energyCostCc: number;
            energyCostCc_per_h: number;
            waterConsumption_m3: number;
            waterCostCc: number;
            waterCostCc_per_h: number;
          };
        };
        cultivation: { current: { dayIndex: number; hoursAccrued: number; costCc: number; costCc_per_h: number } };
      };
    } = {
      telemetry,
      tickDurationHours: 0.5,
      __wb_worldMutated: true,
      economyAccruals: {
        workforce: { current: payrollState },
        deviceMaintenance: { current: { costCc_per_h: 15 } },
        utilities: {
          current: {
            dayIndex: 0,
            hoursAccrued: 4,
            energyConsumption_kWh: 40,
            energyCostCc: 48,
            energyCostCc_per_h: 12,
            waterConsumption_m3: 8,
            waterCostCc: 20,
            waterCostCc_per_h: 5,
          },
        },
        cultivation: {
          current: {
            dayIndex: 0,
            hoursAccrued: 4,
            costCc: 24,
            costCc_per_h: 6,
          },
        },
      },
    };

    const nextWorld = commitAndTelemetry(world, ctx);

    expect(nextWorld.simTimeHours).toBeCloseTo(world.simTimeHours + 1, 6);
    expect(telemetry.events).toHaveLength(1);

    const [event] = telemetry.events;
    expect(event.topic).toBe(TELEMETRY_TICK_COMPLETED_V1);

    const payload = event.payload as Record<string, number | undefined>;
    expect(payload.simTimeHours).toBe(nextWorld.simTimeHours);
    expect(payload.targetTicksPerHour).toBeCloseTo(2, 6);
    expect(payload.actualTicksPerHour).toBeCloseTo(1, 6);
    expect(payload.labourCostPerHour).toBeCloseTo(105, 6);
    expect(payload.utilitiesCostPerHour).toBeCloseTo(17, 6);
    expect(payload.energyKwhPerDay).toBeCloseTo(240, 6);
    expect(payload.energyCostPerHour).toBeCloseTo(12, 6);
    expect(payload.waterCubicMetersPerDay).toBeCloseTo(48, 6);
    expect(payload.waterCostPerHour).toBeCloseTo(5, 6);
    expect(payload.operatingCostPerHour).toBeCloseTo(143, 6);
  });
});

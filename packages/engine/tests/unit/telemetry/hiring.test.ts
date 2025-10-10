import { describe, expect, it, vi } from 'vitest';

import {
  emitHiringEmployeeOnboarded,
  emitHiringMarketScanCompleted,
} from '@/backend/src/telemetry/hiring';
import {
  TELEMETRY_HIRING_EMPLOYEE_ONBOARDED_V1,
  TELEMETRY_HIRING_MARKET_SCAN_COMPLETED_V1,
} from '@/backend/src/telemetry/topics';

describe('telemetry/hiring', () => {
  it('emits sanitized payload for market scan events', () => {
    const emit = vi.fn();
    const bus = { emit };
    const payload = {
      structureId: 'structure-1',
      simDay: 12,
      scanCounter: 3,
      poolSize: 5,
      cost_cc: 42,
    } as const;
    const expected = { ...payload };

    emitHiringMarketScanCompleted(bus, payload);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(TELEMETRY_HIRING_MARKET_SCAN_COMPLETED_V1, expected);
    expect(emit.mock.calls[0][1]).not.toBe(payload);

    // Mutating the original payload after emission must not affect the recorded telemetry payload.
    (payload as { scanCounter: number }).scanCounter = 9;
    expect(emit.mock.calls[0][1]).toStrictEqual(expected);
  });

  it('emits sanitized payload for onboarded events', () => {
    const emit = vi.fn();
    const bus = { emit };
    const payload = {
      employeeId: 'employee-1',
      structureId: 'structure-1',
    } as const;
    const expected = { ...payload };

    emitHiringEmployeeOnboarded(bus, payload);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(TELEMETRY_HIRING_EMPLOYEE_ONBOARDED_V1, expected);
    expect(emit.mock.calls[0][1]).not.toBe(payload);

    (payload as { employeeId: string }).employeeId = 'mutated';
    expect(emit.mock.calls[0][1]).toStrictEqual(expected);
  });

  it('skips emission when telemetry bus is undefined', () => {
    expect(() => {
      emitHiringMarketScanCompleted(undefined, {
        structureId: 'structure-1',
        simDay: 0,
        scanCounter: 0,
        poolSize: 0,
        cost_cc: 0,
      });
    }).not.toThrow();
  });
});

import type { TelemetryBus } from '../engine/Engine.ts';
import type { Uuid } from '../domain/schemas/primitives.ts';
import {
  TELEMETRY_HIRING_EMPLOYEE_ONBOARDED_V1,
  TELEMETRY_HIRING_MARKET_SCAN_COMPLETED_V1,
} from './topics.ts';
import { cloneTelemetryPayload } from './payload.ts';

function emitEvent(
  bus: TelemetryBus | undefined,
  topic: string,
  payload: Record<string, unknown>,
): void {
  if (!bus) {
    return;
  }

  if (typeof topic !== 'string' || topic.length === 0) {
    return;
  }

  if (typeof payload !== 'object') {
    return;
  }

  const sanitizedPayload = cloneTelemetryPayload(payload);

  bus.emit(topic, sanitizedPayload);
}

export interface HiringMarketScanTelemetryPayload {
  readonly structureId: Uuid;
  readonly simDay: number;
  readonly scanCounter: number;
  readonly poolSize: number;
  readonly cost_cc: number;
}

export function emitHiringMarketScanCompleted(
  bus: TelemetryBus | undefined,
  payload: HiringMarketScanTelemetryPayload,
): void {
  emitEvent(bus, TELEMETRY_HIRING_MARKET_SCAN_COMPLETED_V1, payload);
}

export interface HiringEmployeeOnboardedTelemetryPayload {
  readonly employeeId: Uuid;
  readonly structureId: Uuid;
}

export function emitHiringEmployeeOnboarded(
  bus: TelemetryBus | undefined,
  payload: HiringEmployeeOnboardedTelemetryPayload,
): void {
  emitEvent(bus, TELEMETRY_HIRING_EMPLOYEE_ONBOARDED_V1, payload);
}

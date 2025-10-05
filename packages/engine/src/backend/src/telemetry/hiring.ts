import type { TelemetryBus } from '../engine/Engine.js';
import type { Uuid } from '../domain/entities.js';
import {
  TELEMETRY_HIRING_EMPLOYEE_ONBOARDED_V1,
  TELEMETRY_HIRING_MARKET_SCAN_COMPLETED_V1,
} from './topics.js';

function emitEvent(
  bus: TelemetryBus | undefined,
  topic: string,
  payload: Record<string, unknown>,
): void {
  bus?.emit(topic, payload);
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

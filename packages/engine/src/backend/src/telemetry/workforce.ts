import type { TelemetryBus } from '../engine/Engine.ts';
import type {
  WorkforceKpiSnapshot,
  WorkforcePayrollState,
  WorkforceWarning,
} from '../domain/world.ts';
import {
  TELEMETRY_WORKFORCE_KPI_V1,
  TELEMETRY_WORKFORCE_WARNING_V1,
  TELEMETRY_WORKFORCE_PAYROLL_SNAPSHOT_V1,
  TELEMETRY_WORKFORCE_RAISE_ACCEPTED_V1,
  TELEMETRY_WORKFORCE_RAISE_BONUS_V1,
  TELEMETRY_WORKFORCE_RAISE_IGNORED_V1,
  TELEMETRY_WORKFORCE_EMPLOYEE_TERMINATED_V1,
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

  if (!payload || typeof payload !== 'object') {
    return;
  }

  const sanitizedPayload = cloneTelemetryPayload(payload);

  bus.emit(topic, sanitizedPayload);
}

/**
 * Emits the most recent workforce KPI snapshot to the telemetry bus.
 */
export function emitWorkforceKpiSnapshot(
  bus: TelemetryBus | undefined,
  snapshot: WorkforceKpiSnapshot
): void {
  emitEvent(bus, TELEMETRY_WORKFORCE_KPI_V1, { snapshot });
}

/**
 * Emits workforce warnings to the telemetry bus without duplicating intent traffic.
 */
export function emitWorkforceWarnings(
  bus: TelemetryBus | undefined,
  warnings: readonly WorkforceWarning[]
): void {
  if (!bus || warnings.length === 0) {
    return;
  }

  emitEvent(bus, TELEMETRY_WORKFORCE_WARNING_V1, { warnings });
}

export function emitWorkforcePayrollSnapshot(
  bus: TelemetryBus | undefined,
  snapshot: WorkforcePayrollState,
): void {
  if (!bus) {
    return;
  }

  emitEvent(bus, TELEMETRY_WORKFORCE_PAYROLL_SNAPSHOT_V1, { snapshot });
}

export interface WorkforceRaiseTelemetryEvent {
  readonly action: 'accept' | 'bonus' | 'ignore';
  readonly employeeId: string;
  readonly structureId?: string;
  readonly simDay: number;
  readonly rateIncreaseFactor: number;
  readonly moraleDelta01: number;
  readonly salaryExpectation_per_h: number;
  readonly bonusAmount_cc?: number;
}

export function emitWorkforceRaiseEvent(
  bus: TelemetryBus | undefined,
  event: WorkforceRaiseTelemetryEvent,
): void {
  if (!bus) {
    return;
  }

  const payload = { event } satisfies { event: WorkforceRaiseTelemetryEvent };
  const topic =
    event.action === 'accept'
      ? TELEMETRY_WORKFORCE_RAISE_ACCEPTED_V1
      : event.action === 'bonus'
        ? TELEMETRY_WORKFORCE_RAISE_BONUS_V1
        : TELEMETRY_WORKFORCE_RAISE_IGNORED_V1;

  emitEvent(bus, topic, payload);
}

export interface WorkforceTerminationTelemetryEvent {
  readonly employeeId: string;
  readonly structureId?: string;
  readonly simDay: number;
  readonly reasonSlug?: string;
  readonly severanceCc?: number;
}

export function emitWorkforceTermination(
  bus: TelemetryBus | undefined,
  event: WorkforceTerminationTelemetryEvent,
): void {
  if (!bus) {
    return;
  }

  emitEvent(bus, TELEMETRY_WORKFORCE_EMPLOYEE_TERMINATED_V1, { event });
}

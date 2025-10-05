import type { TelemetryBus } from '../engine/Engine.js';
import type { WorkforceKpiSnapshot, WorkforceWarning } from '../domain/world.js';
import {
  TELEMETRY_WORKFORCE_KPI_V1,
  TELEMETRY_WORKFORCE_WARNING_V1
} from './topics.js';

function emitEvent(
  bus: TelemetryBus | undefined,
  topic: string,
  payload: Record<string, unknown>
): void {
  bus?.emit(topic, payload);
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

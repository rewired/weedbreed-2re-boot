import type { TelemetryBus } from '../engine/Engine.js';
import type {
  PestDiseaseRiskWarning,
  PestDiseaseTaskEvent,
} from '../health/pestDiseaseSystem.js';
import {
  TELEMETRY_HEALTH_PEST_DISEASE_RISK_V1,
  TELEMETRY_HEALTH_PEST_DISEASE_TASK_V1,
} from './topics.js';

function emitEvent(
  bus: TelemetryBus | undefined,
  topic: string,
  payload: Record<string, unknown>,
): void {
  bus?.emit(topic, payload);
}

export function emitPestDiseaseRiskWarnings(
  bus: TelemetryBus | undefined,
  warnings: readonly PestDiseaseRiskWarning[],
): void {
  if (!bus || warnings.length === 0) {
    return;
  }

  emitEvent(bus, TELEMETRY_HEALTH_PEST_DISEASE_RISK_V1, { warnings });
}

export function emitPestDiseaseTaskEvents(
  bus: TelemetryBus | undefined,
  events: readonly PestDiseaseTaskEvent[],
): void {
  if (!bus || events.length === 0) {
    return;
  }

  emitEvent(bus, TELEMETRY_HEALTH_PEST_DISEASE_TASK_V1, { events });
}

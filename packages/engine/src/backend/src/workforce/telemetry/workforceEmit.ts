import type { EngineRunContext } from '../../engine/Engine.ts';
import {
  emitWorkforceKpiSnapshot,
  emitWorkforcePayrollSnapshot,
  emitWorkforceRaiseEvent,
  emitWorkforceTermination,
  emitWorkforceWarnings,
  type WorkforceRaiseTelemetryEvent,
  type WorkforceTerminationTelemetryEvent,
} from '../../telemetry/workforce.ts';
import { emitHiringEmployeeOnboarded, emitHiringMarketScanCompleted } from '../../telemetry/hiring.ts';
import { cloneTelemetryPayload } from '../../telemetry/payload.ts';
import type {
  WorkforceKpiSnapshot,
  WorkforcePayrollState,
  WorkforceWarning,
} from '../../domain/world.ts';
import type { MarketHireTelemetry, MarketScanTelemetry } from '../market/candidates.ts';

export interface DeviceTelemetryEvent {
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

export interface WorkforceTelemetryBatch {
  readonly snapshot?: WorkforceKpiSnapshot;
  readonly payroll?: WorkforcePayrollState;
  readonly warnings?: readonly WorkforceWarning[];
  readonly raises?: readonly WorkforceRaiseTelemetryEvent[];
  readonly terminations?: readonly WorkforceTerminationTelemetryEvent[];
  readonly marketScans?: readonly MarketScanTelemetry[];
  readonly hires?: readonly MarketHireTelemetry[];
  readonly deviceEvents?: readonly DeviceTelemetryEvent[];
}

function emitDeviceTelemetry(
  telemetry: EngineRunContext['telemetry'],
  event: DeviceTelemetryEvent,
): void {
  if (!telemetry) {
    return;
  }

  const { topic, payload } = event;

  if (typeof topic !== 'string' || topic.length === 0) {
    return;
  }

  const sanitizedPayload = cloneTelemetryPayload(payload);

  telemetry.emit(topic, sanitizedPayload);
}

export function emitWorkforceTelemetry(
  telemetry: EngineRunContext['telemetry'],
  batch: WorkforceTelemetryBatch,
): void {
  if (!telemetry) {
    return;
  }

  if (batch.snapshot) {
    emitWorkforceKpiSnapshot(telemetry, batch.snapshot);
  }

  if (batch.payroll) {
    emitWorkforcePayrollSnapshot(telemetry, batch.payroll);
  }

  if (batch.warnings && batch.warnings.length > 0) {
    emitWorkforceWarnings(telemetry, batch.warnings);
  }

  if (batch.marketScans) {
    for (const scan of batch.marketScans) {
      emitHiringMarketScanCompleted(telemetry, scan);
    }
  }

  if (batch.hires) {
    for (const hire of batch.hires) {
      emitHiringEmployeeOnboarded(telemetry, hire);
    }
  }

  if (batch.raises) {
    for (const raise of batch.raises) {
      emitWorkforceRaiseEvent(telemetry, raise);
    }
  }

  if (batch.terminations) {
    for (const termination of batch.terminations) {
      emitWorkforceTermination(telemetry, termination);
    }
  }

  if (batch.deviceEvents) {
    for (const event of batch.deviceEvents) {
      emitDeviceTelemetry(telemetry, event);
    }
  }
}

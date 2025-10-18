/**
 * Event payload emitted to telemetry subscribers.
 */
export interface TelemetryEvent {
  /**
   * Topic identifier following the `telemetry.<domain>.<event>.v1` convention.
   */
  readonly topic: string;
  /**
   * Arbitrary event payload derived from committed engine state.
   */
  readonly payload: unknown;
}

export const TELEMETRY_TICK_COMPLETED_TOPIC = 'telemetry.tick.completed.v1' as const;
export const TELEMETRY_ZONE_SNAPSHOT_TOPIC = 'telemetry.zone.snapshot.v1' as const;
export const TELEMETRY_WORKFORCE_KPI_TOPIC = 'telemetry.workforce.kpi.v1' as const;

export type TelemetryTopic =
  | typeof TELEMETRY_TICK_COMPLETED_TOPIC
  | typeof TELEMETRY_ZONE_SNAPSHOT_TOPIC
  | typeof TELEMETRY_WORKFORCE_KPI_TOPIC;

export interface TelemetryNestedFieldSpec {
  readonly key: string;
  readonly kind: 'object' | 'array';
  readonly required: readonly string[];
  readonly optional?: readonly string[];
  readonly bounded01?: readonly string[];
  readonly enumValues?: Record<string, readonly string[]>;
}

export interface TelemetryTopicSchema {
  readonly topic: TelemetryTopic;
  readonly required: readonly string[];
  readonly optional?: readonly string[];
  readonly bounded01?: readonly string[];
  readonly nested?: readonly TelemetryNestedFieldSpec[];
}

export const TELEMETRY_TOPIC_SCHEMAS: readonly TelemetryTopicSchema[] = [
  {
    topic: TELEMETRY_TICK_COMPLETED_TOPIC,
    required: ['simTimeHours'],
    optional: ['targetTicksPerHour', 'actualTicksPerHour', 'operatingCostPerHour', 'labourCostPerHour', 'utilitiesCostPerHour', 'energyKwhPerDay', 'energyCostPerHour', 'waterCubicMetersPerDay', 'waterCostPerHour']
  },
  {
    topic: TELEMETRY_ZONE_SNAPSHOT_TOPIC,
    required: ['zoneId', 'simTime', 'ppfd', 'dli_incremental', 'temp_c', 'relativeHumidity01', 'co2_ppm', 'ach'],
    bounded01: ['relativeHumidity01'],
    nested: [
      {
        key: 'warnings',
        kind: 'array',
        required: ['code', 'message', 'severity'],
        enumValues: { severity: ['info', 'warning', 'critical'] }
      }
    ]
  },
  {
    topic: TELEMETRY_WORKFORCE_KPI_TOPIC,
    required: ['snapshot'],
    nested: [
      {
        key: 'snapshot',
        kind: 'object',
        required: ['simTimeHours', 'tasksCompleted', 'queueDepth', 'laborHoursCommitted', 'overtimeHoursCommitted', 'overtimeMinutes', 'p95WaitTimeHours', 'maintenanceBacklog', 'utilization01', 'averageMorale01', 'averageFatigue01'],
        bounded01: ['utilization01', 'averageMorale01', 'averageFatigue01']
      }
    ]
  }
];

/**
 * Envelope describing an intent emitted by clients.
 */
export interface TransportIntentEnvelope {
  /**
   * Declarative intent identifier (`domain.action.scope`).
   */
  readonly type: string;
  /**
   * Additional fields captured alongside the intent type.
   */
  readonly [key: string]: unknown;
}

/**
 * Namespace event identifiers used by the Socket.IO adapter.
 */
export const TELEMETRY_EVENT = 'telemetry:event' as const;
export const TELEMETRY_ERROR_EVENT = 'telemetry:error' as const;
export const INTENT_EVENT = 'intent:submit' as const;
export const INTENT_ERROR_EVENT = 'intent:error' as const;

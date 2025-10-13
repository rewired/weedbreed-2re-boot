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

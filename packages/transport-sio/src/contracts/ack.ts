/**
 * Deterministic error codes surfaced by transport acknowledgements.
 *
 * Codes align with SEC §1 invariants (read-only telemetry) and TDD §11
 * intent routing requirements.
 */
export const SOCKET_ERROR_CODES = Object.freeze({
  TELEMETRY_WRITE_REJECTED: 'WB_TEL_READONLY',
  INTENT_INVALID: 'WB_INTENT_INVALID',
  INTENT_CHANNEL_INVALID: 'WB_INTENT_CHANNEL_INVALID',
  INTENT_HANDLER_ERROR: 'WB_INTENT_HANDLER_ERROR'
} as const);

export type TransportAckErrorCode =
  (typeof SOCKET_ERROR_CODES)[keyof typeof SOCKET_ERROR_CODES];

const SOCKET_ERROR_CODE_VALUES = new Set<TransportAckErrorCode>(
  Object.values(SOCKET_ERROR_CODES) as TransportAckErrorCode[]
);

/**
 * Structured error payload returned when an acknowledgement fails.
 */
export interface TransportAckError {
  /** Deterministic error code described in {@link SOCKET_ERROR_CODES}. */
  readonly code: TransportAckErrorCode;
  /** Human readable description referencing SEC/TDD guidance. */
  readonly message: string;
}

/**
 * Shape returned to clients when acknowledging intent submissions.
 */
export interface TransportAck {
  /** Indicates whether the submission succeeded. */
  readonly ok: boolean;
  /** Optional error details when {@link TransportAck.ok} is false. */
  readonly error?: TransportAckError;
}

function isTransportAckError(value: unknown): value is TransportAckError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const { code, message } = record;

  if (typeof code !== 'string' || typeof message !== 'string' || message.length === 0) {
    return false;
  }

  return SOCKET_ERROR_CODE_VALUES.has(code);
}

/**
 * Runtime guard validating transport acknowledgements received over the wire.
 *
 * @throws {TypeError} when the payload violates the acknowledgement contract.
 */
export function assertTransportAck(payload: unknown): asserts payload is TransportAck {
  if (typeof payload !== 'object' || payload === null) {
    throw new TypeError('Transport acknowledgement must be an object.');
  }

  const record = payload as Record<string, unknown>;
  const ok = record.ok;

  if (typeof ok !== 'boolean') {
    throw new TypeError('Transport acknowledgement requires a boolean ok flag.');
  }

  const error = record.error;

  if (ok) {
    if (error !== undefined) {
      throw new TypeError('Successful transport acknowledgements must not include an error.');
    }

    return;
  }

  if (!isTransportAckError(error)) {
    throw new TypeError('Failed transport acknowledgements must include a valid error payload.');
  }
}

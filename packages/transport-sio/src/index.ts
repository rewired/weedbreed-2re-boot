export {
  createSocketTransportAdapter,
  INTENT_ERROR_EVENT,
  INTENT_EVENT,
  SOCKET_ERROR_CODES,
  TELEMETRY_ERROR_EVENT,
  TELEMETRY_EVENT,
  assertTransportAck,
  type SocketTransportAdapter,
  type SocketTransportAdapterOptions,
  type TelemetryEvent,
  type TransportAck,
  type TransportAckError,
  type TransportAckErrorCode,
  type TransportIntentEnvelope,
} from './adapter.ts';

/**
 * Configuration options required to initialise the Socket.IO transport adapter.
 */
export interface SocketTransportOptions {
  /**
   * Hostname where the Socket.IO server should bind.
   */
  readonly host: string;

  /**
   * TCP port for the Socket.IO server.
   */
  readonly port: number;
}

/**
 * Represents an immutable transport descriptor that can be consumed by façade bootstrappers.
 */
export interface SocketTransportDescriptor {
  /**
   * Fully qualified URL of the Socket.IO endpoint.
   */
  readonly endpointUrl: string;
}

/**
 * Creates a deterministic Socket.IO transport descriptor from the provided options.
 *
 * @param options - Socket.IO binding information.
 * @returns Transport descriptor containing the computed endpoint URL.
 */
export function createSocketTransportDescriptor(
  options: SocketTransportOptions
): SocketTransportDescriptor {
  if (!options.host) {
    throw new Error('Socket transport requires a host');
  }

  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error('Socket transport requires a positive integer port');
  }

  const portSegment = String(options.port);

  return {
    endpointUrl: `http://${options.host}:${portSegment}`
  } satisfies SocketTransportDescriptor;
}

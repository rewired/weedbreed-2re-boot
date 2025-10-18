import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace, type ServerOptions } from 'socket.io';
/* eslint-disable wb-sim/no-ts-import-js-extension */

import { SOCKET_ERROR_CODES } from './contracts/ack.js';
import type { TransportAck } from './contracts/ack.js';
import {
  INTENT_ERROR_EVENT,
  INTENT_EVENT,
  TELEMETRY_ERROR_EVENT,
  TELEMETRY_EVENT,
  type TelemetryEvent,
  type TransportIntentEnvelope
} from './contracts/events.js';

export { SOCKET_ERROR_CODES, assertTransportAck } from './contracts/ack.js';
export type { TransportAck, TransportAckError, TransportAckErrorCode } from './contracts/ack.js';
export {
  INTENT_ERROR_EVENT,
  INTENT_EVENT,
  TELEMETRY_ERROR_EVENT,
  TELEMETRY_EVENT,
  type TelemetryEvent,
  type TransportIntentEnvelope
} from './contracts/events.js';

/**
 * Options required to initialise the Socket.IO transport adapter.
 */
interface AckMetadata {
  readonly intentId: string | null;
  readonly correlationId: string | null;
}

const NULL_METADATA: AckMetadata = { intentId: null, correlationId: null };

function extractAckMetadata(payload: unknown): AckMetadata {
  if (typeof payload !== 'object' || payload === null) {
    return NULL_METADATA;
  }

  const record = payload as Record<string, unknown>;
  const intentId = typeof record.intentId === 'string' && record.intentId.length > 0 ? record.intentId : null;
  const correlationId =
    typeof record.correlationId === 'string' && record.correlationId.length > 0 ? record.correlationId : null;

  return { intentId, correlationId } satisfies AckMetadata;
}

function createIntentSuccessAck(metadata: AckMetadata): TransportAck {
  return {
    ok: true,
    intentId: metadata.intentId,
    correlationId: metadata.correlationId,
    status: 'queued'
  } satisfies TransportAck;
}

function withMetadata(ack: TransportAck, metadata: AckMetadata): TransportAck {
  return {
    ...ack,
    intentId: metadata.intentId,
    correlationId: metadata.correlationId
  } satisfies TransportAck;
}

export interface SocketTransportAdapterOptions {
  /**
   * HTTP server instance used to bind the Socket.IO server.
   */
  readonly httpServer: HttpServer;
  /**
   * Optional Socket.IO server configuration.
   */
  readonly serverOptions?: Partial<ServerOptions>;
  /**
   * Intent handler invoked when clients submit commands on the intent namespace.
   *
   * Handlers may optionally return a transport acknowledgement overlay that augments the
   * default success acknowledgement (e.g. to surface deterministic result payloads).
   */
  readonly onIntent: (
    intent: TransportIntentEnvelope
  ) => void | TransportAck | Promise<void | TransportAck>;
}

/**
 * Runtime transport adapter instance exposing telemetry and intent namespaces.
 */
export interface SocketTransportAdapter {
  /**
   * Underlying Socket.IO server instance.
   */
  readonly io: Server;
  /**
   * Namespaces exposed by the adapter.
   */
  readonly namespaces: {
    /** Read-only telemetry namespace. */
    readonly telemetry: Namespace;
    /** Intent submission namespace. */
    readonly intents: Namespace;
  };
  /**
   * Broadcasts a telemetry event to all subscribed clients.
   */
  publishTelemetry(event: TelemetryEvent): void;
  /**
   * Closes the underlying Socket.IO server.
   */
  close(): Promise<void>;
}

const INTERNAL_EVENTS = new Set(['disconnect', 'disconnecting', 'error']);

function resolveAck(args: unknown[]): ((response: TransportAck) => void) | null {
  const candidate = args.at(-1);

  if (typeof candidate === 'function') {
    return candidate as (response: TransportAck) => void;
  }

  return null;
}

function createTelemetryRejection(): TransportAck {
  return {
    ok: false,
    error: {
      code: SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED,
      message: 'Telemetry channel is read-only per SEC §1 invariant.'
    },
    ...NULL_METADATA,
    status: 'rejected'
  };
}

function createIntentChannelRejection(): TransportAck {
  return {
    ok: false,
    error: {
      code: SOCKET_ERROR_CODES.INTENT_CHANNEL_INVALID,
      message: 'Intents namespace only accepts intent submissions via intent:submit.'
    },
    ...NULL_METADATA,
    status: 'rejected'
  };
}

function createIntentValidationError(): TransportAck {
  return {
    ok: false,
    error: {
      code: SOCKET_ERROR_CODES.INTENT_INVALID,
      message: 'Intent payload must be an object with a string type.'
    },
    ...NULL_METADATA,
    status: 'rejected'
  };
}

function createIntentHandlerError(message: string, metadata: AckMetadata): TransportAck {
  return {
    ok: false,
    error: {
      code: SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR,
      message
    },
    ...metadata,
    status: 'rejected'
  };
}

function assertTelemetryEvent(event: TelemetryEvent): void {
  if (typeof event.topic !== 'string' || event.topic.length === 0) {
    throw new Error('Telemetry event requires a non-empty topic.');
  }
}

/**
 * Creates a Socket.IO transport adapter enforcing telemetry read-only semantics and
 * deterministic intent routing as mandated by SEC §11.3 and TDD §11.
 */
export function createSocketTransportAdapter(
  options: SocketTransportAdapterOptions
): SocketTransportAdapter {
  const io = new Server(options.httpServer, options.serverOptions);
  const telemetryNamespace = io.of('/telemetry');
  const intentNamespace = io.of('/intents');

  telemetryNamespace.on('connection', (socket) => {
    socket.onAny((event, ...args) => {
      if (typeof event === 'string' && INTERNAL_EVENTS.has(event)) {
        return;
      }

      const ack = resolveAck(args);
      const rejection = createTelemetryRejection();

      if (ack) {
        ack(rejection);
      }

      socket.emit(TELEMETRY_ERROR_EVENT, rejection);
    });
  });

  intentNamespace.on('connection', (socket) => {
    socket.on(INTENT_EVENT, async (payload: unknown, ack?: (response: TransportAck) => void) => {
      if (typeof ack !== 'function') {
        throw new TypeError('Intent submissions must include an acknowledgement callback.');
      }

      const metadata = extractAckMetadata(payload);

      if (typeof payload !== 'object' || payload === null || typeof (payload as Record<string, unknown>).type !== 'string') {
        ack(withMetadata(createIntentValidationError(), metadata));
        return;
      }

      try {
        const response = await options.onIntent(
          payload as TransportIntentEnvelope
        );
        const baseAck = createIntentSuccessAck(metadata);
        const enrichedAck =
          typeof response === 'object' && response !== null
            ? ({ ...baseAck, ...response } as TransportAck)
            : baseAck;
        ack(enrichedAck);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Intent handler rejected the submission.';
        ack(createIntentHandlerError(message, metadata));
      }
    });

    socket.onAny((event, ...args) => {
      if ((typeof event === 'string' && INTERNAL_EVENTS.has(event)) || event === INTENT_EVENT) {
        return;
      }

      const ack = resolveAck(args);
      const rejection = createIntentChannelRejection();

      if (ack) {
        ack(rejection);
      }

      socket.emit(INTENT_ERROR_EVENT, rejection);
    });
  });

  return {
    io,
    namespaces: {
      telemetry: telemetryNamespace,
      intents: intentNamespace
    },
    publishTelemetry(event) {
      assertTelemetryEvent(event);
      telemetryNamespace.emit(TELEMETRY_EVENT, event);
    },
    async close() {
      await io.close();
    }
  } satisfies SocketTransportAdapter;
}

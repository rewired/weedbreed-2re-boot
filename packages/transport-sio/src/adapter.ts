import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace, type ServerOptions } from 'socket.io';
import { SOCKET_ERROR_CODES } from './contracts/ack.ts';
import type { TransportAck } from './contracts/ack.ts';

export { SOCKET_ERROR_CODES, assertTransportAck } from './contracts/ack.ts';
export type { TransportAck, TransportAckError, TransportAckErrorCode } from './contracts/ack.ts';

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

/**
 * Options required to initialise the Socket.IO transport adapter.
 */
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
   */
  readonly onIntent: (intent: TransportIntentEnvelope) => void | Promise<void>;
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
    }
  };
}

function createIntentChannelRejection(): TransportAck {
  return {
    ok: false,
    error: {
      code: SOCKET_ERROR_CODES.INTENT_CHANNEL_INVALID,
      message: 'Intents namespace only accepts intent submissions via intent:submit.'
    }
  };
}

function createIntentValidationError(): TransportAck {
  return {
    ok: false,
    error: {
      code: SOCKET_ERROR_CODES.INTENT_INVALID,
      message: 'Intent payload must be an object with a string type.'
    }
  };
}

function createIntentHandlerError(message: string): TransportAck {
  return {
    ok: false,
    error: {
      code: SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR,
      message
    }
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

      if (typeof payload !== 'object' || payload === null || typeof (payload as Record<string, unknown>).type !== 'string') {
        ack(createIntentValidationError());
        return;
      }

      try {
        await options.onIntent(payload as TransportIntentEnvelope);
        ack({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Intent handler rejected the submission.';
        ack(createIntentHandlerError(message));
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

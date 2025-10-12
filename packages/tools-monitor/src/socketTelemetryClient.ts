import { EventEmitter } from 'node:events';
import { TELEMETRY_EVENT, TELEMETRY_ERROR_EVENT } from '@wb/transport-sio';
import { io, type Socket } from 'socket.io-client';
import type { TelemetryClient, TelemetryClientEventMap, TelemetryMessage } from './runtime.ts';

export interface SocketTelemetryClientOptions {
  readonly transports?: ('websocket' | 'polling')[];
}

export function createSocketTelemetryClient(
  url: string,
  options: SocketTelemetryClientOptions = {}
): TelemetryClient {
  const emitter = new EventEmitter<TelemetryClientEventMap>();
  const socket: Socket = io(url, {
    transports: options.transports ?? ['websocket'],
    autoConnect: false,
    reconnection: true,
  });

  const normaliseError = (error: unknown): Error =>
    error instanceof Error ? error : new Error(String(error));

  const forwardTelemetry = (event: unknown) => {
    if (typeof event !== 'object' || event === null) {
      emitter.emit('error', normaliseError('Malformed telemetry payload.'));
      return;
    }

    const record = event as Record<string, unknown>;
    const topic = record.topic;

    if (typeof topic !== 'string' || topic.length === 0) {
      emitter.emit('error', normaliseError('Telemetry event missing topic.'));
      return;
    }

    const message: TelemetryMessage = { topic, payload: record.payload };
    emitter.emit('event', message);
  };

  socket.on('connect', () => {
    emitter.emit('connect');
  });
  socket.on('disconnect', () => {
    emitter.emit('disconnect');
  });
  socket.on('connect_error', (error: unknown) => {
    emitter.emit('error', normaliseError(error));
  });
  socket.on('error', (error: unknown) => {
    emitter.emit('error', normaliseError(error));
  });
  socket.on(TELEMETRY_EVENT, forwardTelemetry);
  socket.on(TELEMETRY_ERROR_EVENT, (payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) {
      emitter.emit('error', normaliseError('Telemetry acknowledgement must be an object.'));
      return;
    }

    const record = payload as Record<string, unknown>;
    const ok = record.ok;

    if (typeof ok !== 'boolean' || ok) {
      emitter.emit('error', normaliseError('Telemetry acknowledgement missing failure flag.'));
      return;
    }

    const errorPayload = record.error;
    const message =
      typeof errorPayload === 'object' &&
      errorPayload !== null &&
      typeof (errorPayload as Record<string, unknown>).message === 'string'
        ? ((errorPayload as Record<string, unknown>).message as string)
        : 'Telemetry channel rejected a write attempt.';

    emitter.emit('error', new Error(message));
  });

  return {
    connect() {
      socket.connect();
    },
    async disconnect() {
      if (!socket.connected) {
        socket.disconnect();
        return;
      }

      await new Promise<void>((resolve) => {
        socket.once('disconnect', () => {
          resolve();
        });
        socket.disconnect();
      });
    },
    on(event, handler) {
      emitter.on(event, handler);
    },
    off(event, handler) {
      emitter.off(event, handler);
    },
  } satisfies TelemetryClient;
}

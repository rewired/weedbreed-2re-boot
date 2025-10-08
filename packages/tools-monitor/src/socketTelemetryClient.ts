import { EventEmitter } from 'node:events';
import {
  TELEMETRY_EVENT,
  TELEMETRY_ERROR_EVENT,
  type TelemetryEvent,
  type TransportAck,
} from '@wb/transport-sio';
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

  const forwardTelemetry = (event: TelemetryEvent) => {
    const message: TelemetryMessage = { topic: event.topic, payload: event.payload };
    emitter.emit('event', message);
  };

  socket.on('connect', () => {
    emitter.emit('connect');
  });
  socket.on('disconnect', () => {
    emitter.emit('disconnect');
  });
  socket.on('connect_error', (error: unknown) => {
    emitter.emit('error', error);
  });
  socket.on('error', (error: unknown) => {
    emitter.emit('error', error);
  });
  socket.on(TELEMETRY_EVENT, forwardTelemetry);
  socket.on(TELEMETRY_ERROR_EVENT, (ack: TransportAck) => {
    const message = ack.error?.message ?? 'Telemetry channel rejected a write attempt.';
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

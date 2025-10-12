import { vi } from "vitest";
import type { Socket as ClientSocket } from "socket.io-client";

type SocketHandler = (...args: unknown[]) => void;

type HandlerRegistry = Map<string, Set<SocketHandler>>;

export interface SocketMock
  extends Pick<ClientSocket, "on" | "once" | "connect" | "disconnect"> {
  connected: boolean;
  emit(event: string, ...args: unknown[]): void;
}

function addHandler(registry: HandlerRegistry, event: string, handler: SocketHandler): void {
  const existing = registry.get(event);
  if (existing) {
    existing.add(handler);
    return;
  }
  registry.set(event, new Set([handler]));
}

export function createSocketMock(): SocketMock {
  const onHandlers: HandlerRegistry = new Map();
  const onceHandlers: HandlerRegistry = new Map();

  const emit = (event: string, ...args: unknown[]): void => {
    if (event === "connect") {
      socket.connected = true;
    }
    if (event === "disconnect") {
      socket.connected = false;
    }

    const onceSet = onceHandlers.get(event);
    if (onceSet) {
      onceHandlers.delete(event);
      onceSet.forEach((handler) => {
        handler(...args);
      });
    }

    const onSet = onHandlers.get(event);
    if (onSet) {
      onSet.forEach((handler) => {
        handler(...args);
      });
    }
  };

  const socket: SocketMock = {
    connected: false,
    on: vi.fn((event: string, handler: SocketHandler) => {
      addHandler(onHandlers, event, handler);
      return socket;
    }),
    once: vi.fn((event: string, handler: SocketHandler) => {
      addHandler(onceHandlers, event, handler);
      return socket;
    }),
    connect: vi.fn(() => {
      socket.connected = true;
      return socket;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      emit("disconnect", "io client disconnect");
      return socket;
    }),
    emit
  };

  return socket;
}

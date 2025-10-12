import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { INTENT_EVENT, SOCKET_ERROR_CODES, type TransportAck } from "@wb/transport-sio";

import { createIntentClient, type IntentSubmissionHandlers } from "@ui/transport/intentClient";

const BASE_URL = "http://localhost:4000/";

interface MockSocket {
  emit: MockInstance<[string, unknown, (ack: unknown) => void], MockSocket>;
  connect: MockInstance<[], MockSocket>;
  disconnect: MockInstance<[], MockSocket>;
  connected: boolean;
  lastEvent?: string;
  lastPayload?: unknown;
  lastAck?: (ack: unknown) => void;
  triggerAck(response: unknown): void;
}

function createSocketStub(initiallyConnected = true): MockSocket {
  const socket: MockSocket = {
    emit: vi.fn((event: string, payload: unknown, ack: (ack: unknown) => void) => {
      socket.lastEvent = event;
      socket.lastPayload = payload;
      socket.lastAck = typeof ack === "function" ? ack : undefined;
      return socket;
    }),
    connect: vi.fn(() => {
      socket.connected = true;
      return socket;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      return socket;
    }),
    connected: initiallyConnected,
    triggerAck(response: unknown) {
      socket.lastAck?.(response);
    }
  };

  return socket;
}

describe("intent client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalises the base URL and opens the intents namespace", () => {
    const socket = createSocketStub();
    const createSocket = vi.fn(() => socket);

    createIntentClient({ baseUrl: BASE_URL }, { createSocket });

    expect(createSocket).toHaveBeenCalledWith("http://localhost:4000/intents", {
      transports: undefined
    });
  });

  it("rejects submissions that omit acknowledgement handlers", async () => {
    const socket = createSocketStub();
    const client = createIntentClient({ baseUrl: BASE_URL }, { createSocket: () => socket });

    await expect(
      client.submit({ type: "workforce.assign-task" }, undefined as unknown as IntentSubmissionHandlers)
    ).rejects.toThrow("Intent submissions require an acknowledgement handler.");
  });

  it("connects the socket before submitting when disconnected", async () => {
    const socket = createSocketStub(false);
    const client = createIntentClient({ baseUrl: BASE_URL }, { createSocket: () => socket });
    const onResult = vi.fn();
    const handlers: IntentSubmissionHandlers = { onResult };

    const submission = client.submit({ type: "workforce.assign-task" }, handlers);

    expect(socket.connect).toHaveBeenCalledTimes(1);

    socket.triggerAck({ ok: true } satisfies TransportAck);
    await expect(submission).resolves.toMatchObject({ ok: true });
    expect(onResult).toHaveBeenCalled();
  });

  it("resolves acknowledgements with success payloads", async () => {
    const socket = createSocketStub();
    const onResult = vi.fn();
    const handlers: IntentSubmissionHandlers = { onResult };
    const client = createIntentClient({ baseUrl: BASE_URL }, { createSocket: () => socket });

    const submission = client.submit({ type: "workforce.assign-task" }, handlers);
    expect(socket.emit).toHaveBeenCalledWith(
      INTENT_EVENT,
      { type: "workforce.assign-task" },
      expect.any(Function)
    );

    const ack = { ok: true } satisfies TransportAck;
    socket.triggerAck(ack);

    const result = await submission;
    expect(result).toEqual({ ok: true, ack });
    expect(onResult).toHaveBeenCalledWith({ ok: true, ack });
  });

  it("maps handler errors to dictionary entries", async () => {
    const socket = createSocketStub();
    const onResult = vi.fn();
    const handlers: IntentSubmissionHandlers = { onResult };
    const client = createIntentClient({ baseUrl: BASE_URL }, { createSocket: () => socket });
    const ack: TransportAck = {
      ok: false,
      error: {
        code: SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR,
        message: "handler exploded"
      }
    };

    const submission = client.submit({ type: "workforce.assign-task" }, handlers);
    socket.triggerAck(ack);

    const result = await submission;
    if (result.ok) {
      throw new Error("expected failure acknowledgement");
    }
    expect(result.dictionary.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
    expect(result.ack).toEqual(ack);
    expect(result.dictionary.description).toContain("backend");
    expect(onResult).toHaveBeenCalledWith(result);
  });

  it("maps validation errors to dictionary entries", async () => {
    const socket = createSocketStub();
    const onResult = vi.fn();
    const handlers: IntentSubmissionHandlers = { onResult };
    const client = createIntentClient({ baseUrl: BASE_URL }, { createSocket: () => socket });
    const ack: TransportAck = {
      ok: false,
      error: {
        code: SOCKET_ERROR_CODES.INTENT_INVALID,
        message: "type missing"
      }
    };

    const submission = client.submit({ type: "workforce.assign-task" }, handlers);
    socket.triggerAck(ack);

    const result = await submission;
    if (result.ok) {
      throw new Error("expected validation failure");
    }
    expect(result.dictionary.code).toBe(SOCKET_ERROR_CODES.INTENT_INVALID);
    expect(result.dictionary.action).toContain("Review");
    expect(onResult).toHaveBeenCalledWith(result);
  });

  it("maps telemetry misuse errors to dictionary entries", async () => {
    const socket = createSocketStub();
    const onResult = vi.fn();
    const handlers: IntentSubmissionHandlers = { onResult };
    const client = createIntentClient({ baseUrl: BASE_URL }, { createSocket: () => socket });
    const ack: TransportAck = {
      ok: false,
      error: {
        code: SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED,
        message: "telemetry only"
      }
    };

    const submission = client.submit({ type: "workforce.assign-task" }, handlers);
    socket.triggerAck(ack);

    const result = await submission;
    if (result.ok) {
      throw new Error("expected telemetry rejection");
    }
    expect(result.dictionary.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
    expect(result.dictionary.title).toContain("Telemetry");
    expect(onResult).toHaveBeenCalledWith(result);
  });

  it("rejects acknowledgements that violate the transport contract", async () => {
    const socket = createSocketStub();
    const onResult = vi.fn();
    const handlers: IntentSubmissionHandlers = { onResult };
    const client = createIntentClient({ baseUrl: BASE_URL }, { createSocket: () => socket });

    const submission = client.submit({ type: "workforce.assign-task" }, handlers);
    socket.triggerAck({ ok: "maybe" });

    await expect(submission).rejects.toThrow("Transport acknowledgement requires a boolean ok flag.");
    expect(onResult).not.toHaveBeenCalled();
  });
});

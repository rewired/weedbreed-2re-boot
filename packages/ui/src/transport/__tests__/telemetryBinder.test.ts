import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createTelemetryBinder, type TelemetryBinderEventMap } from "@ui/transport/telemetryBinder";
import {
  recordTickCompleted,
  recordZoneSnapshot,
  recordWorkforceKpi,
  appendHarvestCreated
} from "@ui/state/telemetry";

vi.mock("@ui/state/telemetry", () => ({
  recordTickCompleted: vi.fn(),
  recordZoneSnapshot: vi.fn(),
  recordWorkforceKpi: vi.fn(),
  appendHarvestCreated: vi.fn(),
  clearTelemetrySnapshots: vi.fn(),
  markTelemetryConnected: vi.fn(),
  markTelemetryConnecting: vi.fn(),
  markTelemetryDisconnected: vi.fn()
}));

type SocketHandler = (...args: unknown[]) => void;

const TELEMETRY_EVENT_NAME = "telemetry:event" as const;

const SAMPLE_SIM_TIME_HOURS = 42;
const SAMPLE_TARGET_TICKS_PER_HOUR = 30;
const SAMPLE_ACTUAL_TICKS_PER_HOUR = 29;
const SAMPLE_ZONE_SIM_TIME = 10;
const SAMPLE_TASKS_COMPLETED = 4;
const SAMPLE_JITTER_BASELINE = 0.5;
const SAMPLE_JITTER_HIGH = 0.8;
const SAMPLE_JITTER_LOW = 0.3;
const SAMPLE_RECONNECT_INITIAL_DELAY_MS = 1000;
const SAMPLE_RECONNECT_MAX_DELAY_MS = 4000;
const SAMPLE_RECONNECT_MULTIPLIER = 2;
const SAMPLE_RECONNECT_JITTER_RATIO = 0.25;
const EXPECTED_FIRST_DELAY_MS = Math.round(
  SAMPLE_RECONNECT_INITIAL_DELAY_MS *
    (1 + SAMPLE_RECONNECT_JITTER_RATIO * 2 * (SAMPLE_JITTER_HIGH - SAMPLE_JITTER_BASELINE))
);
const EXPECTED_SECOND_DELAY_MS = Math.round(
  Math.min(
    SAMPLE_RECONNECT_MAX_DELAY_MS,
    SAMPLE_RECONNECT_INITIAL_DELAY_MS * Math.pow(SAMPLE_RECONNECT_MULTIPLIER, 2 - 1)
  ) *
    (1 + SAMPLE_RECONNECT_JITTER_RATIO * 2 * (SAMPLE_JITTER_LOW - SAMPLE_JITTER_BASELINE))
);

interface MockSocket {
  on: MockInstance<[string, SocketHandler], MockSocket>;
  once: MockInstance<[string, SocketHandler], MockSocket>;
  connect: MockInstance<[], MockSocket>;
  disconnect: MockInstance<[], MockSocket>;
  connected: boolean;
  trigger(event: string, ...args: unknown[]): void;
  triggerOnce(event: string, ...args: unknown[]): void;
  getHandler(event: string): SocketHandler | undefined;
  getOnceHandler(event: string): SocketHandler | undefined;
}

function createSocketStub(): MockSocket {
  const onHandlers = new Map<string, SocketHandler>();
  const onceHandlers = new Map<string, SocketHandler>();
  const on = vi.fn<[string, SocketHandler], MockSocket>((event: string, handler: SocketHandler) => {
    onHandlers.set(event, handler);
    return socket;
  });
  const once = vi.fn<[string, SocketHandler], MockSocket>((event: string, handler: SocketHandler) => {
    onceHandlers.set(event, handler);
    return socket;
  });
  const connect = vi.fn<[], MockSocket>(() => {
    socket.connected = true;
    return socket;
  });
  const disconnect = vi.fn<[], MockSocket>(() => {
    socket.connected = false;
    const onceHandler = onceHandlers.get("disconnect");

    if (onceHandler) {
      onceHandlers.delete("disconnect");
      onceHandler("io client disconnect");
    }

    const handler = onHandlers.get("disconnect");

    if (handler) {
      handler("io client disconnect");
    }

    return socket;
  });

  const socket: MockSocket = {
    on,
    once,
    connect,
    disconnect,
    connected: false,
    trigger(event: string, ...args: unknown[]) {
      const handler = onHandlers.get(event);
      if (handler) {
        handler(...args);
      }
    },
    triggerOnce(event: string, ...args: unknown[]) {
      const handler = onceHandlers.get(event);

      if (handler) {
        onceHandlers.delete(event);
        handler(...args);
      }
    },
    getHandler(event: string) {
      return onHandlers.get(event);
    },
    getOnceHandler(event: string) {
      return onceHandlers.get(event);
    }
  };

  return socket;
}

describe("telemetry binder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes telemetry topics to the store actions", () => {
    const socket = createSocketStub();
    const createSocket = vi.fn(() => socket);
    const logger = { warn: vi.fn() };
    const timers = {
      setTimeout: vi.fn(() => null),
      clearTimeout: vi.fn()
    } as const;
    const rng = vi.fn().mockReturnValue(SAMPLE_JITTER_BASELINE);
    const binder = createTelemetryBinder(
      { baseUrl: "http://localhost:3000" },
      {
        createSocket,
        logger,
        timers,
        rngFactory: () => rng
      }
    );

    const heartbeat = vi.fn();
    binder.on("heartbeat", heartbeat);

    const telemetryHandler = socket.getHandler(TELEMETRY_EVENT_NAME);
    if (!telemetryHandler) {
      throw new Error("telemetry handler was not registered");
    }

    const tickPayload = {
      simTimeHours: SAMPLE_SIM_TIME_HOURS,
      targetTicksPerHour: SAMPLE_TARGET_TICKS_PER_HOUR,
      actualTicksPerHour: SAMPLE_ACTUAL_TICKS_PER_HOUR
    } satisfies Partial<Parameters<typeof recordTickCompleted>[0]>;

    telemetryHandler({ topic: "telemetry.tick.completed.v1", payload: tickPayload });
    expect(recordTickCompleted).toHaveBeenCalledWith(expect.objectContaining(tickPayload));
    expect(heartbeat).toHaveBeenCalledWith({ simTimeHours: SAMPLE_SIM_TIME_HOURS });

    const zonePayload = {
      zoneId: "zone-1",
      simTime: SAMPLE_ZONE_SIM_TIME,
      warnings: []
    } satisfies Partial<Parameters<typeof recordZoneSnapshot>[0]>;
    telemetryHandler({ topic: "telemetry.zone.snapshot.v1", payload: zonePayload });
    expect(recordZoneSnapshot).toHaveBeenCalledWith(expect.objectContaining(zonePayload));

    const workforcePayload = {
      simTimeHours: SAMPLE_SIM_TIME_HOURS,
      tasksCompleted: SAMPLE_TASKS_COMPLETED
    } satisfies Partial<Parameters<typeof recordWorkforceKpi>[0]>;
    telemetryHandler({ topic: "telemetry.workforce.kpi.v1", payload: workforcePayload });
    expect(recordWorkforceKpi).toHaveBeenCalledWith(expect.objectContaining(workforcePayload));

    const harvestPayload = {
      zoneId: "zone-1",
      lotId: "lot-1"
    } satisfies Partial<Parameters<typeof appendHarvestCreated>[0]>;
    telemetryHandler({ topic: "telemetry.harvest.created.v1", payload: harvestPayload });
    expect(appendHarvestCreated).toHaveBeenCalledWith(expect.objectContaining(harvestPayload));

    telemetryHandler({ topic: "telemetry.unknown.topic", payload: {} });
    expect(logger.warn).toHaveBeenCalledWith("Telemetry topic ignored", { topic: "telemetry.unknown.topic" });
  });

  it("computes exponential backoff with deterministic jitter", () => {
    const socket = createSocketStub();
    const createSocket = vi.fn(() => socket);
    const logger = { warn: vi.fn() };
    const setTimeout = vi.fn(() => null);
    const clearTimeout = vi.fn();
    const rng = vi.fn()
      .mockReturnValueOnce(SAMPLE_JITTER_HIGH)
      .mockReturnValueOnce(SAMPLE_JITTER_LOW);
    const binder = createTelemetryBinder(
      {
        baseUrl: "http://localhost:4000",
        reconnect: {
          initialDelayMs: SAMPLE_RECONNECT_INITIAL_DELAY_MS,
          maxDelayMs: SAMPLE_RECONNECT_MAX_DELAY_MS,
          multiplier: SAMPLE_RECONNECT_MULTIPLIER,
          jitterRatio: SAMPLE_RECONNECT_JITTER_RATIO
        }
      },
      {
        createSocket,
        logger,
        timers: { setTimeout, clearTimeout },
        rngFactory: () => rng
      }
    );

    const reconnecting = vi.fn();
    binder.on("reconnecting", reconnecting);

    const disconnectHandler = socket.getHandler("disconnect");
    if (!disconnectHandler) {
      throw new Error("disconnect handler was not registered");
    }

    disconnectHandler("transport close");
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout.mock.calls[0][1]).toBe(EXPECTED_FIRST_DELAY_MS);
    expect(reconnecting).toHaveBeenNthCalledWith(1, {
      attempt: 1,
      delayMs: EXPECTED_FIRST_DELAY_MS
    });

    disconnectHandler("transport close");
    expect(setTimeout).toHaveBeenCalledTimes(2);
    expect(setTimeout.mock.calls[1][1]).toBe(EXPECTED_SECOND_DELAY_MS);
    expect(reconnecting).toHaveBeenNthCalledWith(2, {
      attempt: 2,
      delayMs: EXPECTED_SECOND_DELAY_MS
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "Telemetry socket scheduling reconnect",
      expect.objectContaining({ attempt: 2, delayMs: EXPECTED_SECOND_DELAY_MS })
    );
  });

  it("cleans up without scheduling reconnect when explicitly disconnected", async () => {
    const socket = createSocketStub();
    socket.connected = true;

    const createSocket = vi.fn(() => socket);
    const logger = { warn: vi.fn() };
    const setTimeout = vi.fn(() => null);
    const clearTimeout = vi.fn();
    const rng = vi.fn().mockReturnValue(SAMPLE_JITTER_BASELINE);

    const binder = createTelemetryBinder(
      { baseUrl: "http://localhost:3000" },
      {
        createSocket,
        logger,
        timers: { setTimeout, clearTimeout },
        rngFactory: () => rng
      }
    );

    const disconnected = vi.fn<(payload: TelemetryBinderEventMap["disconnected"]) => void>();
    binder.on("disconnected", disconnected);

    await binder.disconnect();

    expect(socket.disconnect).toHaveBeenCalled();
    expect(setTimeout).not.toHaveBeenCalled();
    expect(disconnected).toHaveBeenCalledWith({ reason: "io client disconnect" });
  });
});

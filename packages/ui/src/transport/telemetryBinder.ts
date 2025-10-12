import {
  recordTickCompleted,
  recordZoneSnapshot,
  recordWorkforceKpi,
  appendHarvestCreated,
  type TelemetryTickCompletedPayload,
  type TelemetryZoneSnapshotPayload,
  type WorkforceKpiTelemetrySnapshot,
  type TelemetryHarvestCreatedPayload
} from "@ui/state/telemetry";
import { createRng, type RandomNumberGenerator } from "@ui/lib/createRng";
import {
  io,
  type ManagerOptions,
  type Socket as ClientSocket,
  type SocketOptions
} from "socket.io-client";

const TELEMETRY_EVENT = "telemetry:event" as const;
const TELEMETRY_NAMESPACE = "/telemetry" as const;

const TOPIC_TICK_COMPLETED = "telemetry.tick.completed.v1" as const;
const TOPIC_ZONE_SNAPSHOT = "telemetry.zone.snapshot.v1" as const;
const TOPIC_WORKFORCE_KPI = "telemetry.workforce.kpi.v1" as const;
const TOPIC_HARVEST_CREATED = "telemetry.harvest.created.v1" as const;

/* eslint-disable @typescript-eslint/no-magic-numbers */
const DEFAULT_RECONNECT_INITIAL_DELAY_MS = 500 as const;
const DEFAULT_RECONNECT_MULTIPLIER = 2 as const;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 8000 as const;
const DEFAULT_RECONNECT_JITTER_RATIO = 0.2 as const;
const JITTER_NEUTRAL_POINT = 0.5 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

const DEFAULT_RECONNECT_POLICY = {
  initialDelayMs: DEFAULT_RECONNECT_INITIAL_DELAY_MS,
  multiplier: DEFAULT_RECONNECT_MULTIPLIER,
  maxDelayMs: DEFAULT_RECONNECT_MAX_DELAY_MS,
  jitterRatio: DEFAULT_RECONNECT_JITTER_RATIO
} as const satisfies ReconnectPolicy;

const DEFAULT_BINDER_SEED = "telemetry-binder" as const;

export interface TelemetryBinderEventMap {
  connected: undefined;
  disconnected: { readonly reason?: string };
  reconnecting: { readonly attempt: number; readonly delayMs: number };
  heartbeat: { readonly simTimeHours: number };
}

export interface TelemetryBinder {
  connect(): void;
  disconnect(): Promise<void>;
  on<E extends keyof TelemetryBinderEventMap>(
    event: E,
    listener: (payload: TelemetryBinderEventMap[E]) => void
  ): void;
  off<E extends keyof TelemetryBinderEventMap>(
    event: E,
    listener: (payload: TelemetryBinderEventMap[E]) => void
  ): void;
}

export interface TelemetryBinderOptions {
  readonly baseUrl: string;
  readonly transports?: readonly ("websocket" | "polling")[];
  readonly seed?: string;
  readonly reconnect?: Partial<ReconnectPolicy>;
}

interface ReconnectPolicy {
  readonly initialDelayMs: number;
  readonly multiplier: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;
}

interface Logger {
  warn(message: string, metadata?: Record<string, unknown>): void;
  error?(message: string, metadata?: Record<string, unknown>): void;
}

interface TimerApi {
  setTimeout(handler: () => void, timeout: number): TimeoutHandle;
  clearTimeout(handle: TimeoutHandle | null): void;
}

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout> | null;

type SocketFactory = (
  uri: string,
  options: Partial<ManagerOptions & SocketOptions>
) => ClientSocket;

interface TelemetryBinderDependencies {
  readonly createSocket: SocketFactory;
  readonly logger: Logger;
  readonly timers: TimerApi;
  readonly rngFactory: (seed: string, streamId: string) => RandomNumberGenerator;
}

const defaultDependencies: TelemetryBinderDependencies = {
  createSocket: io,
  logger: console,
  timers: {
    setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout),
    clearTimeout: (handle) => {
      if (handle !== null) {
        globalThis.clearTimeout(handle);
      }
    }
  },
  rngFactory: createRng
};

type TopicHandler = (payload: unknown) => void;

interface NormalisedEvent {
  readonly topic: string;
  readonly payload: unknown;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function createEmitter<EventMap extends Record<string, unknown>>() {
  const listeners = new Map<keyof EventMap, Set<(payload: EventMap[keyof EventMap]) => void>>();

  return {
    on<E extends keyof EventMap>(event: E, listener: (payload: EventMap[E]) => void) {
      const bucket = listeners.get(event) ?? new Set();
      bucket.add(listener as (payload: EventMap[keyof EventMap]) => void);
      listeners.set(event, bucket);
    },
    off<E extends keyof EventMap>(event: E, listener: (payload: EventMap[E]) => void) {
      const bucket = listeners.get(event);

      if (!bucket) {
        return;
      }

      bucket.delete(listener as (payload: EventMap[keyof EventMap]) => void);

      if (bucket.size === 0) {
        listeners.delete(event);
      }
    },
    emit<E extends keyof EventMap>(event: E, payload: EventMap[E]) {
      const bucket = listeners.get(event);

      if (!bucket) {
        return;
      }

      bucket.forEach((handler) => {
        (handler as (arg: EventMap[E]) => void)(payload);
      });
    }
  };
}

function normaliseEvent(candidate: unknown): NormalisedEvent | null {
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const topic = record.topic;

  if (typeof topic !== "string" || topic.length === 0) {
    return null;
  }

  return {
    topic,
    payload: record.payload
  } satisfies NormalisedEvent;
}

function ensureRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normaliseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "unknown error";
  }
}

function resolveReconnectPolicy(options?: Partial<ReconnectPolicy>): ReconnectPolicy {
  const candidate = options ?? {};
  const initialDelayMs = Math.max(
    1,
    Math.floor(candidate.initialDelayMs ?? DEFAULT_RECONNECT_POLICY.initialDelayMs)
  );
  const multiplier = Math.max(candidate.multiplier ?? DEFAULT_RECONNECT_POLICY.multiplier, 1);
  const maxDelayMs = Math.max(candidate.maxDelayMs ?? DEFAULT_RECONNECT_POLICY.maxDelayMs, initialDelayMs);
  const jitterRatio = Math.max(0, candidate.jitterRatio ?? DEFAULT_RECONNECT_POLICY.jitterRatio);

  return {
    initialDelayMs,
    multiplier,
    maxDelayMs,
    jitterRatio
  } satisfies ReconnectPolicy;
}

export function createTelemetryBinder(
  options: TelemetryBinderOptions,
  dependencies: Partial<TelemetryBinderDependencies> = {}
): TelemetryBinder {
  if (!options.baseUrl) {
    throw new Error("Telemetry binder requires a baseUrl");
  }

  const createSocket = dependencies.createSocket ?? defaultDependencies.createSocket;
  const logger = dependencies.logger ?? defaultDependencies.logger;
  const timers: TimerApi = {
    setTimeout: (handler, timeout) =>
      (dependencies.timers?.setTimeout ?? defaultDependencies.timers.setTimeout)(handler, timeout),
    clearTimeout: (handle) => {
      (dependencies.timers?.clearTimeout ?? defaultDependencies.timers.clearTimeout)(handle);
    }
  };
  const rngFactory = dependencies.rngFactory ?? defaultDependencies.rngFactory;

  const reconnectPolicy = resolveReconnectPolicy(options.reconnect);
  const baseSeed = options.seed ?? DEFAULT_BINDER_SEED;
  const trimmedBase = trimTrailingSlash(options.baseUrl);
  const namespaceUrl = `${trimmedBase}${TELEMETRY_NAMESPACE}`;

  const jitterRng = rngFactory(baseSeed, `telemetry-binder:${namespaceUrl}`);
  const emitter = createEmitter<TelemetryBinderEventMap>();

  const socket = createSocket(namespaceUrl, {
    transports: options.transports ?? ["websocket"],
    autoConnect: false,
    reconnection: false
  });

  let reconnectTimer: TimeoutHandle = null;
  let reconnectAttempt = 0;
  let closing = false;

  const topicHandlers: Partial<Record<string, TopicHandler>> = {
    [TOPIC_TICK_COMPLETED]: (payload) => {
      const record = ensureRecord(payload);

      if (!record) {
        logger.warn("Discarded malformed tick telemetry payload", {
          topic: TOPIC_TICK_COMPLETED
        });
        return;
      }

      const typed = record as TelemetryTickCompletedPayload;
      recordTickCompleted(typed);

      if (typeof typed.simTimeHours === "number" && Number.isFinite(typed.simTimeHours)) {
        emitter.emit("heartbeat", { simTimeHours: typed.simTimeHours });
      }
    },
    [TOPIC_ZONE_SNAPSHOT]: (payload) => {
      const record = ensureRecord(payload);

      if (!record) {
        logger.warn("Discarded malformed zone snapshot telemetry payload", {
          topic: TOPIC_ZONE_SNAPSHOT
        });
        return;
      }

      recordZoneSnapshot(record as TelemetryZoneSnapshotPayload);
    },
    [TOPIC_WORKFORCE_KPI]: (payload) => {
      const record = ensureRecord(payload);

      if (!record) {
        logger.warn("Discarded malformed workforce KPI telemetry payload", {
          topic: TOPIC_WORKFORCE_KPI
        });
        return;
      }

      recordWorkforceKpi(record as WorkforceKpiTelemetrySnapshot);
    },
    [TOPIC_HARVEST_CREATED]: (payload) => {
      const record = ensureRecord(payload);

      if (!record) {
        logger.warn("Discarded malformed harvest telemetry payload", {
          topic: TOPIC_HARVEST_CREATED
        });
        return;
      }

      appendHarvestCreated(record as TelemetryHarvestCreatedPayload);
    }
  } satisfies Record<string, TopicHandler>;

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      timers.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect(reason?: string): void {
    if (closing) {
      return;
    }

    reconnectAttempt += 1;

    const baseDelay = Math.min(
      reconnectPolicy.maxDelayMs,
      reconnectPolicy.initialDelayMs * Math.pow(reconnectPolicy.multiplier, reconnectAttempt - 1)
    );

    const jitterValue = jitterRng();
    const spread = reconnectPolicy.jitterRatio * 2 * (jitterValue - JITTER_NEUTRAL_POINT);
    const delayWithJitter = baseDelay * (1 + spread);
    const delayMs = Math.max(
      reconnectPolicy.initialDelayMs,
      Math.round(Math.min(reconnectPolicy.maxDelayMs, Math.max(1, delayWithJitter)))
    );

    clearReconnectTimer();

    reconnectTimer = timers.setTimeout(() => {
      socket.connect();
    }, delayMs);

    emitter.emit("reconnecting", { attempt: reconnectAttempt, delayMs });
    logger.warn("Telemetry socket scheduling reconnect", {
      attempt: reconnectAttempt,
      delayMs,
      reason
    });
  }

  function handleDisconnect(reason: unknown): void {
    const reasonString = typeof reason === "string" ? reason : undefined;
    emitter.emit("disconnected", { reason: reasonString });
    scheduleReconnect(reasonString);
  }

  socket.on("connect", () => {
    reconnectAttempt = 0;
    closing = false;
    clearReconnectTimer();
    emitter.emit("connected", undefined);
  });

  socket.on("disconnect", (reason) => {
    if (closing) {
      emitter.emit("disconnected", {
        reason: typeof reason === "string" ? reason : undefined
      });
      return;
    }

    handleDisconnect(reason);
  });

  socket.on("connect_error", (error: unknown) => {
    if (closing) {
      return;
    }

    logger.warn("Telemetry socket connect error", {
      error: normaliseErrorMessage(error)
    });
    scheduleReconnect();
  });

  socket.on(TELEMETRY_EVENT, (payload: unknown) => {
    const normalised = normaliseEvent(payload);

    if (!normalised) {
      logger.warn("Telemetry event discarded due to malformed envelope", {
        payload
      });
      return;
    }

    const handler = topicHandlers[normalised.topic];

    if (!handler) {
      logger.warn("Telemetry topic ignored", { topic: normalised.topic });
      return;
    }

    handler(normalised.payload);
  });

  return {
    connect() {
      closing = false;
      socket.connect();
    },
    async disconnect() {
      closing = true;
      reconnectAttempt = 0;
      clearReconnectTimer();

      if (socket.connected) {
        await new Promise<void>((resolve) => {
          socket.once("disconnect", () => {
            resolve();
          });
          socket.disconnect();
        });
        return;
      }

      socket.disconnect();
    },
    on(event, listener) {
      emitter.on(event, listener);
    },
    off(event, listener) {
      emitter.off(event, listener);
    }
  } satisfies TelemetryBinder;
}

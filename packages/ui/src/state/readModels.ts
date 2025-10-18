import { create } from "zustand";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import type {
  ReadModelSnapshot,
  ReadModelStatus,
  ReadModelStoreStatus
} from "@ui/state/readModels.types";

export interface ReadModelRefreshOptions {
  readonly signal?: AbortSignal;
}

export interface ReadModelClient {
  loadReadModels(options?: ReadModelRefreshOptions): Promise<ReadModelSnapshot>;
}

const DEFAULT_RETRY_DELAYS_MS = Object.freeze([1_000, 3_000, 5_000]) as readonly number[];

type ReadModelRetryScheduler = (delayMs: number, attempt: number, task: () => void) => () => void;

const defaultRetryScheduler: ReadModelRetryScheduler = (delayMs, _attempt, task) => {
  const timeoutId = globalThis.setTimeout(task, delayMs);
  return () => {
    globalThis.clearTimeout(timeoutId);
  };
};

let retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS;
let retryScheduler: ReadModelRetryScheduler = defaultRetryScheduler;
let retryDelayIndex = 0;
let cancelScheduledRetry: (() => void) | null = null;

interface ReadModelInternalState {
  readonly snapshot: ReadModelSnapshot;
  readonly status: ReadModelStatus;
  readonly lastError: string | null;
  readonly lastUpdatedSimTimeHours: number | null;
  readonly isRefreshing: boolean;
  readonly client: ReadModelClient | null;
}

function createInitialState(): ReadModelInternalState {
  return {
    snapshot: deterministicReadModelSnapshot,
    status: "ready",
    lastError: null,
    lastUpdatedSimTimeHours: deterministicReadModelSnapshot.simulation.simTimeHours,
    isRefreshing: false,
    client: null
  } satisfies ReadModelInternalState;
}

export const useReadModelStore = create<ReadModelInternalState>(() => createInitialState());

export function resetReadModelStore(): void {
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS;
  retryScheduler = defaultRetryScheduler;
  retryDelayIndex = 0;
  if (cancelScheduledRetry) {
    cancelScheduledRetry();
    cancelScheduledRetry = null;
  }
  useReadModelStore.setState(createInitialState());
}

export function getReadModelSnapshot(): ReadModelSnapshot {
  return useReadModelStore.getState().snapshot;
}

export function getReadModelStatus(): ReadModelStoreStatus {
  const state = useReadModelStore.getState();
  return {
    status: state.status,
    lastError: state.lastError,
    lastUpdatedSimTimeHours: state.lastUpdatedSimTimeHours,
    isRefreshing: state.isRefreshing
  } satisfies ReadModelStoreStatus;
}

function cancelRetry(): void {
  if (cancelScheduledRetry) {
    cancelScheduledRetry();
    cancelScheduledRetry = null;
  }
}

function resetRetryProgress(): void {
  retryDelayIndex = 0;
  cancelRetry();
}

export interface ReadModelRetryConfiguration {
  readonly delaysMs?: readonly number[];
  readonly scheduler?: ReadModelRetryScheduler;
}

export function configureReadModelRetry(configuration: ReadModelRetryConfiguration): void {
  if (configuration.delaysMs) {
    retryDelaysMs = configuration.delaysMs.length > 0 ? Array.from(configuration.delaysMs) : [];
  }

  if (configuration.scheduler) {
    retryScheduler = configuration.scheduler;
  }
}

export interface ConfigureReadModelClientOptions {
  readonly immediateRefresh?: boolean;
}

export function configureReadModelClient(
  client: ReadModelClient | null,
  options?: ConfigureReadModelClientOptions
): void {
  resetRetryProgress();

  useReadModelStore.setState((state) => ({
    ...state,
    client,
    lastError: null,
    isRefreshing: false
  }));

  if (!client) {
    useReadModelStore.setState((state) => ({
      ...state,
      status: "ready"
    }));
    return;
  }

  if (options?.immediateRefresh === false) {
    return;
  }

  void refreshReadModels().catch(() => {
    // Errors are captured via store state transitions.
  });
}

function normaliseErrorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === "string") {
    return reason;
  }

  return "Unknown read-model refresh failure.";
}

export async function refreshReadModels(
  options?: ReadModelRefreshOptions
): Promise<void> {
  cancelRetry();
  const state = useReadModelStore.getState();
  const client = state.client;

  if (!client) {
    resetRetryProgress();
    useReadModelStore.setState((current) => ({
      ...current,
      status: "ready",
      lastError: null,
      isRefreshing: false,
      lastUpdatedSimTimeHours: current.snapshot.simulation.simTimeHours
    }));
    return;
  }

  useReadModelStore.setState((current) => ({
    ...current,
    status: "loading",
    lastError: null,
    isRefreshing: true
  }));

  try {
    const snapshot = await client.loadReadModels(options);
    resetRetryProgress();
    useReadModelStore.setState((current) => ({
      ...current,
      snapshot,
      status: "ready",
      lastError: null,
      isRefreshing: false,
      lastUpdatedSimTimeHours: snapshot.simulation.simTimeHours
    }));
  } catch (error) {
    const message = normaliseErrorMessage(error);
    const delaySlot = Math.min(retryDelayIndex, Math.max(retryDelaysMs.length - 1, 0));
    const delayMs = retryDelaysMs[delaySlot];
    retryDelayIndex = retryDelaysMs.length === 0 ? 0 : Math.min(delaySlot + 1, retryDelaysMs.length - 1);

    useReadModelStore.setState((current) => ({
      ...current,
      status: "error",
      lastError: message,
      isRefreshing: false
    }));

    if (typeof delayMs === "number" && Number.isFinite(delayMs) && delayMs >= 0) {
      const attempt = delaySlot + 1;
      const scheduled = retryScheduler(delayMs, attempt, () => {
        cancelScheduledRetry = null;
        void refreshReadModels().catch(() => {
          // Subsequent failures will update the store state.
        });
      });

      cancelScheduledRetry = () => {
        scheduled();
        cancelScheduledRetry = null;
      };
    }
  }
}

export function applyReadModelSnapshot(snapshot: ReadModelSnapshot): void {
  resetRetryProgress();
  useReadModelStore.setState((current) => ({
    ...current,
    snapshot,
    status: "ready",
    lastError: null,
    isRefreshing: false,
    lastUpdatedSimTimeHours: snapshot.simulation.simTimeHours
  }));
}

export function useReadModelStoreStatus(): ReadModelStoreStatus {
  return useReadModelStore((state) => ({
    status: state.status,
    lastError: state.lastError,
    lastUpdatedSimTimeHours: state.lastUpdatedSimTimeHours,
    isRefreshing: state.isRefreshing
  }));
}


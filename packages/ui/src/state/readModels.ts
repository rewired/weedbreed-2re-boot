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

interface ReadModelInternalState {
  readonly snapshot: ReadModelSnapshot;
  readonly status: ReadModelStatus;
  readonly error: string | null;
  readonly lastUpdatedSimTimeHours: number | null;
  readonly isRefreshing: boolean;
  readonly client: ReadModelClient | null;
}

function createInitialState(): ReadModelInternalState {
  return {
    snapshot: deterministicReadModelSnapshot,
    status: "idle",
    error: null,
    lastUpdatedSimTimeHours: deterministicReadModelSnapshot.simulation.simTimeHours,
    isRefreshing: false,
    client: null
  } satisfies ReadModelInternalState;
}

export const useReadModelStore = create<ReadModelInternalState>(() => createInitialState());

export function resetReadModelStore(): void {
  useReadModelStore.setState(createInitialState());
}

export function getReadModelSnapshot(): ReadModelSnapshot {
  return useReadModelStore.getState().snapshot;
}

export function getReadModelStatus(): ReadModelStoreStatus {
  const state = useReadModelStore.getState();
  return {
    status: state.status,
    error: state.error,
    lastUpdatedSimTimeHours: state.lastUpdatedSimTimeHours,
    isRefreshing: state.isRefreshing
  } satisfies ReadModelStoreStatus;
}

export function configureReadModelClient(client: ReadModelClient | null): void {
  useReadModelStore.setState((state) => ({
    ...state,
    client
  }));
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
  const state = useReadModelStore.getState();
  const client = state.client;

  if (!client) {
    useReadModelStore.setState((current) => ({
      ...current,
      status: "ready",
      error: null,
      isRefreshing: false,
      lastUpdatedSimTimeHours: current.snapshot.simulation.simTimeHours
    }));
    return;
  }

  const previousStatus = state.status;
  useReadModelStore.setState((current) => ({
    ...current,
    status: previousStatus === "ready" ? previousStatus : "loading",
    error: null,
    isRefreshing: true
  }));

  try {
    const snapshot = await client.loadReadModels(options);
    useReadModelStore.setState((current) => ({
      ...current,
      snapshot,
      status: "ready",
      error: null,
      isRefreshing: false,
      lastUpdatedSimTimeHours: snapshot.simulation.simTimeHours
    }));
  } catch (error) {
    const message = normaliseErrorMessage(error);
    useReadModelStore.setState((current) => ({
      ...current,
      status: current.status === "ready" ? "ready" : "error",
      error: message,
      isRefreshing: false
    }));
  }
}

export function applyReadModelSnapshot(snapshot: ReadModelSnapshot): void {
  useReadModelStore.setState((current) => ({
    ...current,
    snapshot,
    status: "ready",
    error: null,
    isRefreshing: false,
    lastUpdatedSimTimeHours: snapshot.simulation.simTimeHours
  }));
}

export function useReadModelStoreStatus(): ReadModelStoreStatus {
  return useReadModelStore((state) => ({
    status: state.status,
    error: state.error,
    lastUpdatedSimTimeHours: state.lastUpdatedSimTimeHours,
    isRefreshing: state.isRefreshing
  }));
}


import { describe, beforeEach, expect, it } from "vitest";
import {
  configureReadModelClient,
  getReadModelSnapshot,
  getReadModelStatus,
  refreshReadModels,
  resetReadModelStore,
  useReadModelStore
} from "@ui/state/readModels";
import {
  deterministicReadModelSnapshot,
  createAlteredReadModelSnapshot
} from "@ui/test-utils/readModelFixtures";
import type { ReadModelSnapshot } from "@ui/state/readModels.types";

class StubReadModelClient {
  constructor(private readonly snapshot: ReadModelSnapshot) {}

  loadReadModels(): Promise<ReadModelSnapshot> {
    return Promise.resolve(this.snapshot);
  }
}

describe("readModels store", () => {
  beforeEach(() => {
    resetReadModelStore();
  });

  it("returns deterministic stub snapshot by default", () => {
    expect(getReadModelSnapshot()).toEqual(deterministicReadModelSnapshot);
    expect(getReadModelStatus()).toEqual({
      status: "idle",
      error: null,
      lastUpdatedSimTimeHours: deterministicReadModelSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });
  });

  it("marks store as ready when refresh runs without a configured client", async () => {
    await refreshReadModels();
    expect(getReadModelStatus()).toEqual({
      status: "ready",
      error: null,
      lastUpdatedSimTimeHours: deterministicReadModelSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });
    expect(getReadModelSnapshot()).toEqual(deterministicReadModelSnapshot);
  });

  it("updates snapshot when the client resolves", async () => {
    const updatedSnapshot = createAlteredReadModelSnapshot();
    configureReadModelClient(new StubReadModelClient(updatedSnapshot));

    await refreshReadModels();

    expect(getReadModelSnapshot()).toEqual(updatedSnapshot);
    expect(getReadModelStatus()).toEqual({
      status: "ready",
      error: null,
      lastUpdatedSimTimeHours: updatedSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });
  });

  it("retains the previous snapshot when the client fails", async () => {
    const errorClient = {
      loadReadModels(): Promise<ReadModelSnapshot> {
        return Promise.reject(new Error("network error"));
      }
    };
    configureReadModelClient(errorClient);

    await refreshReadModels();

    expect(getReadModelSnapshot()).toEqual(deterministicReadModelSnapshot);
    expect(getReadModelStatus()).toEqual({
      status: "error",
      error: "network error",
      lastUpdatedSimTimeHours: deterministicReadModelSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });
  });

  it("preserves ready status when a subsequent refresh fails", async () => {
    const updatedSnapshot = createAlteredReadModelSnapshot();
    configureReadModelClient(new StubReadModelClient(updatedSnapshot));
    await refreshReadModels();

    const failingClient = {
      loadReadModels(): Promise<ReadModelSnapshot> {
        return Promise.reject(new Error("timeout"));
      }
    };
    configureReadModelClient(failingClient);

    await refreshReadModels();

    expect(getReadModelSnapshot()).toEqual(updatedSnapshot);
    const state = useReadModelStore.getState();
    expect(state.status).toBe("ready");
    expect(state.error).toBe("timeout");
    expect(state.lastUpdatedSimTimeHours).toBe(updatedSnapshot.simulation.simTimeHours);
  });
});

import { describe, beforeEach, expect, it, vi } from "vitest";
import {
  configureReadModelClient,
  configureReadModelRetry,
  getReadModelSnapshot,
  getReadModelStatus,
  refreshReadModels,
  resetReadModelStore
} from "@ui/state/readModels";
import { createReadModelClient } from "@ui/transport/readModelClient";
import {
  deterministicReadModelSnapshot,
  createAlteredReadModelSnapshot
} from "@ui/test-utils/readModelFixtures";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

function createFetchResponse(payload: unknown, ok = true, status = HTTP_STATUS_OK): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(payload)
  } as Response;
}

describe("readModels store", () => {
  beforeEach(() => {
    resetReadModelStore();
  });

  it("falls back to deterministic fixtures when no transport is configured", async () => {
    expect(getReadModelSnapshot()).toEqual(deterministicReadModelSnapshot);
    expect(getReadModelStatus()).toEqual({
      status: "ready",
      lastError: null,
      lastUpdatedSimTimeHours: deterministicReadModelSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });

    await refreshReadModels();

    expect(getReadModelSnapshot()).toEqual(deterministicReadModelSnapshot);
    expect(getReadModelStatus()).toEqual({
      status: "ready",
      lastError: null,
      lastUpdatedSimTimeHours: deterministicReadModelSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });
  });

  it("fetches live read models when the transport succeeds", async () => {
    const updatedSnapshot = createAlteredReadModelSnapshot();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createFetchResponse(updatedSnapshot, true, HTTP_STATUS_OK));
    const client = createReadModelClient({
      baseUrl: "http://localhost",
      fetchImpl: fetchMock
    });

    configureReadModelClient(client, { immediateRefresh: false });

    await refreshReadModels();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost/api/read-models", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: undefined
    });
    expect(getReadModelStatus()).toEqual({
      status: "ready",
      lastError: null,
      lastUpdatedSimTimeHours: updatedSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });
    expect(getReadModelSnapshot().simulation.simTimeHours).toBe(
      updatedSnapshot.simulation.simTimeHours
    );
  });

  it("records errors and schedules deterministic retries when the transport fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createFetchResponse({}, false, HTTP_STATUS_SERVICE_UNAVAILABLE)
    );
    const client = createReadModelClient({
      baseUrl: "http://localhost",
      fetchImpl: fetchMock
    });

    const scheduled: { delay: number; attempt: number; task: () => void }[] = [];
    configureReadModelRetry({
      delaysMs: [250, 500],
      scheduler: (delayMs, attempt, task) => {
        scheduled.push({ delay: delayMs, attempt, task });
        // Do not execute the task automatically during tests.
        return () => {
          // no-op in tests
        };
      }
    });

    configureReadModelClient(client, { immediateRefresh: false });

    await refreshReadModels();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getReadModelSnapshot()).toEqual(deterministicReadModelSnapshot);
    expect(getReadModelStatus()).toEqual({
      status: "error",
      lastError: `Read-model request failed with status ${String(HTTP_STATUS_SERVICE_UNAVAILABLE)}`,
      lastUpdatedSimTimeHours: deterministicReadModelSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toMatchObject({ delay: 250, attempt: 1 });
  });
});

import { describe, expect, it, vi } from "vitest";
import { createReadModelClient } from "@ui/transport/readModelClient";
import {
  createUnsortedReadModelPayload,
  deterministicReadModelSnapshot
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

describe("readModelClient", () => {
  it("requires a base URL", () => {
    expect(() => createReadModelClient({ baseUrl: "" })).toThrow("baseUrl");
  });

  it("fetches the read-model endpoint and normalises payloads", async () => {
    const payload = createUnsortedReadModelPayload();
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse(payload));
    const client = createReadModelClient({ baseUrl: "http://localhost/", fetchImpl: fetchMock });

    const snapshot = await client.loadReadModels();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost/api/read-models", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: undefined
    });
    expect(snapshot.structures[0].name).toBe("Green Harbor");
    const vegetativeRoom = snapshot.structures[0].rooms.find((room) => room.id === "room-veg-a");
    expect(vegetativeRoom).toBeDefined();
    const zone = vegetativeRoom?.zones.find((entry) => entry.id === "zone-veg-a-1");
    expect(zone?.id).toBe("zone-veg-a-1");
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.structures[0])).toBe(true);
    expect(Object.keys(snapshot.compatibility.cultivationToIrrigation)).toEqual([
      "cm-screen-of-green",
      "cm-sea-of-green"
    ]);
  });

  it("propagates transport failures as errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createFetchResponse({}, false, HTTP_STATUS_SERVICE_UNAVAILABLE)
    );
    const client = createReadModelClient({ baseUrl: "http://localhost", fetchImpl: fetchMock });

    await expect(client.loadReadModels()).rejects.toThrow("503");
  });

  it("validates payload structure", async () => {
    const invalidPayload = { ...deterministicReadModelSnapshot, simulation: null };
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse(invalidPayload));
    const client = createReadModelClient({ baseUrl: "http://localhost", fetchImpl: fetchMock });

    await expect(client.loadReadModels()).rejects.toThrow("simulation");
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SOCKET_ERROR_CODES } from "@wb/transport-sio";

import { ZoneSetupWizard } from "../ZoneSetupWizard";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import type { IntentClient, IntentSubmissionResult } from "@ui/transport";
import type { PriceBookCatalog, ZoneReadModel } from "@ui/state/readModels.types";

const sourceZone = deterministicReadModelSnapshot.structures[0]!.rooms[0]!.zones[0]!;
const zone: ZoneReadModel = {
  ...sourceZone,
  area_m2: 2.4,
  maxPlants: 4,
  cultivationMethodId: "basic-soil",
  irrigationMethodId: "manual-watering",
  devices: [],
  readiness: {
    status: "missing-prerequisites",
    missingPrerequisites: ["lighting-coverage", "climate-control"]
  }
};
const priceBook: PriceBookCatalog = {
  ...deterministicReadModelSnapshot.priceBook,
  devices: [
    {
      id: "lighting-price",
      deviceBlueprintId: "3b5f6ad7-672e-47cd-9a24-f0cc45c4101e",
      deviceSlug: "led-veg-light-600",
      coverageArea_m2: 1.2,
      throughput_m3_per_hour: 0,
      capitalExpenditure: 600
    },
    {
      id: "climate-price",
      deviceBlueprintId: "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b",
      deviceSlug: "cool-air-split-3000",
      coverageArea_m2: 25,
      throughput_m3_per_hour: 350,
      capitalExpenditure: 1200
    }
  ]
};
const compatibility = {
  cultivationToIrrigation: { "basic-soil": { "manual-watering": "ok" as const } },
  strainToCultivation: {}
};

function renderWizard(client: IntentClient, overrides?: Partial<ZoneReadModel>, onRefresh = vi.fn(async () => undefined)) {
  const rendered = render(
    <ZoneSetupWizard
      structureId="structure-1"
      roomId="room-1"
      zone={{ ...zone, ...overrides }}
      priceBook={priceBook}
      compatibility={compatibility}
      intentClient={client}
      onRefresh={onRefresh}
    />
  );
  return { ...rendered, onRefresh };
}

describe("ZoneSetupWizard", () => {
  it("shows area, plant limit, compatibility, and real one-time costs", () => {
    renderWizard({ submit: vi.fn(), disconnect: vi.fn(async () => undefined) });
    expect(screen.getByText("2.40 m²")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getByText("Kompatibel")).toBeVisible();
    expect(screen.getByText("Einmalkosten: 2400.00 CC")).toBeVisible();
    expect(screen.getByText(/Economy-Ledger in R-501/)).toBeVisible();
  });

  it("stays pending until the first real intent result resolves", async () => {
    let resolveResult: ((result: IntentSubmissionResult) => void) | undefined;
    const submit = vi.fn(async () => await new Promise<IntentSubmissionResult>((resolve) => { resolveResult = resolve; }));
    renderWizard({ submit, disconnect: vi.fn(async () => undefined) });
    fireEvent.click(screen.getByRole("button", { name: "Zone einrichten" }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Geräte werden installiert…" })).toBeDisabled();
    await act(async () => { resolveResult?.({ ok: false, ack: { ok: false, error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: "reject" } }, dictionary: { code: SOCKET_ERROR_CODES.INTENT_INVALID, title: "Rejected", description: "Gerät konnte nicht installiert werden.", action: "Retry" } }); });
  });

  it("stops on rejection and keeps the authoritative readiness visible", async () => {
    const result: IntentSubmissionResult = { ok: false, ack: { ok: false, error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: "reject" } }, dictionary: { code: SOCKET_ERROR_CODES.INTENT_INVALID, title: "Rejected", description: "Gerät konnte nicht installiert werden.", action: "Retry" } };
    const submit = vi.fn(async () => result);
    renderWizard({ submit, disconnect: vi.fn(async () => undefined) });
    fireEvent.click(screen.getByRole("button", { name: "Zone einrichten" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gerät konnte nicht installiert werden.");
    expect(submit).toHaveBeenCalledOnce();
    expect(screen.getByText("lighting-coverage")).toBeVisible();
  });

  it("submits the minimum device bundle, refreshes after acks, and renders ready", async () => {
    const success: IntentSubmissionResult = { ok: true, ack: { ok: true } };
    const submit = vi.fn(async () => success);
    const { onRefresh, rerender } = renderWizard({ submit, disconnect: vi.fn(async () => undefined) });
    fireEvent.click(screen.getByRole("button", { name: "Zone einrichten" }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledTimes(3);
    expect(new Set(submit.mock.calls.map((call) => call[0].intentId)).size).toBe(3);
    expect(submit.mock.calls.map((call) => call[0])).toEqual([
      expect.objectContaining({ type: "device.purchaseInstall.v1", deviceBlueprintId: "3b5f6ad7-672e-47cd-9a24-f0cc45c4101e" }),
      expect.objectContaining({ type: "device.purchaseInstall.v1", deviceBlueprintId: "3b5f6ad7-672e-47cd-9a24-f0cc45c4101e" }),
      expect.objectContaining({ type: "device.purchaseInstall.v1", deviceBlueprintId: "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b" })
    ]);
    rerender(<ZoneSetupWizard structureId="structure-1" roomId="room-1" zone={{ ...zone, readiness: { status: "ready", missingPrerequisites: [] } }} priceBook={priceBook} compatibility={compatibility} intentClient={{ submit, disconnect: vi.fn(async () => undefined) }} onRefresh={onRefresh} />);
    expect(screen.getByText("bereit")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Zone einrichten" })).not.toBeInTheDocument();
  });
});

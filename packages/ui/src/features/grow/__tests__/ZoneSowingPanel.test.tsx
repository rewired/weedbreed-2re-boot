import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SOCKET_ERROR_CODES } from "@wb/transport-sio";

import { ZoneSowingPanel } from "../ZoneSowingPanel";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import type { IntentClient, IntentSubmissionResult } from "@ui/transport";
import type { ZoneReadModel } from "@ui/state/readModels.types";

const NORTHERN_LIGHTS_ID = "3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7";
const SOUR_DIESEL_ID = "8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2";
const sourceZone = deterministicReadModelSnapshot.structures[0]!.rooms[0]!.zones[0]!;
const readyZone: ZoneReadModel = {
  ...sourceZone,
  readiness: { status: "ready", missingPrerequisites: [] },
  plants: [],
  sowEligibility: { eligible: true, reasons: [], capacityRemaining: 9 },
  strainChoices: [
    { strainId: NORTHERN_LIGHTS_ID, slug: "northern-lights", name: "Northern Lights", seedPriceCc: 12, eligible: true, ineligibilityReason: null },
    { strainId: SOUR_DIESEL_ID, slug: "sour-diesel", name: "Sour Diesel", seedPriceCc: 15, eligible: true, ineligibilityReason: null }
  ]
};

const disconnected = vi.fn(async () => undefined);

function renderPanel(client: IntentClient, zone: ZoneReadModel = readyZone, onRefresh = vi.fn(async () => undefined)) {
  return {
    ...render(<ZoneSowingPanel structureId="structure-1" roomId="room-1" zone={zone} intentClient={client} onRefresh={onRefresh} />),
    onRefresh
  };
}

describe("ZoneSowingPanel", () => {
  it("offers both authoritative strains and calculates the displayed seed cost", () => {
    renderPanel({ submit: vi.fn(), disconnect: disconnected });
    expect(screen.getByRole("option", { name: "Northern Lights" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "Sour Diesel" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Sorte"), { target: { value: SOUR_DIESEL_ID } });
    fireEvent.change(screen.getByLabelText("Menge"), { target: { value: "3" } });
    expect(screen.getByText("Seedkosten: 45.00 CC")).toBeVisible();
    expect(screen.getByText(/R-501/)).toBeVisible();
  });

  it("enforces the authoritative remaining capacity", () => {
    renderPanel({ submit: vi.fn(), disconnect: disconnected }, {
      ...readyZone,
      sowEligibility: { eligible: true, reasons: [], capacityRemaining: 2 }
    });
    fireEvent.change(screen.getByLabelText("Menge"), { target: { value: "3" } });
    expect(screen.getByRole("button", { name: "Säen" })).toBeDisabled();
  });

  it("waits for the ack and refreshes only after success", async () => {
    let resolveResult: ((result: IntentSubmissionResult) => void) | undefined;
    const submit = vi.fn(async () => await new Promise<IntentSubmissionResult>((resolve) => { resolveResult = resolve; }));
    const { onRefresh } = renderPanel({ submit, disconnect: disconnected });
    fireEvent.change(screen.getByLabelText("Menge"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Säen" }));
    expect(screen.getByRole("button", { name: "Aussaat wird bestätigt…" })).toBeDisabled();
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => { resolveResult?.({ ok: true, ack: { ok: true } }); });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "plants.sow.v1",
        structureId: "structure-1",
        roomId: "room-1",
        zoneId: readyZone.id,
        strainId: NORTHERN_LIGHTS_ID,
        count: 2,
        intentId: expect.any(String)
      }),
      expect.objectContaining({ onResult: expect.any(Function) })
    );
  });

  it("keeps the form after a rejected acknowledgement", async () => {
    const rejected: IntentSubmissionResult = {
      ok: false,
      ack: { ok: false, error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: "rejected" } },
      dictionary: { code: SOCKET_ERROR_CODES.INTENT_INVALID, title: "Rejected", description: "Die Zone ist nicht mehr leer.", action: "Refresh" }
    };
    const { onRefresh } = renderPanel({ submit: vi.fn(async () => rejected), disconnect: disconnected });
    fireEvent.click(screen.getByRole("button", { name: "Säen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Die Zone ist nicht mehr leer.");
    expect(screen.getByLabelText("Sorte")).toBeVisible();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("hides sowing for a nonempty zone and renders only projected plant progress", () => {
    renderPanel({ submit: vi.fn(), disconnect: disconnected }, {
      ...readyZone,
      currentPlantCount: 1,
      sowEligibility: { eligible: false, reasons: ["zone-not-empty"], capacityRemaining: 8 },
      plants: [{
        id: "plant-1",
        strainId: NORTHERN_LIGHTS_ID,
        strainName: "Northern Lights",
        phase: "seedling",
        ageHours: 6,
        health01: 0.93,
        biomassKg: 0.012,
        estimatedMaturityAtSimHour: 1464,
        estimatedRemainingHours: 1458
      }]
    });
    expect(screen.queryByRole("button", { name: "Säen" })).not.toBeInTheDocument();
    expect(screen.getByText("Northern Lights")).toBeVisible();
    expect(screen.getByText("seedling")).toBeVisible();
    expect(screen.getByText("6 h")).toBeVisible();
    expect(screen.getByText("93%")).toBeVisible();
    expect(screen.getByText("0.012 kg")).toBeVisible();
    expect(screen.getByText("Sim-Stunde 1464")).toBeVisible();
    expect(screen.getByText("1458 h")).toBeVisible();
  });

  it("shows authoritative ineligibility reasons for an empty zone", () => {
    renderPanel({ submit: vi.fn(), disconnect: disconnected }, {
      ...readyZone,
      sowEligibility: { eligible: false, reasons: ["capacity-exhausted"], capacityRemaining: 0 }
    });
    expect(screen.getByText("Säen nicht möglich: capacity-exhausted")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Säen" })).not.toBeInTheDocument();
  });

  it("offers a selected custom strain after terminal harvest history", () => {
    renderPanel({ submit: vi.fn(), disconnect: disconnected }, {
      ...readyZone,
      plants: [{
        id: "plant-harvested",
        strainId: NORTHERN_LIGHTS_ID,
        strainName: "Northern Lights",
        phase: "harvest-ready",
        ageHours: 2_000,
        health01: 0.9,
        biomassKg: 0.2,
        estimatedMaturityAtSimHour: 2_000,
        estimatedRemainingHours: 0,
        status: "harvested",
        harvestReady: false
      }],
      sowEligibility: { eligible: true, reasons: [], capacityRemaining: 9 },
      strainChoices: [
        ...readyZone.strainChoices!,
        { strainId: "candidate-ramp-one", slug: "ramp-one", name: "Ramp One", seedPriceCc: 0, eligible: true, ineligibilityReason: null }
      ]
    });
    expect(screen.getByRole("option", { name: "Ramp One" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Säen" })).toBeEnabled();
    expect(screen.queryByText("Pflanzenfortschritt")).not.toBeInTheDocument();
  });
});

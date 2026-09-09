import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SOCKET_ERROR_CODES } from "@wb/transport-sio";

import { ZoneHarvestPanel } from "../ZoneHarvestPanel";
import type { ZoneReadModel } from "@ui/state/readModels.types";
import type { IntentSubmissionResult } from "@ui/transport";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";

const sourceZone = deterministicReadModelSnapshot.structures[0]!.rooms[0]!.zones[0]!;
const readyZone: ZoneReadModel = {
  ...sourceZone,
  plants: [
    {
      id: "3a425fbb-eddf-4d2f-bf09-eebde5df8d01",
      strainId: "3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7",
      strainName: "Northern Lights",
      phase: "harvest-ready",
      status: "active",
      harvestReady: true,
      ageHours: 1_464,
      health01: 0.94,
      biomassKg: 0.42,
      estimatedMaturityAtSimHour: 1_464,
      estimatedRemainingHours: 0
    },
    {
      id: "d15b85d1-bd86-4c26-9b97-a888926219dc",
      strainId: "3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7",
      strainName: "Northern Lights",
      phase: "flower",
      status: "active",
      harvestReady: false,
      ageHours: 1_200,
      health01: 0.91,
      biomassKg: 0.31,
      estimatedMaturityAtSimHour: 1_464,
      estimatedRemainingHours: 264
    }
  ],
  harvestEligibility: {
    eligible: true,
    plantIds: ["3a425fbb-eddf-4d2f-bf09-eebde5df8d01"],
    reasons: []
  }
};

const disconnect = vi.fn(async () => undefined);

describe("ZoneHarvestPanel", () => {
  it("shows server-projected readiness for every plant", () => {
    render(<ZoneHarvestPanel structureId="structure-1" roomId="room-1" zone={readyZone} intentClient={null} />);

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Erntereif")).toBeVisible();
    expect(within(items[1]!).getByText("Noch nicht erntereif")).toBeVisible();
    expect(screen.getByRole("button", { name: "Erntereife Pflanzen ernten (1)" })).toBeDisabled();
  });

  it("waits for a successful ack before refreshing the read model", async () => {
    let resolveResult: ((value: IntentSubmissionResult) => void) | undefined;
    const submit = vi.fn(async () => await new Promise<IntentSubmissionResult>((resolve) => {
      resolveResult = resolve;
    }));
    const onRefresh = vi.fn(async () => undefined);

    render(
      <ZoneHarvestPanel
        structureId="structure-1"
        roomId="room-1"
        zone={readyZone}
        intentClient={{ submit, disconnect }}
        onRefresh={onRefresh}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Erntereife Pflanzen ernten (1)" }));

    expect(screen.getByRole("button", { name: "Ernte wird bestätigt…" })).toBeDisabled();
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => { resolveResult?.({ ok: true, ack: { ok: true } }); });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith(
      {
        type: "plants.harvest.v1",
        intentId: expect.any(String),
        structureId: "structure-1",
        roomId: "room-1",
        zoneId: readyZone.id,
        plantIds: ["3a425fbb-eddf-4d2f-bf09-eebde5df8d01"]
      },
      expect.objectContaining({ onResult: expect.any(Function) })
    );
  });

  it("keeps the action recoverable after an authoritative rejection", async () => {
    const rejection: IntentSubmissionResult = {
      ok: false,
      ack: { ok: false, error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: "plant_not_ready" } },
      dictionary: {
        code: SOCKET_ERROR_CODES.INTENT_INVALID,
        title: "Nicht erntereif",
        description: "Die Pflanze ist noch nicht erntereif.",
        action: "Status aktualisieren"
      }
    };
    const onRefresh = vi.fn(async () => undefined);
    render(
      <ZoneHarvestPanel
        structureId="structure-1"
        roomId="room-1"
        zone={readyZone}
        intentClient={{ submit: vi.fn(async () => rejection), disconnect }}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Erntereife Pflanzen ernten (1)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Die Pflanze ist noch nicht erntereif.");
    expect(screen.getByRole("button", { name: "Erntereife Pflanzen ernten (1)" })).toBeEnabled();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("does not enable harvest when the server reports no ready plants", () => {
    const zone: ZoneReadModel = {
      ...readyZone,
      plants: readyZone.plants?.map((plant) => ({ ...plant, phase: "flower", harvestReady: false })) ?? [],
      harvestEligibility: { eligible: false, plantIds: [], reasons: ["no-harvest-ready-plants"] }
    };
    render(<ZoneHarvestPanel structureId="structure-1" roomId="room-1" zone={zone} intentClient={{ submit: vi.fn(), disconnect }} />);

    expect(screen.getByRole("button", { name: "Erntereife Pflanzen ernten (0)" })).toBeDisabled();
    expect(screen.getByText("Noch keine aktive Pflanze ist erntereif.")).toBeVisible();
  });
});

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SOCKET_ERROR_CODES } from "@wb/transport-sio";

import { InventoryPanel } from "../InventoryPanel";
import type { EconomyReadModel, InventoryReadModel } from "@ui/state/readModels.types";
import type { IntentSubmissionResult } from "@ui/transport";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";

const lotId = "65f4354d-f895-4a0a-ac58-43d53520a6f3";
const inventory: InventoryReadModel = {
  lots: [{
    lotId,
    strainId: "3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7",
    strainName: "Northern Lights",
    quality01: 0.923,
    freshWeightKg: 0.418,
    remainingFreshWeightKg: 0.209,
    remainingDryWeightKg: 0.04807,
    moisture01: 0.77,
    structureId: "structure-1",
    storageRoomId: "storage-1",
    source: { plantId: "plant-1", zoneId: "zone-1", harvestIntentId: "harvest-1" },
    createdAtTick: 1_464,
    salePreview: {
      fraction01: 0.5,
      soldFreshWeightKg: 0.1045,
      soldDryWeightKg: 0.024035,
      priceCcPerDryGram: 8.2,
      qualityFactor: 0.923,
      proceedsCc: 181.98,
      balanceBeforeCc: 39_150,
      balanceAfterCc: 39_331.98,
      cycleContributionMarginAfterCc: -10_668.02
    }
  }],
  totalFreshWeightKg: 0.209
};
const economy: EconomyReadModel = { ...deterministicReadModelSnapshot.economy, balanceCc: 39_150 };
const disconnect = vi.fn(async () => undefined);

describe("InventoryPanel", () => {
  it("shows the authoritative lot, 50% quote, balances and contribution margin", () => {
    render(<InventoryPanel inventory={inventory} economy={economy} />);

    const lot = screen.getByRole("listitem");
    expect(within(lot).getByText("Northern Lights")).toBeVisible();
    expect(within(lot).getByText("0.209 kg")).toBeVisible();
    expect(within(lot).getByText("0.048 kg")).toBeVisible();
    const preview = screen.getByLabelText("Verkaufsvorschau");
    expect(within(preview).getByText("0.104 kg")).toBeVisible();
    expect(within(preview).getByText("0.024 kg")).toBeVisible();
    expect(within(preview).getByText("0.923")).toBeVisible();
    expect(within(preview).getByText("8.20 CC/g")).toBeVisible();
    expect(within(preview).getByText("181.98 CC")).toBeVisible();
    expect(within(preview).getByText("39150.00 CC")).toBeVisible();
    expect(within(preview).getByText("39331.98 CC")).toBeVisible();
    expect(within(preview).getByText("-10668.02 CC")).toBeVisible();
  });

  it("waits for Ack before refresh and submits the projected fraction", async () => {
    let resolveResult: ((value: IntentSubmissionResult) => void) | undefined;
    const submit = vi.fn(async () => await new Promise<IntentSubmissionResult>((resolve) => { resolveResult = resolve; }));
    const onRefresh = vi.fn(async () => undefined);
    render(<InventoryPanel inventory={inventory} economy={economy} intentClient={{ submit, disconnect }} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "50% verkaufen" }));
    expect(screen.getByRole("button", { name: "Verkauf wird bestätigt…" })).toBeDisabled();
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => { resolveResult?.({ ok: true, ack: { ok: true } }); });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith(
      { type: "inventory.sell.v1", intentId: expect.any(String), lotId, fraction01: 0.5 },
      expect.objectContaining({ onResult: expect.any(Function) })
    );
  });

  it("keeps the sale recoverable after an authoritative rejection", async () => {
    const rejection: IntentSubmissionResult = {
      ok: false,
      ack: { ok: false, error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: "invalid_fraction" } },
      dictionary: { code: SOCKET_ERROR_CODES.INTENT_INVALID, title: "Ungültige Menge", description: "Der Verkaufsanteil ist ungültig.", action: "Anteil prüfen" }
    };
    const onRefresh = vi.fn(async () => undefined);
    render(<InventoryPanel inventory={inventory} economy={economy} intentClient={{ submit: vi.fn(async () => rejection), disconnect }} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "50% verkaufen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Der Verkaufsanteil ist ungültig.");
    expect(screen.getByRole("button", { name: "50% verkaufen" })).toBeEnabled();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("shows the refreshed partial remainder and switches selectable lots", () => {
    const second = { ...inventory.lots[0]!, lotId: "75f4354d-f895-4a0a-ac58-43d53520a6f3", strainName: "Sour Diesel" };
    const view = render(<InventoryPanel inventory={{ lots: [inventory.lots[0]!, second], totalFreshWeightKg: 0.627 }} economy={economy} />);
    fireEvent.change(screen.getByLabelText("Verkaufslot"), { target: { value: second.lotId } });
    expect(screen.getByLabelText("Verkaufslot")).toHaveValue(second.lotId);

    view.rerender(<InventoryPanel inventory={inventory} economy={{ ...economy, balanceCc: 39_331.98 }} />);
    expect(screen.getByText("Gesamtgewicht 0.209 kg")).toBeVisible();
    expect(screen.getByText("Aktuelles Guthaben: 39331.98 CC")).toBeVisible();
  });

  it("filters lots by their projected source zone", () => {
    render(<InventoryPanel inventory={inventory} sourceZoneId="another-zone" />);
    expect(screen.getByText("Noch keine Erntelots vorhanden.")).toBeVisible();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});

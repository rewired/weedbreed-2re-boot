import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SOCKET_ERROR_CODES } from "@wb/transport-sio";

import { BreedingLab } from "@ui/features/breeding/BreedingLab";
import type { BreedingReadModel, BreedingTraitsReadModel } from "@ui/state/breedingReadModels.types";
import type { IntentSubmissionResult } from "@ui/transport";

const traitsA: BreedingTraitsReadModel = {
  yieldPotentialGPerPlant: 35,
  cycleDurationDays: 92,
  resilience01: 0.7,
  thc01: 0.2,
  cbd01: 0.01,
  temperatureBandC: { min: 20, max: 26 }
};
const traitsB: BreedingTraitsReadModel = {
  yieldPotentialGPerPlant: 55,
  cycleDurationDays: 128,
  resilience01: 0.6,
  thc01: 0.22,
  cbd01: 0.02,
  temperatureBandC: { min: 24, max: 28 }
};
const delta: BreedingTraitsReadModel = {
  yieldPotentialGPerPlant: 3,
  cycleDurationDays: -2,
  resilience01: 0.04,
  thc01: 0.01,
  cbd01: 0,
  temperatureBandC: { min: 0.5, max: -0.5 }
};
const parents = [
  { strainId: "parent-a", name: "Northern Lights", traits: traitsA },
  { strainId: "parent-b", name: "Sour Diesel", traits: traitsB }
] as const;
const candidate = { candidateId: "candidate-1", ordinal: 1, name: "F1 #1", traits: { ...traitsA, yieldPotentialGPerPlant: 48 }, deltaFromParentMean: delta };

const emptyBreeding: BreedingReadModel = {
  laboratory: { roomId: "lab-1", roomName: "Genetics Lab" },
  qualifiedParents: parents,
  crossEligibility: { eligible: true, reasons: [] },
  runs: []
};
const generatedBreeding: BreedingReadModel = {
  ...emptyBreeding,
  runs: [{
    runId: "run-1",
    status: "candidates-generated",
    laboratoryRoomId: "lab-1",
    populationSize: 4,
    parents: [
      { ...parents[0], role: "seed" },
      { ...parents[1], role: "pollen" }
    ],
    candidates: [candidate, { ...candidate, candidateId: "candidate-2", ordinal: 2, name: "F1 #2" }],
    selectedCandidateId: null,
    customStrain: null
  }]
};

const disconnect = vi.fn(async () => undefined);

describe("BreedingLab", () => {
  it("offers only qualified distinct parents and defaults the population to four", () => {
    render(<BreedingLab breeding={emptyBreeding} intentClient={{ submit: vi.fn(), disconnect }} />);
    expect(screen.getAllByRole("option", { name: "Northern Lights" })).toHaveLength(2);
    expect(screen.getAllByRole("option", { name: "Sour Diesel" })).toHaveLength(2);
    expect(screen.queryByRole("option", { name: "Unqualified" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Populationsgröße")).toHaveValue("4");
    const pollenOptions = within(screen.getByLabelText("Pollen-Elternteil")).getAllByRole("option");
    expect(pollenOptions.find((option) => option.textContent === "Northern Lights")).toBeDisabled();
    expect(screen.getByRole("button", { name: "F1-Cross starten" })).toBeEnabled();
  });

  it("waits for the cross acknowledgement before refreshing", async () => {
    let resolveResult: ((result: IntentSubmissionResult) => void) | undefined;
    const submit = vi.fn(async () => await new Promise<IntentSubmissionResult>((resolve) => { resolveResult = resolve; }));
    const onRefresh = vi.fn(async () => undefined);
    render(<BreedingLab breeding={emptyBreeding} intentClient={{ submit, disconnect }} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: "F1-Cross starten" }));
    expect(screen.getByRole("button", { name: "Cross wird bestätigt…" })).toBeDisabled();
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => { resolveResult?.({ ok: true, ack: { ok: true } }); });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith({
      type: "breeding.crossF1.v1",
      intentId: expect.any(String),
      laboratoryRoomId: "lab-1",
      seedParentId: "parent-a",
      pollenParentId: "parent-b",
      populationSize: 4
    }, expect.objectContaining({ onResult: expect.any(Function) }));
  });

  it("uses one trait table for parents and candidates and selects only after Ack", async () => {
    let resolveResult: ((result: IntentSubmissionResult) => void) | undefined;
    const submit = vi.fn(async () => await new Promise<IntentSubmissionResult>((resolve) => { resolveResult = resolve; }));
    const onRefresh = vi.fn(async () => undefined);
    render(<BreedingLab breeding={generatedBreeding} intentClient={{ submit, disconnect }} onRefresh={onRefresh} />);

    const table = screen.getByRole("table", { name: "Vergleich der Eltern und F1-Kandidaten" });
    for (const heading of ["Ertragspotenzial", "Zyklusdauer", "Robustheit", "THC / CBD", "Temperaturband"]) {
      expect(within(table).getByRole("columnheader", { name: heading })).toBeVisible();
    }
    expect(within(table).getAllByText("Elternteil")).toHaveLength(2);
    expect(within(table).getAllByText("F1-Kandidat")).toHaveLength(2);
    expect(within(table).getAllByText("48.0 g/Pflanze")).toHaveLength(2);
    expect(within(table).getAllByText("zum Elternmittel +3.0 g")).toHaveLength(2);

    fireEvent.click(screen.getByRole("radio", { name: "F1 #1 auswählen" }));
    fireEvent.change(screen.getByLabelText("Name der eigenen Sorte"), { target: { value: " Ramp One " } });
    fireEvent.click(screen.getByRole("button", { name: "Als Sorte übernehmen" }));
    expect(screen.getByRole("button", { name: "Auswahl wird bestätigt…" })).toBeDisabled();
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => { resolveResult?.({ ok: true, ack: { ok: true } }); });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith({
      type: "breeding.selectCandidate.v1",
      intentId: expect.any(String),
      runId: "run-1",
      candidateId: "candidate-1",
      name: "Ramp One"
    }, expect.objectContaining({ onResult: expect.any(Function) }));
  });

  it("keeps selection recoverable after rejection and locks a selected run", async () => {
    const rejected: IntentSubmissionResult = {
      ok: false,
      ack: { ok: false, error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: "strain-collision" } },
      dictionary: { code: SOCKET_ERROR_CODES.INTENT_INVALID, title: "Ungültig", description: "Name bereits vergeben.", action: "Anderen Namen wählen" }
    };
    const view = render(<BreedingLab breeding={generatedBreeding} intentClient={{ submit: vi.fn(async () => rejected), disconnect }} />);
    fireEvent.click(screen.getByRole("radio", { name: "F1 #1 auswählen" }));
    fireEvent.change(screen.getByLabelText("Name der eigenen Sorte"), { target: { value: "Ramp One" } });
    fireEvent.click(screen.getByRole("button", { name: "Als Sorte übernehmen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("strain-collision");
    expect(screen.getByRole("button", { name: "Als Sorte übernehmen" })).toBeEnabled();

    view.rerender(<BreedingLab breeding={{ ...generatedBreeding, runs: [{ ...generatedBreeding.runs[0]!, status: "selected", selectedCandidateId: "candidate-1", customStrain: { strainId: "candidate-1", name: "Ramp One", slug: "ramp-one" } }] }} intentClient={{ submit: vi.fn(), disconnect }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Ramp One");
    expect(screen.getByRole("radio", { name: "F1 #1 auswählen" })).toBeDisabled();
    expect(screen.queryByLabelText("Name der eigenen Sorte")).not.toBeInTheDocument();
  });
});

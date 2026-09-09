import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SOCKET_ERROR_CODES } from "@wb/transport-sio";

import { ZoneIncidentPanel } from "../ZoneIncidentPanel";
import { IntentClientProvider } from "@ui/transport";
import type { IntentClient, IntentSubmissionHandlers, IntentSubmissionResult } from "@ui/transport";
import type { SimulationIncidentSummary } from "@ui/state/readModels.types";

const incident: SimulationIncidentSummary = {
  id: "incident-1",
  code: "demo.environment.temperature.high",
  message: "Die Temperatur liegt über dem Zielband.",
  severity: "critical",
  raisedAtTick: 3,
  status: "active",
  zoneId: "zone-1",
  measured: { metric: "temperature_C", value: 32 },
  targetBand: { min: 18, max: 24 },
  consequence: { code: "plant_heat_stress", affectedPlantCount: 2, averagePlantHealth01: 0.94 },
  recommendedIntent: {
    type: "intent.zone.climate.adjust.v1",
    payload: { structureId: "structure-1", zoneId: "zone-1", target: { temperature_C: 21 } }
  },
  resolvedAtTick: null
};

function createClient() {
  let resolveResult: ((result: IntentSubmissionResult) => void) | undefined;
  let handlers: IntentSubmissionHandlers | undefined;
  const submit = vi.fn(async (_payload: Record<string, unknown>, nextHandlers: IntentSubmissionHandlers) => {
    handlers = nextHandlers;
    return await new Promise<IntentSubmissionResult>((resolve) => { resolveResult = resolve; });
  });
  const client: IntentClient = { submit, disconnect: vi.fn(async () => undefined) };
  const settle = (result: IntentSubmissionResult) => {
    handlers?.onResult(result);
    resolveResult?.(result);
  };
  return { client, submit, settle };
}

function renderPanel(client: IntentClient, value = incident, onRefresh = vi.fn(async () => undefined)) {
  return {
    ...render(<IntentClientProvider client={client}><ZoneIncidentPanel incident={value} simulationPaused onRefresh={onRefresh} /></IntentClientProvider>),
    onRefresh
  };
}

describe("ZoneIncidentPanel", () => {
  it("shows the active incident, server pause, target band, impact, and concrete action", () => {
    renderPanel(createClient().client);
    expect(screen.getByText("Klima-Incident aktiv")).toBeVisible();
    expect(screen.getByText("Zeitraffer pausiert (Serverstatus)")).toBeVisible();
    expect(screen.getByText("32.0 °C")).toBeVisible();
    expect(screen.getByText("18.0–24.0 °C")).toBeVisible();
    expect(screen.getByText(/Wachstum und Qualität von 2 Pflanzen/)).toBeVisible();
    expect(screen.getByText(/Temperatur auf 21.0 °C setzen/)).toBeVisible();
  });

  it("keeps the action pending until its acknowledgement and submits the recommended payload", async () => {
    const client = createClient();
    const { onRefresh } = renderPanel(client.client);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(client.submit).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Applying…" })).toBeDisabled();
    expect(client.submit.mock.calls[0]?.[0]).toEqual({
      type: "intent.zone.climate.adjust.v1",
      structureId: "structure-1",
      zoneId: "zone-1",
      target: { temperature_C: 21 }
    });
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => client.settle({ ok: true, ack: { ok: true } }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
  });

  it("shows a rejection and leaves the active action available", async () => {
    const client = createClient();
    const { onRefresh } = renderPanel(client.client);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(client.submit).toHaveBeenCalledOnce());
    await act(async () => client.settle({
      ok: false,
      ack: { ok: false, error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: "rejected" } },
      dictionary: { code: SOCKET_ERROR_CODES.INTENT_INVALID, title: "Rejected", description: "Temperatur konnte nicht gesetzt werden.", action: "Retry" }
    }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Temperatur konnte nicht gesetzt werden.");
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("keeps a resolved incident trace without offering another correction", () => {
    renderPanel(createClient().client, { ...incident, status: "resolved", resolvedAtTick: 4 });
    expect(screen.getByText("Klima-Incident gelöst")).toBeVisible();
    expect(screen.getByText("gelöst bei Tick 4")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });
});

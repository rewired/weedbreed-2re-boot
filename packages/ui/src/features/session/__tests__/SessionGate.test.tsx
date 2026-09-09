import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntentClientProvider } from "@ui/transport";
import type {
  IntentClient,
  IntentSubmissionHandlers,
  IntentSubmissionResult
} from "@ui/transport";
import { SessionGate } from "../SessionGate";

function createIntentClientStub() {
  let resolveSubmission: ((result: IntentSubmissionResult) => void) | null = null;
  let handlers: IntentSubmissionHandlers | null = null;
  const submit = vi.fn(
    async (_intent: Record<string, unknown>, acknowledgementHandlers: IntentSubmissionHandlers) => {
      handlers = acknowledgementHandlers;
      return await new Promise<IntentSubmissionResult>((resolve) => {
        resolveSubmission = resolve;
      });
    }
  );
  const client: IntentClient = { submit, disconnect: vi.fn(async () => undefined) };

  function settle(result: IntentSubmissionResult): void {
    handlers?.onResult(result);
    resolveSubmission?.(result);
  }

  return { client, submit, settle };
}

function renderGate(client: IntentClient): void {
  render(
    <IntentClientProvider client={client}>
      <SessionGate>
        <div>Grow workspace</div>
      </SessionGate>
    </IntentClientProvider>
  );
}

function fillAndSubmit(companyName = " Green Labs ", seed = " wb-seed-01 "): void {
  fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: companyName } });
  fireEvent.change(screen.getByLabelText(/Seed/), { target: { value: seed } });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
}

describe("SessionGate", () => {
  it("submits game.new.v1 and remains pending until acknowledgement", async () => {
    const stub = createIntentClientStub();
    renderGate(stub.client);

    fillAndSubmit();

    await waitFor(() => expect(stub.submit).toHaveBeenCalledTimes(1));
    expect(stub.submit.mock.calls[0]?.[0]).toEqual({
      type: "game.new.v1",
      companyName: "Green Labs",
      seed: "wb-seed-01"
    });
    expect(screen.getByLabelText("Company Name")).toBeDisabled();
    expect(screen.getByLabelText(/Seed/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Spiel wird gestartet…" })).toBeDisabled();
    expect(screen.queryByText("Grow workspace")).not.toBeInTheDocument();
  });

  it("reveals the workspace and initial journey after a successful acknowledgement", async () => {
    const stub = createIntentClientStub();
    renderGate(stub.client);
    fillAndSubmit("Green Labs", "");
    await waitFor(() => expect(stub.submit).toHaveBeenCalledTimes(1));

    await act(async () => {
      stub.settle({ ok: true, ack: { ok: true } });
    });

    expect(stub.submit.mock.calls[0]?.[0]).toEqual({
      type: "game.new.v1",
      companyName: "Green Labs"
    });
    expect(screen.getByText("Grow workspace")).toBeVisible();
    expect(screen.getByText("Erzeuge und teste deine erste F1")).toBeVisible();
    expect(screen.getByText("0/9")).toBeVisible();
  });

  it("keeps the form editable and explains a rejected acknowledgement", async () => {
    const stub = createIntentClientStub();
    renderGate(stub.client);
    fillAndSubmit();
    await waitFor(() => expect(stub.submit).toHaveBeenCalledTimes(1));

    await act(async () => {
      stub.settle({
        ok: false,
        ack: {
          ok: false,
          error: { code: "INTENT_INVALID", message: "Invalid game configuration" }
        },
        dictionary: {
          code: "INTENT_INVALID",
          title: "Ungültige Eingabe",
          description: "Company Name oder Seed ist ungültig.",
          action: "Eingaben prüfen"
        }
      });
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Company Name oder Seed ist ungültig."
    );
    expect(screen.getByLabelText("Company Name")).toBeEnabled();
    expect(screen.getByLabelText(/Seed/)).toBeEnabled();
    expect(screen.queryByText("Grow workspace")).not.toBeInTheDocument();
  });
});

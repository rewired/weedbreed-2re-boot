import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IntentClient, IntentSubmissionHandlers, IntentSubmissionResult } from "@ui/transport";
import { IntentClientProvider } from "@ui/transport";
import { SetTemperatureForm } from "../SetTemperatureForm";

function createIntentClientStub() {
  let resolvePromise: ((result: IntentSubmissionResult) => void) | null = null;
  let handlers: IntentSubmissionHandlers | null = null;
  const submit = vi.fn(
    async (_intent: Record<string, unknown>, acknowledgementHandlers: IntentSubmissionHandlers) => {
      handlers = acknowledgementHandlers;
      return await new Promise<IntentSubmissionResult>((resolve) => {
        resolvePromise = resolve;
      });
    }
  );
  const client: IntentClient = { submit, disconnect: vi.fn(async () => undefined) };

  return {
    client,
    submit,
    getLastPayload(): Record<string, unknown> | null {
      const firstCall = submit.mock.calls.at(0);
      return firstCall ? (firstCall[0] as Record<string, unknown>) : null;
    },
    resolveSuccess() {
      const result = { ok: true as const, ack: { ok: true as const } };
      handlers?.onResult(result);
      resolvePromise?.(result);
    }
  };
}

describe("SetTemperatureForm", () => {
  it("submits a climate adjust intent with the provided target", async () => {
    const stub = createIntentClientStub();
    render(
      <IntentClientProvider client={stub.client}>
        <SetTemperatureForm
          structureId="structure-1"
          zoneId="zone-1"
          initialTemperatureC={23.5}
        />
      </IntentClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/Temperature setpoint/i), {
      target: { value: "24.2" }
    });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => expect(stub.submit).toHaveBeenCalledTimes(1));
    expect(stub.getLastPayload()).toEqual({
      type: "intent.zone.climate.adjust.v1",
      structureId: "structure-1",
      zoneId: "zone-1",
      target: { temperature_C: 24.2 }
    });

    await act(async () => {
      stub.resolveSuccess();
    });
  });
});


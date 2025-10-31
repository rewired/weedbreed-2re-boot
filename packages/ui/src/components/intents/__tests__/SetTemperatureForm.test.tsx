import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IntentClient, IntentSubmissionHandlers, IntentSubmissionResult } from "@ui/transport";
import { SetTemperatureForm } from "../SetTemperatureForm";

function createIntentClientStub() {
  let resolvePromise: ((result: IntentSubmissionResult) => void) | null = null;
  const submit = vi.fn(async (_intent: Record<string, unknown>, _handlers: IntentSubmissionHandlers) => {
    return await new Promise<IntentSubmissionResult>((resolve) => {
      resolvePromise = resolve;
    });
  });
  const client: IntentClient = { submit, disconnect: vi.fn(() => undefined) };

  return {
    client,
    submit,
    getLastPayload(): Record<string, unknown> | null {
      const firstCall = submit.mock.calls.at(0);
      return firstCall ? (firstCall[0] as Record<string, unknown>) : null;
    },
    resolveSuccess() {
      resolvePromise?.({ ok: true as const, ack: { ok: true as const } });
    }
  };
}

describe("SetTemperatureForm", () => {
  it("submits a climate adjust intent with the provided target", async () => {
    const stub = createIntentClientStub();
    render(
      <SetTemperatureForm
        structureId="structure-1"
        zoneId="zone-1"
        initialTemperatureC={23.5}
        // @ts-expect-error provide via provider in app; passing directly for test convenience
        intentClient={stub.client}
      /> as any
    );

    fireEvent.change(screen.getByLabelText(/Temperature setpoint/i), { target: { value: "24.2" } });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => expect(stub.submit).toHaveBeenCalledTimes(1));
    const payload = stub.getLastPayload();
    expect(payload).toEqual({
      type: "intent.zone.climate.adjust.v1",
      structureId: "structure-1",
      zoneId: "zone-1",
      target: { temperature_C: 24.2 }
    });

    stub.resolveSuccess();
  });
});



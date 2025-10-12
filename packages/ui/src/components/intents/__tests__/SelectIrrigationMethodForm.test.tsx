import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  IntentClient,
  IntentSubmissionHandlers,
  IntentSubmissionResult,
  IntentSubmissionSuccess,
  IntentSubmissionFailure,
  SuccessfulIntentAck,
  FailedIntentAck
} from "@ui/transport";
import { SOCKET_ERROR_CODES } from "@wb/transport-sio";
import { resolveIntentError } from "@ui/intl/intentErrors";
import { SelectIrrigationMethodForm, type IrrigationMethodOption } from "@ui/components/intents/SelectIrrigationMethodForm";
import { clearToasts, getToasts } from "@ui/state/toast";

const IRRIGATION_METHOD_FIXTURE: readonly [IrrigationMethodOption, IrrigationMethodOption] = [
  {
    id: "manual-watering-can",
    name: "Manual watering can",
    description: "Baseline manual irrigation for small canopies."
  },
  {
    id: "drip-inline-fertigation-basic",
    name: "Drip inline fertigation",
    description: "Deterministic nutrient dosing via drip manifolds."
  }
];

const [MANUAL_METHOD, DRIP_METHOD] = IRRIGATION_METHOD_FIXTURE;

type SubmitImplementation = (
  intent: Parameters<IntentClient["submit"]>[0],
  handlers: IntentSubmissionHandlers
) => Promise<IntentSubmissionResult>;

interface IntentClientStub extends IntentClient {
  submit: ReturnType<typeof vi.fn<SubmitImplementation>>;
}

function createIntentClientStub(implementation: SubmitImplementation): IntentClientStub {
  const submit = vi.fn<SubmitImplementation>((intent, handlers) => implementation(intent, handlers));
  return {
    submit,
    disconnect: vi.fn(() => Promise.resolve())
  };
}

beforeEach(() => {
  clearToasts();
  vi.clearAllMocks();
});

describe("SelectIrrigationMethodForm", () => {
  it("disables submit until a method is selected", () => {
    const client = createIntentClientStub(() =>
      Promise.reject(new Error("submit should not be called"))
    );

    render(
      <SelectIrrigationMethodForm
        irrigationMethods={IRRIGATION_METHOD_FIXTURE}
        intentClient={client}
        zoneId="zone-123"
      />
    );

    const submitButton = screen.getByRole("button", { name: /update irrigation method/i });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: /irrigation method/i }), {
      target: { value: MANUAL_METHOD.id }
    });

    expect(submitButton).not.toBeDisabled();
  });

  it("submits the selection and emits a success toast", async () => {
    const ack: SuccessfulIntentAck = { ok: true };
    const result: IntentSubmissionSuccess = { ok: true, ack };
    const client = createIntentClientStub((intent, handlers) => {
      handlers.onResult(result);
      return Promise.resolve(result);
    });

    render(
      <SelectIrrigationMethodForm
        irrigationMethods={IRRIGATION_METHOD_FIXTURE}
        intentClient={client}
        zoneId="zone-abc"
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: /irrigation method/i }), {
      target: { value: MANUAL_METHOD.id }
    });

    fireEvent.click(screen.getByRole("button", { name: /update irrigation method/i }));

    await waitFor(() => {
      expect(client.submit).toHaveBeenCalledWith(
        {
          type: "intent.selectIrrigationMethod.v1",
          zoneId: "zone-abc",
          methodId: MANUAL_METHOD.id
        },
        expect.any(Object)
      );
    });

    await waitFor(() => {
      expect(getToasts()).toHaveLength(1);
    });

    const [toast] = getToasts();
    expect(toast.variant).toBe("success");
    expect(toast.title).toMatch(/updated/i);
    expect(toast.description).toContain(MANUAL_METHOD.name);

    const selectElement = screen.getByRole("combobox", { name: /irrigation method/i });
    if (!(selectElement instanceof HTMLSelectElement)) {
      throw new TypeError("Expected the irrigation method control to be a select element.");
    }
    expect(selectElement.value).toBe("");
  });

  it("surfaces acknowledgement failures via toast and inline messaging", async () => {
    const ack: FailedIntentAck = {
      ok: false,
      error: {
        code: SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR,
        message: "handler failed"
      }
    };
    const dictionary = resolveIntentError(ack.error.code);
    const result: IntentSubmissionFailure = {
      ok: false,
      ack,
      dictionary
    };
    const client = createIntentClientStub((_intent, handlers) => {
      handlers.onResult(result);
      return Promise.resolve(result);
    });

    render(
      <SelectIrrigationMethodForm
        irrigationMethods={IRRIGATION_METHOD_FIXTURE}
        intentClient={client}
        zoneId="zone-abc"
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: /irrigation method/i }), {
      target: { value: DRIP_METHOD.id }
    });
    fireEvent.click(screen.getByRole("button", { name: /update irrigation method/i }));

    await waitFor(() => {
      const toasts = getToasts();
      expect(toasts).toHaveLength(1);
      const [firstToast] = toasts;
      expect(firstToast.variant).toBe("error");
      expect(firstToast.title).toBe(dictionary.title);
    });

    const inlineAlert = await screen.findByRole("alert");
    expect(inlineAlert).toHaveTextContent(dictionary.title);
    expect(inlineAlert).toHaveTextContent(dictionary.description);
    expect(inlineAlert).toHaveTextContent(dictionary.action);
  });

  it("surfaces transport contract violations via an error toast", async () => {
    const client = createIntentClientStub(() =>
      Promise.reject(new Error("Transport acknowledgement violated the contract."))
    );

    render(
      <SelectIrrigationMethodForm
        irrigationMethods={IRRIGATION_METHOD_FIXTURE}
        intentClient={client}
        zoneId="zone-abc"
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: /irrigation method/i }), {
      target: { value: DRIP_METHOD.id }
    });
    fireEvent.click(screen.getByRole("button", { name: /update irrigation method/i }));

    await waitFor(() => {
      const toasts = getToasts();
      expect(toasts).toHaveLength(1);
      const [firstToast] = toasts;
      expect(firstToast.variant).toBe("error");
      expect(firstToast.title).toMatch(/submission failed/i);
    });

    const fatalMessage = await screen.findByText(/transport acknowledgement violated the contract/i);
    expect(fatalMessage).toBeInTheDocument();
  });
});

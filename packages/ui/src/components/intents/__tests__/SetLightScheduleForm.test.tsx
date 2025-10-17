import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOCKET_ERROR_CODES, type TransportAckErrorCode } from "@wb/transport-sio";

import en from "@ui/intl/en.json" assert { type: "json" };
import { resolveIntentError } from "@ui/intl/intentErrors";
import type {
  IntentClient,
  IntentSubmissionHandlers,
  IntentSubmissionResult,
  IntentSubmissionSuccess
} from "@ui/transport";
import { getZoneLightSchedule, resetIntentState } from "@ui/state/intents";

import { SetLightScheduleForm } from "../SetLightScheduleForm";

const copy = en.intents.setLightSchedule;
const ZONE_ID = "zone-test";
const VALID_ON_HOURS = "12";
const VALID_OFF_HOURS = "12";
const VALID_START_HOUR = "6.5";
const FAILURE_ON_HOURS = "16";
const FAILURE_OFF_HOURS = "8";
const EXPECTED_START_HOUR = 6.5;
const EXPECTED_SCHEDULE = { onHours: 12, offHours: 12, startHour: EXPECTED_START_HOUR } as const;

interface IntentClientStub {
  readonly client: IntentClient;
  readonly submit: ReturnType<typeof vi.fn>;
  resolveSuccess(ack?: IntentSubmissionSuccess): void;
  resolveFailure(code: TransportAckErrorCode, message?: string): void;
  reject(reason: unknown): void;
  getLastPayload(): Record<string, unknown> | null;
}

function createIntentClientStub(): IntentClientStub {
  let handlers: IntentSubmissionHandlers | null = null;
  let payload: Record<string, unknown> | null = null;
  let resolvePromise: ((result: IntentSubmissionResult) => void) | null = null;

  const submit = vi.fn(
    async (intent: Record<string, unknown>, acknowledgementHandlers: IntentSubmissionHandlers) => {
      handlers = acknowledgementHandlers;
      payload = intent;
      return await new Promise<IntentSubmissionResult>((resolve) => {
        resolvePromise = resolve;
      });
    }
  );

  const disconnect = vi.fn(() => undefined);

  const client: IntentClient = {
    submit,
    disconnect
  } satisfies IntentClient;

  return {
    client,
    submit,
    resolveSuccess(ack?: IntentSubmissionSuccess) {
      if (!handlers || !resolvePromise) {
        throw new Error("No pending submission to resolve.");
      }

      const acknowledgement =
        ack ??
        ({
          ok: true as const,
          ack: { ok: true as const }
        } satisfies IntentSubmissionSuccess);
      handlers.onResult(acknowledgement);
      resolvePromise(acknowledgement);
    },
    resolveFailure(code: TransportAckErrorCode, message?: string) {
      if (!handlers || !resolvePromise) {
        throw new Error("No pending submission to resolve.");
      }

      const ack = {
        ok: false,
        error: {
          code,
          message: message ?? "transport error"
        }
      } as const;
      const dictionary = resolveIntentError(code);
      const result = {
        ok: false as const,
        ack,
        dictionary
      };
      handlers.onResult(result);
      resolvePromise(result);
    },
    getLastPayload() {
      return payload;
    }
  };
}

describe("SetLightScheduleForm", () => {
  beforeEach(() => {
    resetIntentState();
  });

  it("disables submit when the photoperiod does not sum to 24 hours", async () => {
    const { client } = createIntentClientStub();
    render(<SetLightScheduleForm intentClient={client} zoneId={ZONE_ID} />);

    const submit = screen.getByRole("button", { name: copy.actions.submit });
    expect(submit).toBeEnabled();

    fireEvent.change(screen.getByLabelText(copy.fields.offHours.label), { target: { value: "5" } });

    await waitFor(() => {
      expect(submit).toBeDisabled();
    });

    const statusEntries = await screen.findAllByText(copy.validation.sum);
    expect(statusEntries.length).toBeGreaterThan(0);
    const statusItem = statusEntries.find((element) => element.getAttribute("data-status"));
    if (!statusItem) {
      throw new Error("Expected validation status entry to be present");
    }
    expect(statusItem).toHaveAttribute("data-status", "block");

    fireEvent.change(screen.getByLabelText(copy.fields.offHours.label), { target: { value: "6" } });

    await waitFor(() => {
      expect(submit).toBeEnabled();
    });
  });

  it("submits a valid schedule, shows a spinner, and records success optimistically", async () => {
    const stub = createIntentClientStub();
    render(<SetLightScheduleForm intentClient={stub.client} zoneId={ZONE_ID} />);

    fireEvent.change(screen.getByLabelText(copy.fields.onHours.label), { target: { value: VALID_ON_HOURS } });
    fireEvent.change(screen.getByLabelText(copy.fields.offHours.label), { target: { value: VALID_OFF_HOURS } });
    fireEvent.change(screen.getByLabelText(copy.fields.startHour.label), { target: { value: VALID_START_HOUR } });

    fireEvent.click(screen.getByRole("button", { name: copy.actions.submit }));

    await waitFor(() => {
      expect(stub.submit).toHaveBeenCalledTimes(1);
    });

    const payload = stub.getLastPayload();
    expect(payload).toEqual({
      type: "zone.light-schedule.set",
      zoneId: ZONE_ID,
      schedule: {
        onHours: EXPECTED_SCHEDULE.onHours,
        offHours: EXPECTED_SCHEDULE.offHours,
        startHour: EXPECTED_START_HOUR
      }
    });

    expect(screen.getByText(copy.status.submitting)).toBeInTheDocument();

    await act(() => {
      stub.resolveSuccess();
      return Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(copy.status.success)).toBeInTheDocument();
    });

    const recorded = getZoneLightSchedule(ZONE_ID);
    expect(recorded).toEqual(EXPECTED_SCHEDULE);
  });

  it("surfaces transport dictionary errors as toast and inline message", async () => {
    const stub = createIntentClientStub();
    render(<SetLightScheduleForm intentClient={stub.client} zoneId={ZONE_ID} />);

    fireEvent.change(screen.getByLabelText(copy.fields.offHours.label), { target: { value: FAILURE_OFF_HOURS } });
    fireEvent.change(screen.getByLabelText(copy.fields.onHours.label), { target: { value: FAILURE_ON_HOURS } });

    fireEvent.click(screen.getByRole("button", { name: copy.actions.submit }));

    await waitFor(() => {
      expect(stub.submit).toHaveBeenCalledTimes(1);
    });

    await act(() => {
      stub.resolveFailure(SOCKET_ERROR_CODES.INTENT_INVALID, "validation failed");
      return Promise.resolve();
    });

    const dictionary = resolveIntentError(SOCKET_ERROR_CODES.INTENT_INVALID);

    await waitFor(() => {
      expect(screen.getAllByText(dictionary.title)).toHaveLength(2);
      expect(screen.getByText(dictionary.description)).toBeInTheDocument();
      expect(screen.getByText(dictionary.action)).toBeInTheDocument();
      expect(screen.getByText(copy.status.toastErrorTitle)).toBeInTheDocument();
    });
  });
});

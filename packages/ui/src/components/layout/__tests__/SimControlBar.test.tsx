import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimControlBar } from "@ui/components/layout/SimControlBar";
import { workspaceCopy } from "@ui/design/tokens";
import * as localeModule from "@ui/lib/locale";
import { formatClockLabel, formatSignedCurrencyPerHour } from "@ui/lib/locale";
import { DEFAULT_SIMULATION_CLOCK } from "@ui/lib/simTime";
import { SIM_SPEED_OPTIONS, useSimulationControlsStore } from "@ui/state/simulationControls";
import { clearTelemetrySnapshots, recordTickCompleted } from "@ui/state/telemetry";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import { IntentClientProvider } from "@ui/transport";
import type {
  IntentClient,
  IntentSubmissionSuccess,
  SuccessfulIntentAck
} from "@ui/transport/intentClient";
import type { TransportIntentEnvelope } from "@wb/transport-sio";

function resetSimulationControlsStore(): void {
  act(() => {
    useSimulationControlsStore.setState({
      isPlaying: true,
      speed: SIM_SPEED_OPTIONS[0]
    });
  });
}

type AckFactory = (intent: TransportIntentEnvelope) => SuccessfulIntentAck;

function createAck(overlay?: { readonly isPaused?: boolean; readonly speedMultiplier?: number }): SuccessfulIntentAck {
  const ack = { ok: true, status: "applied" } as SuccessfulIntentAck;

  if (overlay && (overlay.isPaused !== undefined || overlay.speedMultiplier !== undefined)) {
    (ack as Record<string, unknown>).stateAfter = overlay;
  }

  return ack;
}

function createMockIntentClient(
  ackFactory?: AckFactory
): { client: IntentClient; submit: IntentClient["submit"]; disconnect: IntentClient["disconnect"]; } {
  const submit = vi.fn(async (intent, handlers) => {
    const acknowledgement = ackFactory ? ackFactory(intent) : createAck();
    const result: IntentSubmissionSuccess = { ok: true, ack: acknowledgement };
    handlers?.onResult(result);
    return result;
  });

  const disconnect = vi.fn(async () => undefined);

  return {
    client: {
      submit,
      disconnect
    },
    submit,
    disconnect
  } satisfies { client: IntentClient; submit: IntentClient["submit"]; disconnect: IntentClient["disconnect"]; };
}

async function clickAsync(element: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

function renderWithClient(client: IntentClient): void {
  render(
    <IntentClientProvider client={client}>
      <SimControlBar />
    </IntentClientProvider>
  );
}

function getByExactText(text: string): HTMLElement {
  return screen.getByText((_, element) => element?.textContent === text);
}

describe("SimControlBar", () => {
  afterEach(() => {
    resetSimulationControlsStore();
    clearTelemetrySnapshots();
    vi.restoreAllMocks();
  });

  it("renders controls, metrics, and sticky positioning", () => {
    renderWithClient(createMockIntentClient().client);

    const pauseButton = screen.getByRole("button", { name: workspaceCopy.simControlBar.pause });
    expect(pauseButton).toHaveAttribute("aria-pressed", "true");

    const locale = localeModule.useShellLocale();
    const localeCopy = workspaceCopy.simControlBar.localeLabels[locale];
    const clock = formatClockLabel(DEFAULT_SIMULATION_CLOCK, locale, { day: localeCopy.day });
    const expectedBalance = formatSignedCurrencyPerHour(
      deterministicReadModelSnapshot.economy.balance_per_h,
      locale
    );
    const expectedDelta = formatSignedCurrencyPerHour(
      deterministicReadModelSnapshot.economy.delta_per_h,
      locale
    );

    expect(getByExactText(`${clock.dayLabel} · ${clock.time}`)).toBeInTheDocument();
    expect(getByExactText(expectedBalance)).toBeInTheDocument();
    expect(getByExactText(`${expectedDelta} · ${localeCopy.deltaSuffix}`)).toBeInTheDocument();

    const controlSection = screen.getByLabelText(workspaceCopy.simControlBar.label);
    expect(controlSection).toHaveAttribute("data-position-mobile", "bottom");
    expect(controlSection).toHaveAttribute("data-position-desktop", "top");
  });

  it("advances the clock when telemetry ticks complete", async () => {
    renderWithClient(createMockIntentClient().client);

    expect(screen.getByText(/Day 12 · 06:15/)).toBeInTheDocument();

    act(() => {
      recordTickCompleted({ simTimeHours: 100.25 });
    });

    expect(await screen.findByText(/Day 5 · 04:15/)).toBeInTheDocument();
  });

  it("switches to play state when the pause acknowledgement reports a paused simulation", async () => {
    const { client, submit } = createMockIntentClient(() => createAck({ isPaused: true }));
    renderWithClient(client);

    const pauseButton = screen.getByRole("button", { name: workspaceCopy.simControlBar.pause });
    await clickAsync(pauseButton);

    expect(submit).toHaveBeenCalledWith(
      { type: "simulation.control.pause" },
      expect.objectContaining({ onResult: expect.any(Function) })
    );

    const playButton = screen.getByRole("button", { name: workspaceCopy.simControlBar.play });
    expect(playButton).toHaveAttribute("aria-pressed", "false");
  });

  it("updates the active speed chip when a different multiplier is selected", async () => {
    const { client, submit } = createMockIntentClient();
    renderWithClient(client);

    const targetSpeed = 25;
    const speedButton = screen.getByRole("button", { name: `${String(targetSpeed)}×` });
    await clickAsync(speedButton);

    expect(submit).toHaveBeenCalledWith(
      { type: "simulation.control.speed", multiplier: targetSpeed },
      expect.objectContaining({ onResult: expect.any(Function) })
    );

    expect(speedButton).toHaveAttribute("aria-pressed", "true");

    const defaultSpeedButton = screen.getByRole("button", { name: `${String(SIM_SPEED_OPTIONS[0])}×` });
    expect(defaultSpeedButton).toHaveAttribute("aria-pressed", "false");
  });

  it("formats metrics according to the resolved shell locale", () => {
    const localeSpy = vi.spyOn(localeModule, "useShellLocale").mockReturnValue("de-DE");

    const { client } = createMockIntentClient();
    renderWithClient(client);

    const locale = localeSpy.mock.results[0]?.value === "de-DE" ? "de-DE" : localeModule.useShellLocale();
    const localeCopy = workspaceCopy.simControlBar.localeLabels[locale];
    const clock = formatClockLabel(DEFAULT_SIMULATION_CLOCK, locale, { day: localeCopy.day });
    const expectedBalance = formatSignedCurrencyPerHour(
      deterministicReadModelSnapshot.economy.balance_per_h,
      locale
    );
    const expectedDelta = formatSignedCurrencyPerHour(
      deterministicReadModelSnapshot.economy.delta_per_h,
      locale
    );

    expect(getByExactText(`${clock.dayLabel} · ${clock.time}`)).toBeInTheDocument();
    expect(getByExactText(expectedBalance)).toBeInTheDocument();
    expect(getByExactText(`${expectedDelta} · ${localeCopy.deltaSuffix}`)).toBeInTheDocument();

    localeSpy.mockRestore();
  });
});

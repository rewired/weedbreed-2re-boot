import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimControlBar } from "@ui/components/layout/SimControlBar";
import { workspaceCopy } from "@ui/design/tokens";
import * as localeModule from "@ui/lib/locale";
import { SIM_SPEED_OPTIONS, useSimulationControlsStore } from "@ui/state/simulationControls";
import { IntentClientProvider } from "@ui/transport";
import type { IntentClient, IntentSubmissionSuccess } from "@ui/transport/intentClient";

function resetSimulationControlsStore(): void {
  act(() => {
    useSimulationControlsStore.setState({
      isPlaying: true,
      speed: SIM_SPEED_OPTIONS[0]
    });
  });
}

function createMockIntentClient(): { client: IntentClient; submit: IntentClient["submit"]; disconnect: IntentClient["disconnect"]; } {
  const submit = vi.fn(async (_intent, handlers) => {
    const result: IntentSubmissionSuccess = { ok: true, ack: { ok: true } };
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

describe("SimControlBar", () => {
  afterEach(() => {
    resetSimulationControlsStore();
    vi.restoreAllMocks();
  });

  it("renders controls, metrics, and sticky positioning", () => {
    renderWithClient(createMockIntentClient().client);

    const pauseButton = screen.getByRole("button", { name: workspaceCopy.simControlBar.pause });
    expect(pauseButton).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByText(/Day 12 · 06:15/)).toBeInTheDocument();
    expect(screen.getByText(/€1,250,000.50/)).toBeInTheDocument();
    expect(screen.getByText(/\+€1,425.75 · per hour/)).toBeInTheDocument();

    const controlSection = screen.getByLabelText(workspaceCopy.simControlBar.label);
    expect(controlSection).toHaveAttribute("data-position-mobile", "bottom");
    expect(controlSection).toHaveAttribute("data-position-desktop", "top");
  });

  it("toggles play and pause state when the primary button is pressed", async () => {
    const { client, submit } = createMockIntentClient();
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

    expect(screen.getByText(/Tag 12 · 06:15/)).toBeInTheDocument();
    expect(screen.getByText(/1\.250\.000,50/)).toBeInTheDocument();
    expect(screen.getByText(/\+1\.425,75.*pro Stunde/)).toBeInTheDocument();

    localeSpy.mockRestore();
  });
});

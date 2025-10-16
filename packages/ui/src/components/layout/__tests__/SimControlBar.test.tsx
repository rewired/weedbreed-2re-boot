import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimControlBar } from "@ui/components/layout/SimControlBar";
import { workspaceCopy } from "@ui/design/tokens";
import * as localeModule from "@ui/lib/locale";
import { SIM_SPEED_OPTIONS, useSimulationControlsStore } from "@ui/state/simulationControls";

function resetSimulationControlsStore(): void {
  act(() => {
    useSimulationControlsStore.setState({
      isPlaying: true,
      speed: SIM_SPEED_OPTIONS[0],
      requestPlay: useSimulationControlsStore.getState().requestPlay,
      requestPause: useSimulationControlsStore.getState().requestPause,
      requestStep: useSimulationControlsStore.getState().requestStep,
      requestSpeed: useSimulationControlsStore.getState().requestSpeed
    });
  });
}

describe("SimControlBar", () => {
  afterEach(() => {
    resetSimulationControlsStore();
    vi.restoreAllMocks();
  });

  it("renders controls, metrics, and sticky positioning", () => {
    render(<SimControlBar />);

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
    render(<SimControlBar />);

    const pauseButton = screen.getByRole("button", { name: workspaceCopy.simControlBar.pause });
    await act(async () => {
      fireEvent.click(pauseButton);
    });

    const playButton = screen.getByRole("button", { name: workspaceCopy.simControlBar.play });
    expect(playButton).toHaveAttribute("aria-pressed", "false");
  });

  it("updates the active speed chip when a different multiplier is selected", async () => {
    render(<SimControlBar />);

    const targetSpeed = 25;
    const speedButton = screen.getByRole("button", { name: `${String(targetSpeed)}×` });
    await act(async () => {
      fireEvent.click(speedButton);
    });

    expect(speedButton).toHaveAttribute("aria-pressed", "true");

    const defaultSpeedButton = screen.getByRole("button", { name: `${String(SIM_SPEED_OPTIONS[0])}×` });
    expect(defaultSpeedButton).toHaveAttribute("aria-pressed", "false");
  });

  it("formats metrics according to the resolved shell locale", () => {
    const localeSpy = vi.spyOn(localeModule, "useShellLocale").mockReturnValue("de-DE");

    render(<SimControlBar />);

    expect(screen.getByText(/Tag 12 · 06:15/)).toBeInTheDocument();
    expect(screen.getByText(/1\.250\.000,50/)).toBeInTheDocument();
    expect(screen.getByText(/\+1\.425,75.*pro Stunde/)).toBeInTheDocument();

    localeSpy.mockRestore();
  });
});

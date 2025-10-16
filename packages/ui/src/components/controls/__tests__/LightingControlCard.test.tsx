import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LightingControlCard, type LightingDeviceTileProps } from "@ui/components/controls";
import { type LightScheduleInput } from "@ui/lib/lightScheduleValidation";
import { MICROMOLES_PER_MOLE } from "@engine/constants/lighting.ts";
import { SECONDS_PER_HOUR } from "@engine/constants/simConstants.ts";

const baseSchedule: LightScheduleInput = {
  onHours: 18,
  offHours: 6,
  startHour: 0
};

const baseTargetPpfd = 500;
const measuredPpfd = 480;
const measuredPpfdSecondary = 450;
const invalidOffHours = 5;
const updatedTargetPpfd = 520;
const deviceContribution = 0.5;
const snappedOnHours = 17.25;
const snappedOffHours = 6.75;
const snappedStartHour = 1.25;
const rawOnHours = 17.3;
const rawOffHours = 6.7;
const rawStartHour = 1.2;

function createDeviceTile(overrides: Partial<LightingDeviceTileProps> = {}): LightingDeviceTileProps {
  return {
    id: "device-1",
    name: "Array A",
    contributionFraction01: deviceContribution,
    isEnabled: true,
    onToggle: vi.fn(),
    ...overrides
  } satisfies LightingDeviceTileProps;
}

describe("LightingControlCard", () => {
  it("renders PPFD metrics, updates the target value, and shows a DLI preview", () => {
    const handleTargetChange = vi.fn();

    render(
      <LightingControlCard
        measuredPpfd={measuredPpfd}
        targetPpfd={baseTargetPpfd}
        schedule={baseSchedule}
        onTargetPpfdChange={handleTargetChange}
      />
    );

    expect(screen.getByText(/Measured PPFD/i)).toBeInTheDocument();
    expect(screen.getByText(`${baseTargetPpfd.toString()} µmol`)).toBeInTheDocument();
    const expectedDli = ((baseTargetPpfd * baseSchedule.onHours * SECONDS_PER_HOUR) / MICROMOLES_PER_MOLE).toFixed(1);
    expect(
      screen.getByLabelText(`Daily light integral: ${expectedDli} mol/m²/day`)
    ).toBeInTheDocument();

    const targetInput = screen.getByLabelText(/Target PPFD/i);
    fireEvent.change(targetInput, { target: { value: updatedTargetPpfd.toString() } });

    expect(handleTargetChange).toHaveBeenCalledWith(updatedTargetPpfd);
    expect(screen.getByText(`${updatedTargetPpfd.toString()} µmol`)).toBeInTheDocument();
  });

  it("prevents submitting invalid schedules and surfaces validation messaging", async () => {
    const handleScheduleSubmit = vi.fn();

    render(
      <LightingControlCard
        measuredPpfd={measuredPpfdSecondary}
        targetPpfd={measuredPpfdSecondary}
        schedule={baseSchedule}
        onScheduleSubmit={handleScheduleSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/Lights off/i), { target: { value: invalidOffHours.toString() } });
    fireEvent.click(screen.getByRole("button", { name: /Save schedule/i }));

    await waitFor(() => {
      expect(handleScheduleSubmit).not.toHaveBeenCalled();
    });
    expect(
      await screen.findByText(/Light cycle hours must total 24 per SEC §4.2./i)
    ).toBeInTheDocument();
  });

  it("normalizes to the 15-minute grid when submitting a schedule", () => {
    const handleScheduleSubmit = vi.fn();

    render(
      <LightingControlCard
        measuredPpfd={measuredPpfdSecondary}
        targetPpfd={measuredPpfdSecondary}
        schedule={baseSchedule}
        onScheduleSubmit={handleScheduleSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/Lights on/i), { target: { value: rawOnHours.toString() } });
    fireEvent.change(screen.getByLabelText(/Lights off/i), { target: { value: rawOffHours.toString() } });
    fireEvent.change(screen.getByLabelText(/Start hour/i), { target: { value: rawStartHour.toString() } });

    fireEvent.click(screen.getByRole("button", { name: /Save schedule/i }));

    expect(handleScheduleSubmit).toHaveBeenCalledTimes(1);
    expect(handleScheduleSubmit).toHaveBeenCalledWith({
      onHours: snappedOnHours,
      offHours: snappedOffHours,
      startHour: snappedStartHour
    });
  });

  it("renders device tiles with toggle affordances and contribution percentages", () => {
    const handleToggle = vi.fn();
    const device = createDeviceTile({ onToggle: handleToggle });

    render(
      <LightingControlCard
        measuredPpfd={measuredPpfdSecondary}
        targetPpfd={measuredPpfdSecondary}
        schedule={baseSchedule}
        deviceTiles={[device]}
      />
    );

    const tile = screen.getByText(device.name);
    expect(tile).toBeInTheDocument();
    expect(screen.getByText(`${(deviceContribution * 100).toFixed(0)}% of output`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Disable/i }));
    expect(handleToggle).toHaveBeenCalledWith(false);
  });
});


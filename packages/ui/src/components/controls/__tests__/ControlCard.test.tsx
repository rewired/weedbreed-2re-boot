import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ControlCard } from "@ui/components/controls/ControlCard";

describe("ControlCard", () => {
  it("renders header metrics and hides deviation badge within tolerance", () => {
    const measuredPpfd = 450;
    const targetPpfd = 445;
    const warningDelta = 10;
    const criticalDelta = 25;

    render(
      <ControlCard
        title="Lighting Controls"
        measured={{ label: "Measured", displayValue: "450 µmol", numericValue: measuredPpfd }}
        target={{ label: "Target", displayValue: "445 µmol", numericValue: targetPpfd }}
        deviation={{ warningDelta, criticalDelta }}
      >
        <p>Body slot</p>
      </ControlCard>
    );

    expect(screen.getByRole("heading", { name: "Lighting Controls" })).toBeInTheDocument();
    expect(screen.getByText("450 µmol")).toBeInTheDocument();
    expect(screen.getByText("445 µmol")).toBeInTheDocument();
    expect(screen.queryByText("Δ")).not.toBeInTheDocument();
  });

  it("surfaces a warning deviation badge when the warning delta is exceeded", () => {
    const measuredHumidityPercent = 80;
    const targetHumidityPercent = 60;
    const warningDelta = 15;
    const criticalDelta = 25;

    render(
      <ControlCard
        title="Climate Controls"
        measured={{ label: "Measured", displayValue: "80%", numericValue: measuredHumidityPercent }}
        target={{ label: "Target", displayValue: "60%", numericValue: targetHumidityPercent }}
        deviation={{ warningDelta, criticalDelta }}
      />
    );

    const badge = screen.getByRole("status", { name: /Deviation \+20/ });
    expect(badge).toHaveAttribute("data-variant", "warning");
  });

  it("marks the deviation badge as critical when the critical delta is exceeded", () => {
    const measuredHumidityPercent = 95;
    const targetHumidityPercent = 60;
    const warningDelta = 15;
    const criticalDelta = 30;

    render(
      <ControlCard
        title="Climate Controls"
        measured={{ label: "Measured", displayValue: "95%", numericValue: measuredHumidityPercent }}
        target={{ label: "Target", displayValue: "60%", numericValue: targetHumidityPercent }}
        deviation={{ warningDelta, criticalDelta }}
      />
    );

    const badge = screen.getByRole("status", { name: /Deviation \+35/ });
    expect(badge).toHaveAttribute("data-variant", "critical");
  });

  it("renders device tiles alongside ghost placeholders and emits ghost actions", () => {
    const onGhostAction = vi.fn();
    const measuredPpfd = 450;
    const targetPpfd = 420;
    render(
      <ControlCard
        title="Lighting Controls"
        measured={{ label: "Measured", displayValue: "450 µmol", numericValue: measuredPpfd }}
        target={{ label: "Target", displayValue: "420 µmol", numericValue: targetPpfd }}
        deviceSection={{
          children: <div>Lighting Array A</div>,
          ghostPlaceholders: [
            {
              deviceClassId: "lighting-driver",
              label: "Lighting driver",
              description: "Install a driver to unlock dimming",
              actionLabel: "Plan upgrade"
            }
          ]
        }}
        onGhostAction={onGhostAction}
      />
    );

    const list = screen.getByRole("list");
    expect(within(list).getByText("Lighting Array A")).toBeInTheDocument();
    const placeholder = within(list).getByRole("button", { name: "Lighting driver placeholder" });
    fireEvent.click(placeholder);

    expect(onGhostAction).toHaveBeenCalledWith({
      type: "missing-device-class",
      deviceClassId: "lighting-driver",
      cardTitle: "Lighting Controls",
      placeholderLabel: "Lighting driver"
    });
  });

  it("shows the empty state copy when no tiles or ghost placeholders exist", () => {
    const measuredTemperatureCelsius = 22;
    render(
      <ControlCard
        title="Climate Controls"
        measured={{ label: "Measured", displayValue: "22 °C", numericValue: measuredTemperatureCelsius }}
        deviceSection={{ emptyLabel: "No climate devices have been added." }}
      />
    );

    expect(screen.getByText("No climate devices have been added.")).toBeInTheDocument();
  });
});

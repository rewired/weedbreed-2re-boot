import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ClimateControlCard,
  type ClimateControlCardProps,
  type ClimateControlDeviceTileProps
} from "@ui/components/controls/ClimateControlCard";

const TEMPERATURE_MEASURED_DEFAULT = 25;
const TEMPERATURE_TARGET_DEFAULT = 22;
const TEMPERATURE_WARNING_DELTA = 1;
const TEMPERATURE_CRITICAL_DELTA = 3;
const HVAC_THROUGHPUT_FRACTION = 0.5;
const HVAC_CAPACITY_FRACTION = 0.8;
const HUMIDITY_MEASURED_WARNING = 72;
const HUMIDITY_TARGET = 60;
const HUMIDITY_WARNING_DELTA = 10;
const HUMIDITY_CRITICAL_DELTA = 20;
const TEMPERATURE_MEASURED_CRITICAL = 28;
const CO2_MEASURED = 1400;
const CO2_TARGET = 1000;
const CO2_WARNING_DELTA = 200;
const CO2_CRITICAL_DELTA = 400;
const ACH_MEASURED = 0.8;
const ACH_TARGET = 2;
const ACH_WARNING_DELTA = 0.5;
const ACH_CRITICAL_DELTA = 1;
const numberFormatter = new Intl.NumberFormat("en-US");
const TEMPERATURE_MEASURED_DISPLAY = String(TEMPERATURE_MEASURED_DEFAULT) + " °C";
const TEMPERATURE_TARGET_DISPLAY = String(TEMPERATURE_TARGET_DEFAULT) + " °C";
const TEMPERATURE_CRITICAL_DISPLAY = String(TEMPERATURE_MEASURED_CRITICAL) + " °C";
const HUMIDITY_MEASURED_DISPLAY = String(HUMIDITY_MEASURED_WARNING) + "%";
const HUMIDITY_TARGET_DISPLAY = String(HUMIDITY_TARGET) + "%";
const CO2_MEASURED_DISPLAY = numberFormatter.format(CO2_MEASURED) + " ppm";
const CO2_TARGET_DISPLAY = numberFormatter.format(CO2_TARGET) + " ppm";
const ACH_MEASURED_DISPLAY = String(ACH_MEASURED) + " ACH";
const ACH_TARGET_DISPLAY = String(ACH_TARGET) + " ACH";

function createMetric(
  overrides: Partial<ClimateControlCardProps["temperature"]> = {}
): ClimateControlCardProps["temperature"] {
  return {
    label: "Temperature",
    measured: {
      label: "Measured",
      displayValue: TEMPERATURE_MEASURED_DISPLAY,
      numericValue: TEMPERATURE_MEASURED_DEFAULT
    },
    target: {
      label: "Target",
      displayValue: TEMPERATURE_TARGET_DISPLAY,
      numericValue: TEMPERATURE_TARGET_DEFAULT
    },
    deviation: { warningDelta: TEMPERATURE_WARNING_DELTA, criticalDelta: TEMPERATURE_CRITICAL_DELTA },
    toleranceLabel: "±1 °C allowed",
    ...overrides
  } satisfies ClimateControlCardProps["temperature"];
}

function createDevice(
  overrides: Partial<ClimateControlDeviceTileProps> = {}
): ClimateControlDeviceTileProps {
  return {
    id: "device-1",
    name: "HVAC A",
    throughputFraction01: HVAC_THROUGHPUT_FRACTION,
    capacityFraction01: HVAC_CAPACITY_FRACTION,
    isEnabled: true,
    onToggleEnabled: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    description: "Primary HVAC unit",
    ...overrides
  } satisfies ClimateControlDeviceTileProps;
}

describe("ClimateControlCard", () => {
  it("renders each metric section with deviation badges when tolerances are exceeded", () => {
    render(
      <ClimateControlCard
        temperature={createMetric({
          measured: {
            label: "Measured",
            displayValue: TEMPERATURE_CRITICAL_DISPLAY,
            numericValue: TEMPERATURE_MEASURED_CRITICAL
          }
        })}
        humidity={{
          label: "Relative humidity",
          measured: {
            label: "Measured",
            displayValue: HUMIDITY_MEASURED_DISPLAY,
            numericValue: HUMIDITY_MEASURED_WARNING
          },
          target: { label: "Target", displayValue: HUMIDITY_TARGET_DISPLAY, numericValue: HUMIDITY_TARGET },
          deviation: { warningDelta: HUMIDITY_WARNING_DELTA, criticalDelta: HUMIDITY_CRITICAL_DELTA }
        }}
        co2={{
          label: "CO₂",
          measured: {
            label: "Measured",
            displayValue: CO2_MEASURED_DISPLAY,
            numericValue: CO2_MEASURED
          },
          target: {
            label: "Target",
            displayValue: CO2_TARGET_DISPLAY,
            numericValue: CO2_TARGET
          },
          deviation: { warningDelta: CO2_WARNING_DELTA, criticalDelta: CO2_CRITICAL_DELTA }
        }}
        ach={{
          label: "Air changes per hour",
          measured: { label: "Measured", displayValue: ACH_MEASURED_DISPLAY, numericValue: ACH_MEASURED },
          target: { label: "Target", displayValue: ACH_TARGET_DISPLAY, numericValue: ACH_TARGET },
          deviation: { warningDelta: ACH_WARNING_DELTA, criticalDelta: ACH_CRITICAL_DELTA }
        }}
      />
    );

    const temperatureSection = screen.getByRole("region", { name: "Temperature" });
    expect(within(temperatureSection).getByText("28 °C")).toBeInTheDocument();
    expect(within(temperatureSection).getByRole("status", { name: /Temperature deviation/ })).toHaveAttribute(
      "data-variant",
      "critical"
    );

    const humiditySection = screen.getByRole("region", { name: "Relative humidity" });
    expect(within(humiditySection).getByRole("status", { name: /Relative humidity deviation/ })).toHaveAttribute(
      "data-variant",
      "warning"
    );

    const co2Section = screen.getByRole("region", { name: "CO₂" });
    expect(within(co2Section).getByRole("status", { name: /CO₂ deviation/ })).toBeInTheDocument();

    const achSection = screen.getByRole("region", { name: "Air changes per hour" });
    expect(within(achSection).getByRole("status", { name: /Air changes per hour deviation/ })).toHaveAttribute(
      "data-variant",
      "critical"
    );
  });

  it("renders device tiles per class with throughput and capacity percentages plus action affordances", () => {
    const device = createDevice();
    render(
      <ClimateControlCard
        temperature={createMetric()}
        humidity={createMetric({ label: "Relative humidity" })}
        co2={createMetric({ label: "CO₂" })}
        ach={createMetric({ label: "Air changes per hour" })}
        deviceClasses={[
          {
            classId: "hvac",
            label: "HVAC",
            devices: [device]
          }
        ]}
      />
    );

    const list = screen.getByRole("list");
    const tile = within(list).getByRole("listitem");

    expect(within(tile).getByText("HVAC")).toBeInTheDocument();
    expect(within(tile).getByText("HVAC A")).toBeInTheDocument();
    expect(within(tile).getByText("50%")).toBeInTheDocument();
    expect(within(tile).getByText("80%")).toBeInTheDocument();

    const toggle = within(tile).getByRole("button", { name: "Disable" });
    fireEvent.click(toggle);
    expect(device.onToggleEnabled).toHaveBeenCalledWith(false);

    const move = within(tile).getByRole("button", { name: "Move" });
    fireEvent.click(move);
    expect(device.onMove).toHaveBeenCalledTimes(1);

    const remove = within(tile).getByRole("button", { name: "Remove" });
    fireEvent.click(remove);
    expect(device.onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows ghost placeholders for device classes without tiles", () => {
    render(
      <ClimateControlCard
        temperature={createMetric()}
        humidity={createMetric({ label: "Relative humidity" })}
        co2={createMetric({ label: "CO₂" })}
        ach={createMetric({ label: "Air changes per hour" })}
        deviceClasses={[
          {
            classId: "hvac",
            label: "HVAC",
            devices: [createDevice()]
          }
        ]}
        ghostPlaceholders={[
          {
            deviceClassId: "fans",
            label: "Air circulation",
            description: "Add fans to circulate air"
          },
          {
            deviceClassId: "hvac",
            label: "HVAC",
            description: "Add another HVAC"
          }
        ]}
      />
    );

    const list = screen.getByRole("list");
    expect(within(list).getByRole("button", { name: "Air circulation placeholder" })).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: "HVAC placeholder" })).toBeNull();
  });
});

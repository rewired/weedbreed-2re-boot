import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ZoneDetailPage } from "@ui/pages/ZoneDetailPage";

const STRUCTURE_ID = "structure-evergreen-gardens";
const STRUCTURE_NAME = "Evergreen Gardens";
const ZONE_ID = "zone-flower-1";
const ZONE_NAME = "Flower Room 1";
const CULTIVATION_METHOD_ID = "screen-of-green";

const METRIC_ASSERTIONS = [
  { label: /ppfd/i, placeholder: /Telemetry pending from canopy sensors/i },
  { label: /daily light integral/i, placeholder: /Telemetry pending from canopy sensors/i },
  { label: /air temperature/i, placeholder: /Telemetry pending from climate nodes/i },
  { label: /relative humidity/i, placeholder: /Telemetry pending from climate nodes/i },
  { label: /co₂ concentration/i, placeholder: /Telemetry pending from gas sensors/i },
  { label: /air changes per hour/i, placeholder: /Telemetry pending from airflow monitors/i }
] as const;

const ACTION_ASSERTIONS = [
  { label: /adjust lighting schedule/i, tooltip: /Task 0035/i },
  { label: /schedule irrigation/i, tooltip: /Task 0036/i },
  { label: /plan harvest/i, tooltip: /Task 0032\/0033/i }
] as const;

const EXPECTED_COVERAGE_ITEM_COUNT = 3;
const ZONE_TITLE_HEADING_LEVEL = 2;
const SECTION_HEADING_LEVEL = 3;

describe("ZoneDetailPage", () => {
  it("renders metric placeholders, coverage summaries, and disabled actions", () => {
    render(
      <ZoneDetailPage
        structureId={STRUCTURE_ID}
        structureName={STRUCTURE_NAME}
        zoneId={ZONE_ID}
        zoneName={ZONE_NAME}
        cultivationMethodId={CULTIVATION_METHOD_ID}
      />
    );

    expect(screen.getByRole("heading", { level: ZONE_TITLE_HEADING_LEVEL, name: ZONE_NAME })).toBeInTheDocument();
    expect(screen.getByText(STRUCTURE_NAME)).toBeInTheDocument();
    expect(screen.getByText(/Vegetative stage/i)).toBeInTheDocument();
    expect(screen.getByText(/48 m²/)).toBeInTheDocument();

    METRIC_ASSERTIONS.forEach(({ label, placeholder }) => {
      const heading = screen.getByRole("heading", { level: SECTION_HEADING_LEVEL, name: label });
      const section = heading.closest("section");
      if (!(section instanceof HTMLElement)) {
        throw new Error("Metric card should render inside a section element");
      }
      const metricWithin = within(section);
      expect(metricWithin.getByText("—")).toBeInTheDocument();
      const description = metricWithin.getByText(placeholder);
      expect(description).toBeInTheDocument();
      expect(section.getAttribute("aria-describedby")).toBe(description.id);
    });

    expect(screen.getByRole("heading", { level: SECTION_HEADING_LEVEL, name: /Environmental metrics/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: SECTION_HEADING_LEVEL, name: /Device coverage/i })).toBeInTheDocument();

    const coverageItems = screen.getAllByRole("listitem");
    expect(coverageItems).toHaveLength(EXPECTED_COVERAGE_ITEM_COUNT);
    coverageItems.forEach((item) => {
      expect(within(item).getByText(/^Pending$/i)).toBeInTheDocument();
    });

    ACTION_ASSERTIONS.forEach(({ label, tooltip }) => {
      const button = screen.getByRole("button", { name: label });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", expect.stringMatching(tooltip));
    });
  });
});

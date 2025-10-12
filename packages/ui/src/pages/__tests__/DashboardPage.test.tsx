import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "@ui/pages/DashboardPage";

const MAIN_HEADING_LEVEL = 2;
const CARD_HEADING_LEVEL = 3;
const EXPECTED_EVENT_COUNT = 3;

describe("DashboardPage", () => {
  it("renders placeholder snapshot data", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { level: MAIN_HEADING_LEVEL, name: /operations dashboard/i })).toBeInTheDocument();

    const tickHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /tick rate/i });
    const tickSection = tickHeading.closest("section");
    if (!(tickSection instanceof HTMLElement)) {
      throw new Error("Tick section should be rendered as a section element");
    }
    const tickWithin = within(tickSection);
    expect(tickWithin.getByText(/28 ticks\/hour/i)).toBeInTheDocument();
    expect(tickWithin.getByText(/30 ticks\/hour/i)).toBeInTheDocument();

    const clockHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /simulation time/i });
    const clockSection = clockHeading.closest("section");
    if (!(clockSection instanceof HTMLElement)) {
      throw new Error("Simulation time card should be rendered as a section element");
    }
    const clockWithin = within(clockSection);
    expect(clockWithin.getByText(/^12$/)).toBeInTheDocument();
    expect(clockWithin.getByText(/SEC §4\.2 cadence · 06:15/)).toBeInTheDocument();

    const costHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /daily cost rollup/i });
    const costSection = costHeading.closest("section");
    if (!(costSection instanceof HTMLElement)) {
      throw new Error("Daily cost card should be rendered as a section element");
    }
    const costWithin = within(costSection);
    expect(costWithin.getByText(/126\.5 cost\/hr/)).toBeInTheDocument();
    expect(costWithin.getByText(/48\.25 cost\/hr/)).toBeInTheDocument();
    expect(costWithin.getByText(/32\.1 cost\/hr/)).toBeInTheDocument();

    const resourcesHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /energy & water/i });
    const resourcesSection = resourcesHeading.closest("section");
    if (!(resourcesSection instanceof HTMLElement)) {
      throw new Error("Resource card should be rendered as a section element");
    }
    const resourcesWithin = within(resourcesSection);
    expect(resourcesWithin.getByText(/480 kWh\/day/)).toBeInTheDocument();
    expect(resourcesWithin.getByText(/28\.8 cost\/hr/)).toBeInTheDocument();
    expect(resourcesWithin.getByText(/12 m³\/day/)).toBeInTheDocument();
    expect(resourcesWithin.getByText(/3\.4 cost\/hr/)).toBeInTheDocument();

    const eventItems = screen.getAllByRole("listitem");
    expect(eventItems).toHaveLength(EXPECTED_EVENT_COUNT);
    expect(eventItems[0]).toHaveTextContent(/Lights schedule change staged/i);
    expect(eventItems[1]).toHaveTextContent(/Nutrient solution top-off planned/i);
    expect(eventItems[2]).toHaveTextContent(/Harvest readiness review queued/i);
  });
});

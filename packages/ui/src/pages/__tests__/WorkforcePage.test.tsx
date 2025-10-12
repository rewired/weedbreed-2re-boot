import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkforcePage } from "@ui/pages/WorkforcePage";

const MAIN_HEADING_LEVEL = 2;
const CARD_HEADING_LEVEL = 3;
const DEFAULT_WARNING_COUNT = 2;

describe("WorkforcePage", () => {
  it("renders placeholder KPI content", () => {
    render(<WorkforcePage />);

    expect(
      screen.getByRole("heading", { level: MAIN_HEADING_LEVEL, name: /labour kpi overview/i })
    ).toBeInTheDocument();

    const headcountHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /headcount overview/i });
    const headcountSection = headcountHeading.closest("section");
    if (!(headcountSection instanceof HTMLElement)) {
      throw new Error("Headcount KPI should render inside a section element");
    }
    const headcountWithin = within(headcountSection);
    expect(headcountWithin.getByText(/^28$/)).toBeInTheDocument();
    expect(headcountWithin.getByText(/^24$/)).toBeInTheDocument();
    expect(headcountWithin.getByText(/^3$/)).toBeInTheDocument();
    expect(headcountWithin.getByText(/^2$/)).toBeInTheDocument();

    const roleMixHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /role mix/i });
    const roleMixSection = roleMixHeading.closest("section");
    if (!(roleMixSection instanceof HTMLElement)) {
      throw new Error("Role mix KPI should render inside a section element");
    }
    const roleMixWithin = within(roleMixSection);
    expect(roleMixWithin.getByText(/Cultivation technicians/i)).toBeInTheDocument();
    expect(roleMixWithin.getByText(/12 · 43%/i)).toBeInTheDocument();
    expect(roleMixWithin.getByText(/Post-processing/i)).toBeInTheDocument();

    const utilisationHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /utilisation/i });
    const utilisationSection = utilisationHeading.closest("section");
    if (!(utilisationSection instanceof HTMLElement)) {
      throw new Error("Utilisation KPI should render inside a section element");
    }
    const utilisationWithin = within(utilisationSection);
    expect(utilisationWithin.getByText(/82%/)).toBeInTheDocument();
    expect(utilisationWithin.getByText(/85%/)).toBeInTheDocument();
    expect(
      utilisationWithin.getByText(/Vegetative care shifts nearing overtime thresholds/i)
    ).toBeInTheDocument();

    const warningsHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /active warnings/i });
    const warningsSection = warningsHeading.closest("section");
    if (!(warningsSection instanceof HTMLElement)) {
      throw new Error("Warnings card should render inside a section element");
    }
    const warningsWithin = within(warningsSection);
    const warningList = warningsWithin.getByRole("list", { name: /workforce warnings/i });
    const warningItems = within(warningList).getAllByRole("listitem");
    expect(warningItems).toHaveLength(DEFAULT_WARNING_COUNT);
    expect(warningItems[0]).toHaveTextContent(/Vegetative care staffing running at 92%/i);
    expect(warningItems[1]).toHaveTextContent(/Preventive maintenance window overlaps/i);
  });

  it("renders fallback text when no warnings are present", () => {
    render(<WorkforcePage overrides={{ warnings: [] }} />);

    expect(
      screen.getByText(/All workforce systems nominal\. No warnings registered for the current simulation hour\./i)
    ).toBeInTheDocument();
  });
});

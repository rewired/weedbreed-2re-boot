import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { StructurePage } from "@ui/pages/StructurePage";
import { resetReadModelStore } from "@ui/state/readModels";

const HEADER_HEADING_LEVEL = 2;
const SECTION_HEADING_LEVEL = 3;

describe("StructurePage", () => {
  beforeEach(() => {
    resetReadModelStore();
  });

  it("renders header metrics, tariffs, and pest indicators", () => {
    render(<StructurePage structureId="structure-green-harbor" />);

    expect(
      screen.getByRole("heading", { level: HEADER_HEADING_LEVEL, name: /green harbor/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Hamburg/i)).toBeInTheDocument();

    const floorAreaCard = screen.getByText(/floor area/i).closest("div");
    if (!(floorAreaCard instanceof HTMLElement)) {
      throw new Error("Floor area card should be rendered as a div element");
    }
    const floorWithin = within(floorAreaCard);
    expect(floorWithin.getByText(/900 m²/i)).toBeInTheDocument();
    expect(floorWithin.getByText(/Free: 300 m²/i)).toBeInTheDocument();

    const volumeCard = screen.getByText(/volume/i).closest("div");
    if (!(volumeCard instanceof HTMLElement)) {
      throw new Error("Volume card should be rendered as a div element");
    }
    const volumeWithin = within(volumeCard);
    expect(volumeWithin.getByText(/2,700 m³/i)).toBeInTheDocument();
    expect(volumeWithin.getByText(/Free: 900 m³/i)).toBeInTheDocument();
    expect(screen.getByText(/0.42 per kWh/)).toBeInTheDocument();
    expect(screen.getByText(/3.4 per m³/)).toBeInTheDocument();
    expect(screen.getByText(/Upcoming treatments: 1/)).toBeInTheDocument();
  });

  it("visualises capacity tiles with warning badges when limits are breached", () => {
    render(<StructurePage structureId="structure-green-harbor" />);

    const capacitySection = screen
      .getByRole("heading", { level: SECTION_HEADING_LEVEL, name: /capacity & coverage/i })
      .closest("section");
    if (!(capacitySection instanceof HTMLElement)) {
      throw new Error("Capacity section should be rendered as a section element");
    }

    const capacityWithin = within(capacitySection);
    expect(capacityWithin.getByText(/Lighting coverage/i)).toBeInTheDocument();
    expect(capacityWithin.getByText(/HVAC & airflow/i)).toBeInTheDocument();
    expect(capacityWithin.getByText(/Power draw/i)).toBeInTheDocument();

    const warningBadge = capacityWithin.getAllByText(/Needs attention/i);
    expect(warningBadge.length).toBeGreaterThan(0);
  });

  it("lists rooms with duplicate and move entry points and workforce snapshot", () => {
    render(<StructurePage structureId="structure-green-harbor" />);

    const roomsSection = screen
      .getByRole("heading", { level: SECTION_HEADING_LEVEL, name: /rooms overview/i })
      .closest("section");
    if (!(roomsSection instanceof HTMLElement)) {
      throw new Error("Rooms section should be rendered as a section element");
    }

    const roomsWithin = within(roomsSection);
    expect(roomsWithin.getAllByRole("button", { name: /duplicate room/i })).not.toHaveLength(0);
    expect(roomsWithin.getAllByRole("button", { name: /move device/i })).not.toHaveLength(0);
    expect(roomsWithin.getAllByRole("button", { name: /capacity advisor/i })).not.toHaveLength(0);

    const workforceHeading = screen.getByRole("heading", {
      level: SECTION_HEADING_LEVEL,
      name: /workforce snapshot/i
    });
    const workforceSection = workforceHeading.closest("section");
    if (!(workforceSection instanceof HTMLElement)) {
      throw new Error("Workforce section should be rendered as a section element");
    }

    const workforceWithin = within(workforceSection);
    expect(workforceWithin.getByText(/Open tasks: 2/)).toBeInTheDocument();
    expect(workforceWithin.getByText(/Leonie Krause/)).toBeInTheDocument();
  });
});


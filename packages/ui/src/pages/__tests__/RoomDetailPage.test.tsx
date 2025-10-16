import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { RoomDetailPage } from "@ui/pages/RoomDetailPage";
import { resetReadModelStore } from "@ui/state/readModels";

const STRUCTURE_ID = "structure-green-harbor";
const ROOM_ID = "room-veg-a";
const SECTION_HEADING_LEVEL = 3;
const EXPECTED_BREADCRUMB_COUNT = 3;

describe("RoomDetailPage", () => {
  beforeEach(() => {
    resetReadModelStore();
  });

  it("renders header, zones list, climate snapshot, devices, and actions without router context", () => {
    render(<RoomDetailPage structureId={STRUCTURE_ID} roomId={ROOM_ID} />);

    const renameInput = screen.getByLabelText(/room name/i);
    expect(renameInput).toHaveValue("Vegetative Bay A");
    expect(screen.getByRole("button", { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByText(/Purpose/i)).toBeInTheDocument();
    expect(screen.getByText(/Baseline ACH/i)).toBeInTheDocument();
    const baselineTargets = screen.getAllByText(/Target 6\.0 ACH/i);
    expect(baselineTargets.length).toBeGreaterThan(0);

    const vegA1 = screen.getByText(/Veg A-1/i);
    const vegA1Card = vegA1.closest("li");
    if (!vegA1Card) {
      throw new Error("Veg A-1 card not found");
    }
    expect(within(vegA1Card).getByText(/Ready to harvest/i)).toBeInTheDocument();
    expect(within(vegA1Card).getByText(/Lighting coverage at 88%/i)).toBeInTheDocument();

    const vegA2 = screen.getByText(/Veg A-2/i);
    const vegA2Card = vegA2.closest("li");
    if (!vegA2Card) {
      throw new Error("Veg A-2 card not found");
    }
    expect(within(vegA2Card).getByText(/Active issues: 1/i)).toBeInTheDocument();
    expect(within(vegA2Card).getByText(/Treatments scheduled: 1/i)).toBeInTheDocument();

    const temperatureCard = screen.getByLabelText(/Air temperature/i);
    expect(within(temperatureCard).getByText(/Within range/i)).toBeInTheDocument();

    const achCard = screen.getByLabelText(/Air changes per hour$/i);
    expect(within(achCard).getByText(/Needs attention/i)).toBeInTheDocument();
    expect(within(achCard).getByText(/5\.2 ACH/i)).toBeInTheDocument();

    const deviceSection = screen
      .getByRole("heading", { level: SECTION_HEADING_LEVEL, name: /Device allocations/i })
      .closest("section");
    if (!deviceSection) {
      throw new Error("Device section not rendered as section");
    }
    const deviceWithin = within(deviceSection);
    expect(deviceWithin.getByText(/LumenMax 320/i)).toBeInTheDocument();
    const moveDeviceButtons = deviceWithin.getAllByRole("button", { name: /^Move device$/i });
    expect(moveDeviceButtons.length).toBeGreaterThan(0);
    moveDeviceButtons.forEach((button) => {
      expect(button).toHaveAttribute("title", expect.stringMatching(/Task 8000/i));
    });
    const removeDeviceButtons = deviceWithin.getAllByRole("button", { name: /^Remove device$/i });
    expect(removeDeviceButtons.length).toBeGreaterThan(0);
    removeDeviceButtons.forEach((button) => {
      expect(button).toHaveAttribute("title", expect.stringMatching(/Task 8001/i));
    });

    const timelineSection = screen
      .getByRole("heading", { level: SECTION_HEADING_LEVEL, name: /Room activity & actions/i })
      .closest("section");
    if (!timelineSection) {
      throw new Error("Timeline section not rendered as section");
    }
    const timelineWithin = within(timelineSection);
    expect(timelineWithin.getByText(/Drain-to-waste flush/i)).toBeInTheDocument();
    const createZoneButton = timelineWithin.getByRole("button", { name: /Create zone/i });
    expect(createZoneButton).toHaveAttribute("title", expect.stringMatching(/Task 7000/i));
  });

  it("renders breadcrumb and zone links when router context is available", () => {
    render(
      <MemoryRouter initialEntries={["/structures/structure-green-harbor/rooms/room-veg-a"]}>
        <RoomDetailPage structureId={STRUCTURE_ID} roomId={ROOM_ID} />
      </MemoryRouter>
    );

    const breadcrumbNav = screen.getByLabelText(/breadcrumb/i);
    const breadcrumbLinks = within(breadcrumbNav).getAllByRole("link");
    expect(breadcrumbLinks).toHaveLength(EXPECTED_BREADCRUMB_COUNT);
    expect(breadcrumbLinks[0]).toHaveAttribute("href", "/structures");
    expect(breadcrumbLinks[1]).toHaveAttribute("href", "/structures/structure-green-harbor");
    expect(breadcrumbLinks[2]).toHaveAttribute("href", "/structures/structure-green-harbor/rooms/room-veg-a");

    const zoneLink = screen.getByRole("link", { name: /Veg A-1/i });
    expect(zoneLink).toHaveAttribute("href", "/structures/structure-green-harbor/zones/zone-veg-a-1");
  });
});


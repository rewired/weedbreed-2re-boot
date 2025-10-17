import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RoomDetailPage } from "@ui/pages/RoomDetailPage";
import { applyReadModelSnapshot, resetReadModelStore } from "@ui/state/readModels";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import { resetIntentState } from "@ui/state/intents";
import { clearTelemetrySnapshots } from "@ui/state/telemetry";
import { buildStructureCapacityAdvisorPath } from "@ui/lib/navigation";
import type { ReadModelSnapshot } from "@ui/state/readModels.types";

type DeepMutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? DeepMutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T;

const STRUCTURE_ID = "structure-green-harbor";
const ROOM_ID = "room-veg-a";
const SECTION_HEADING_LEVEL = 3;
const EXPECTED_BREADCRUMB_COUNT = 3;

describe("RoomDetailPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    resetReadModelStore();
    resetIntentState();
    clearTelemetrySnapshots();
  });

  it("renders header, zones list, climate snapshot, devices, and actions without router context", () => {
    render(<RoomDetailPage structureId={STRUCTURE_ID} roomId={ROOM_ID} />);

    const renameButton = screen.getByRole("button", { name: /rename/i });
    expect(renameButton).toBeInTheDocument();
    fireEvent.click(renameButton);
    const renameInput = screen.getByLabelText(/room name/i);
    expect(renameInput).toHaveValue("Vegetative Bay A");
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
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

    const climateSection = screen.getByRole("heading", { name: /Climate & airflow snapshot/i }).closest("section");
    if (!climateSection) {
      throw new Error("Climate snapshot section not found");
    }
    const climateWithin = within(climateSection);

    const temperatureCard = climateWithin.getByLabelText(/Air temperature/i);
    expect(within(temperatureCard).getByText(/Within range/i)).toBeInTheDocument();

    const achCard = climateWithin.getByLabelText(/Air changes per hour/i);
    expect(within(achCard).getByText(/Needs attention/i)).toBeInTheDocument();
    expect(within(achCard).getByText(/5\.2 ACH/i)).toBeInTheDocument();

    const lightingControlCard = screen.getByRole("heading", { name: /Lighting controls/i }).closest("section");
    if (!lightingControlCard) {
      throw new Error("Lighting control card missing");
    }
    const lightingControlWithin = within(lightingControlCard);
    expect(lightingControlWithin.getByText(/Save schedule/i)).toBeInTheDocument();

    const climateControlCard = screen.getByRole("heading", { name: /Climate controls/i }).closest("section");
    if (!climateControlCard) {
      throw new Error("Climate control card missing");
    }
    const climateControlWithin = within(climateControlCard);
    expect(climateControlWithin.getByText(/Air changes per hour/i)).toBeInTheDocument();

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

  it("navigates to the capacity advisor when lighting ghosts are activated", () => {
    const mutatedSnapshot = structuredClone(
      deterministicReadModelSnapshot
    ) as DeepMutable<ReadModelSnapshot>;
    const structure = mutatedSnapshot.structures.find((candidate) => candidate.id === STRUCTURE_ID);
    if (!structure) {
      throw new Error("Structure not found in deterministic snapshot");
    }
    const room = structure.rooms.find((candidate) => candidate.id === ROOM_ID);
    if (!room) {
      throw new Error("Room not found in deterministic snapshot");
    }

    room.devices = room.devices.filter((device) => device.class !== "lighting");

    applyReadModelSnapshot(mutatedSnapshot as ReadModelSnapshot);

    render(<RoomDetailPage structureId={STRUCTURE_ID} roomId={ROOM_ID} />);

    const placeholder = screen.getByRole("button", { name: /Lighting coverage placeholder/i });
    fireEvent.click(placeholder);

    expect(navigateMock).toHaveBeenCalledWith(buildStructureCapacityAdvisorPath(STRUCTURE_ID));
  });
});


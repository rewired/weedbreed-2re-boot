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
import { ZoneDetailPage } from "@ui/pages/ZoneDetailPage";
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
const ZONE_ID = "zone-veg-a-1";
const MIN_EXPECTED_SPARKLINES = 3;

describe("ZoneDetailPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    resetReadModelStore();
    resetIntentState();
    clearTelemetrySnapshots();
  });

  it("renders zone header, KPIs, pest context, climate, devices, and actions", () => {
    render(<ZoneDetailPage structureId={STRUCTURE_ID} roomId={ROOM_ID} zoneId={ZONE_ID} />);

    const zoneHeading = screen.getByRole("heading", { name: /Veg A-1/i });
    expect(zoneHeading).toBeInTheDocument();
    const zoneHeader = zoneHeading.closest("header");
    if (!zoneHeader) {
      throw new Error("Zone heading is not wrapped in a header element");
    }
    const zoneHeaderWithin = within(zoneHeader);
    expect(screen.getByText(/Green Harbor/i)).toBeInTheDocument();
    expect(screen.getByText(/Northern Lights/i)).toBeInTheDocument();
    expect(zoneHeaderWithin.getByText(/Vegetative stage/i)).toBeInTheDocument();
    expect(screen.getByText(/Max 150/i)).toBeInTheDocument();

    const cultivationLabel = screen.getByText(/Sea Of Green/i);
    expect(cultivationLabel.previousElementSibling).toHaveTextContent(/Cultivation method/i);
    const irrigationLabel = screen.getByText(/Drip Inline/i);
    expect(irrigationLabel.previousElementSibling).toHaveTextContent(/Irrigation method/i);

    const kpiSection = screen.getByRole("heading", { name: /Plant health KPIs/i }).closest("section");
    if (!kpiSection) {
      throw new Error("KPI section not rendered as section");
    }
    const kpiWithin = within(kpiSection);
    expect(kpiWithin.getByLabelText(/Plant health metric/i)).toBeInTheDocument();
    const sparkline = kpiWithin.getAllByTestId("sparkline-chart");
    expect(sparkline.length).toBeGreaterThanOrEqual(MIN_EXPECTED_SPARKLINES);
    expect(kpiWithin.getByText(/Median 9\d%/i)).toBeInTheDocument();

    const pestSection = screen.getByRole("heading", { name: /Pest & disease readiness/i }).closest("section");
    if (!pestSection) {
      throw new Error("Pest section missing");
    }
    const pestWithin = within(pestSection);
    const statusList = pestWithin.getByLabelText("Pest counts");
    const statusItems = within(statusList).getAllByRole("listitem");
    expect(within(statusItems[0]).getByText(/0$/)).toBeInTheDocument();
    expect(within(statusItems[1]).getByText(/1$/)).toBeInTheDocument();
    expect(pestWithin.getByText(/Free plants/i).nextElementSibling).toHaveTextContent(/6/);
    expect(pestWithin.getByText(/Density/i).nextElementSibling).toHaveTextContent(/0\.8/);
    expect(pestWithin.getAllByText(/Day \d/)).not.toHaveLength(0);

    const climateSection = screen.getByRole("heading", { name: /Climate snapshot/i }).closest("section");
    if (!climateSection) {
      throw new Error("Climate section missing");
    }
    const climateWithin = within(climateSection);
    expect(climateWithin.getByText(/Temperature/i)).toBeInTheDocument();
    expect(climateWithin.getAllByText(/Target/i).length).toBeGreaterThan(0);

    const achCard = climateWithin.getByLabelText(/Air changes per hour/i);
    expect(within(achCard).getByText(/5\.10 ACH/i)).toBeInTheDocument();
    expect(within(achCard).getByText(/Target 6\.00 ACH/i)).toBeInTheDocument();
    expect(within(achCard).getByText(/Check immediately/i)).toBeInTheDocument();

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
    expect(climateControlWithin.getByRole("status", { name: /Deviation/i })).toBeInTheDocument();

    const deviceSection = screen.getByRole("heading", { name: /Device coverage/i }).closest("section");
    if (!deviceSection) {
      throw new Error("Device section missing");
    }
    const deviceWithin = within(deviceSection);
    const lightingGroup = deviceWithin.getByLabelText(/Lighting devices/i);
    const lightingWithin = within(lightingGroup);
    expect(lightingWithin.getByRole("heading", { name: /Lighting/i })).toBeInTheDocument();
    expect(lightingWithin.getByText(/LumenMax 320/i)).toBeInTheDocument();
    expect(lightingWithin.getByText(/coverage below target/i)).toBeInTheDocument();

    const actionsSection = screen.getByRole("heading", { name: /Zone operations/i }).closest("section");
    if (!actionsSection) {
      throw new Error("Actions section missing");
    }
    const actionsWithin = within(actionsSection);
    const harvestButton = actionsWithin.getByRole("button", { name: /Harvest zone/i });
    expect(harvestButton).not.toBeDisabled();
    const cullButton = actionsWithin.getByRole("button", { name: /Cull plants/i });
    expect(cullButton).not.toBeDisabled();
    const sowButton = actionsWithin.getByRole("button", { name: /Sow seedlings/i });
    expect(sowButton).toBeDisabled();
    expect(sowButton).toHaveAttribute("title", expect.stringMatching(/requires an empty zone/i));

    const deviceControlButtons = actionsWithin.getAllByRole("button", { name: /Adjust|Tune/i });
    expect(deviceControlButtons.length).toBeGreaterThan(0);
    deviceControlButtons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", expect.stringMatching(/Task/i));
    });
  });

  it("navigates to the capacity advisor when a climate ghost placeholder is activated", () => {
    const mutatedSnapshot = structuredClone(
      deterministicReadModelSnapshot
    ) as DeepMutable<ReadModelSnapshot>;
    const structure = mutatedSnapshot.structures.find((candidate) => candidate.id === STRUCTURE_ID);
    if (!structure) {
      throw new Error("Structure not found in deterministic snapshot");
    }
    structure.devices = structure.devices.filter((device) => device.class !== "climate");

    applyReadModelSnapshot(mutatedSnapshot as ReadModelSnapshot);

    render(<ZoneDetailPage structureId={STRUCTURE_ID} roomId={ROOM_ID} zoneId={ZONE_ID} />);

    const placeholder = screen.getByRole("button", { name: /Climate placeholder/i });
    fireEvent.click(placeholder);

    expect(navigateMock).toHaveBeenCalledWith(buildStructureCapacityAdvisorPath(STRUCTURE_ID));
  });
});


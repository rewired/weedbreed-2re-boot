import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "@ui/pages/DashboardPage";
import { createTelemetryBinder } from "@ui/transport/telemetryBinder";
import { createSocketMock } from "@ui/test-utils/socketMock";
import { resetTelemetryStore } from "@ui/state/telemetry";
import { resetReadModelStore } from "@ui/state/readModels";

const MAIN_HEADING_LEVEL = 2;
const CARD_HEADING_LEVEL = 3;
const EXPECTED_EVENT_COUNT = 2;

const SAMPLE_TARGET_TICKS = 42;
const SAMPLE_ACTUAL_TICKS = 41.2;
const SAMPLE_ENERGY_KWH = 512.5;
const SAMPLE_ENERGY_COST = 36.4;
const SAMPLE_WATER_M3 = 14.25;
const SAMPLE_WATER_COST = 4.8;
const SAMPLE_SIM_TIME = 75.5;

function createBinder(socket: ReturnType<typeof createSocketMock>) {
  const logger = { warn: vi.fn(), error: vi.fn() } as const;
  interface MockTimeoutHandle {
    readonly id: string;
  }
  const timers = {
    setTimeout: vi.fn<(handler: () => void, timeout: number) => MockTimeoutHandle>((handler, timeout) => {
      void handler;
      void timeout;
      return { id: "mock-timeout" };
    }),
    clearTimeout: vi.fn<(handle: MockTimeoutHandle | null) => void>(() => undefined)
  };

  return createTelemetryBinder(
    { baseUrl: "http://localhost:4444" },
    {
      createSocket: () => socket,
      logger,
      timers,
      rngFactory: () => () => 0.5
    }
  );
}

describe("DashboardPage", () => {
  let socket = createSocketMock();
  let binder = createBinder(socket);

  function connectBinder() {
    act(() => {
      binder.connect();
    });

    act(() => {
      socket.emit("connect");
    });
  }

  beforeEach(() => {
    socket = createSocketMock();
    binder = createBinder(socket);
    act(() => {
      resetTelemetryStore();
      resetReadModelStore();
    });
  });

  afterEach(async () => {
    await act(async () => {
      await binder.disconnect();
    });
    act(() => {
      resetTelemetryStore();
      resetReadModelStore();
    });
  });

  it("renders read-model economy rollups and updates tick telemetry", async () => {
    connectBinder();
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { level: MAIN_HEADING_LEVEL, name: /operations dashboard/i })
    ).toBeInTheDocument();

    const costHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /daily cost rollup/i });
    const costSection = costHeading.closest("section");
    if (!(costSection instanceof HTMLElement)) {
      throw new Error("Daily cost card should be rendered as a section element");
    }
    const costWithin = within(costSection);
    expect(costWithin.getByText(/€987\.40 \/hr/)).toBeInTheDocument();
    expect(costWithin.getByText(/€420\.25 \/hr/)).toBeInTheDocument();
    expect(costWithin.getByText(/€185\.60 \/hr/)).toBeInTheDocument();

    act(() => {
      socket.emit("telemetry:event", {
        topic: "telemetry.tick.completed.v1",
        payload: {
          simTimeHours: SAMPLE_SIM_TIME,
          targetTicksPerHour: SAMPLE_TARGET_TICKS,
          actualTicksPerHour: SAMPLE_ACTUAL_TICKS
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/41\.2 ticks\/hour/)).toBeInTheDocument();
      expect(screen.getByText(/42 ticks\/hour/)).toBeInTheDocument();
    });
  });

  it("surfaces resource telemetry for energy and water", async () => {
    connectBinder();
    render(<DashboardPage />);

    const resourcesHeading = screen.getByRole("heading", { level: CARD_HEADING_LEVEL, name: /energy & water/i });
    const resourcesSection = resourcesHeading.closest("section");
    if (!(resourcesSection instanceof HTMLElement)) {
      throw new Error("Resource card should be rendered as a section element");
    }
    const resourcesWithin = within(resourcesSection);
    expect(resourcesWithin.getAllByText("—")).toHaveLength(4);

    act(() => {
      socket.emit("telemetry:event", {
        topic: "telemetry.tick.completed.v1",
        payload: {
          simTimeHours: SAMPLE_SIM_TIME,
          targetTicksPerHour: SAMPLE_TARGET_TICKS,
          actualTicksPerHour: SAMPLE_ACTUAL_TICKS,
          energyKwhPerDay: SAMPLE_ENERGY_KWH,
          energyCostPerHour: SAMPLE_ENERGY_COST,
          waterCubicMetersPerDay: SAMPLE_WATER_M3,
          waterCostPerHour: SAMPLE_WATER_COST
        }
      });
    });

    await waitFor(() => {
      expect(resourcesWithin.getByText(/512\.5 kWh\/day/)).toBeInTheDocument();
      expect(resourcesWithin.getByText(/€36\.40 \/hr/)).toBeInTheDocument();
      expect(resourcesWithin.getByText(/14\.3 m³\/day/)).toBeInTheDocument();
      expect(resourcesWithin.getByText(/€4\.80 \/hr/)).toBeInTheDocument();
    });
  });

  it("maps simulation incidents to the event stream and updates relative timing", async () => {
    connectBinder();
    render(<DashboardPage />);

    const eventItems = screen.getAllByRole("listitem");
    expect(eventItems).toHaveLength(EXPECTED_EVENT_COUNT);
    expect(eventItems[0]).toHaveTextContent(/Lighting demand is approaching the configured tariff buffer/i);
    expect(eventItems[0]).toHaveTextContent(/T-02:00/);
    expect(eventItems[1]).toHaveTextContent(/Vegetative inspections are queued beyond the 24h target window/i);
    expect(eventItems[1]).toHaveTextContent(/T-04:00/);

    act(() => {
      socket.emit("telemetry:event", {
        topic: "telemetry.tick.completed.v1",
        payload: {
          simTimeHours: SAMPLE_SIM_TIME,
          targetTicksPerHour: SAMPLE_TARGET_TICKS,
          actualTicksPerHour: SAMPLE_ACTUAL_TICKS
        }
      });
    });

    await waitFor(() => {
      expect(eventItems[0]).toHaveTextContent(/T-05:00/);
      expect(eventItems[1]).toHaveTextContent(/T-07:00/);
    });
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelemetryBinder } from "@ui/transport/telemetryBinder";
import {
  resetTelemetryStore,
  useTelemetryTick,
  useZoneSnapshot,
  useWorkforceKpiTelemetry,
  useHarvestTelemetry,
  useTelemetryConnection
} from "@ui/state/telemetry";
import { createSocketMock } from "@ui/test-utils/socketMock";

const SAMPLE_ZONE_ID = "zone-integration-test";
const SAMPLE_SIM_TIME_HOURS = 91.5;
const SAMPLE_TARGET_TICKS_PER_HOUR = 30;
const SAMPLE_ACTUAL_TICKS_PER_HOUR = 28;
const SAMPLE_ZONE_SIM_TIME = 88;
const SAMPLE_TASKS_COMPLETED = 12;
const SAMPLE_FRESH_WEIGHT = 12.4;
const SAMPLE_MOISTURE01 = 0.62;
const SAMPLE_QUALITY01 = 0.88;
const SAMPLE_RNG_BASELINE = 0.5;

function TelemetryProbe({ zoneId }: { readonly zoneId: string }) {
  const tick = useTelemetryTick();
  const zone = useZoneSnapshot(zoneId);
  const workforce = useWorkforceKpiTelemetry();
  const harvests = useHarvestTelemetry();
  const connection = useTelemetryConnection();

  return (
    <div>
      <span data-testid="connection-status">{connection.status}</span>
      <span data-testid="connection-reason">{connection.lastDisconnectReason ?? ""}</span>
      <span data-testid="tick-sim-time">{tick?.simTimeHours ?? ""}</span>
      <span data-testid="tick-target">{tick?.targetTicksPerHour ?? ""}</span>
      <span data-testid="zone-sim-time">{zone?.simTime ?? ""}</span>
      <span data-testid="workforce-tasks">{workforce?.tasksCompleted ?? ""}</span>
      <span data-testid="harvest-count">{harvests.length}</span>
    </div>
  );
}

describe("telemetry integration", () => {
  afterEach(() => {
    act(() => {
      resetTelemetryStore();
    });
  });

  it("routes binder events into selectors and resets on reconnect", async () => {
    const socket = createSocketMock();
    const createSocket = vi.fn(() => socket);
    const logger = { warn: vi.fn() } as const;
    interface MockTimeoutHandle {
      readonly id: string;
    }
    let scheduledReconnect: (() => void) | undefined;
    const setTimeout = vi.fn<(handler: () => void, timeout: number) => MockTimeoutHandle>((handler) => {
      scheduledReconnect = handler;
      return { id: "mock-timeout" };
    });
    const clearTimeout = vi.fn<(handle: MockTimeoutHandle | null) => void>(() => {
      scheduledReconnect = undefined;
    });
    const binder = createTelemetryBinder(
      { baseUrl: "http://localhost:4444" },
      {
        createSocket,
        logger,
        timers: { setTimeout, clearTimeout },
        rngFactory: () => () => SAMPLE_RNG_BASELINE
      }
    );

    render(<TelemetryProbe zoneId={SAMPLE_ZONE_ID} />);

    expect(screen.getByTestId("connection-status")).toHaveTextContent("disconnected");

    act(() => {
      binder.connect();
    });

    await waitFor(() => {
      expect(screen.getByTestId("connection-status")).toHaveTextContent("connecting");
    });

    act(() => {
      socket.emit("connect");
    });

    await waitFor(() => {
      expect(screen.getByTestId("connection-status")).toHaveTextContent("connected");
    });

    act(() => {
      socket.emit("telemetry:event", {
        topic: "telemetry.tick.completed.v1",
        payload: {
          simTimeHours: SAMPLE_SIM_TIME_HOURS,
          targetTicksPerHour: SAMPLE_TARGET_TICKS_PER_HOUR,
          actualTicksPerHour: SAMPLE_ACTUAL_TICKS_PER_HOUR
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("tick-sim-time")).toHaveTextContent(String(SAMPLE_SIM_TIME_HOURS));
      expect(screen.getByTestId("tick-target")).toHaveTextContent(String(SAMPLE_TARGET_TICKS_PER_HOUR));
    });

    act(() => {
      socket.emit("telemetry:event", {
        topic: "telemetry.zone.snapshot.v1",
        payload: {
          zoneId: SAMPLE_ZONE_ID,
          simTime: SAMPLE_ZONE_SIM_TIME,
          warnings: []
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("zone-sim-time")).toHaveTextContent(String(SAMPLE_ZONE_SIM_TIME));
    });

    act(() => {
      socket.emit("telemetry:event", {
        topic: "telemetry.workforce.kpi.v1",
        payload: {
          simTimeHours: SAMPLE_SIM_TIME_HOURS,
          tasksCompleted: SAMPLE_TASKS_COMPLETED
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("workforce-tasks")).toHaveTextContent(String(SAMPLE_TASKS_COMPLETED));
    });

    act(() => {
      socket.emit("telemetry:event", {
        topic: "telemetry.harvest.created.v1",
        payload: {
          structureId: "structure-1",
          roomId: "room-1",
          plantId: "plant-1",
          zoneId: SAMPLE_ZONE_ID,
          lotId: "lot-1",
          createdAt_tick: SAMPLE_ZONE_SIM_TIME,
          freshWeight_kg: SAMPLE_FRESH_WEIGHT,
          moisture01: SAMPLE_MOISTURE01,
          quality01: SAMPLE_QUALITY01
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("harvest-count")).toHaveTextContent("1");
    });

    const tickTelemetryNode = screen.getByTestId("tick-sim-time");
    const tickSnapshotBeforeUnknown = tickTelemetryNode.textContent;

    act(() => {
      socket.emit("telemetry:event", {
        topic: "telemetry.unknown.topic",
        payload: { example: true }
      });
    });

    expect(screen.getByTestId("tick-sim-time")).toHaveTextContent(tickSnapshotBeforeUnknown);

    act(() => {
      socket.emit("disconnect", "transport closed");
    });

    await waitFor(() => {
      expect(screen.getByTestId("connection-status")).toHaveTextContent("disconnected");
      expect(screen.getByTestId("connection-reason")).toHaveTextContent("transport closed");
    });

    expect(setTimeout).toHaveBeenCalled();
    const reconnectHandler = scheduledReconnect;
    if (!reconnectHandler) {
      throw new Error("Reconnect handler was not scheduled");
    }

    act(() => {
      reconnectHandler();
    });

    await waitFor(() => {
      expect(screen.getByTestId("connection-status")).toHaveTextContent("connecting");
    });

    act(() => {
      socket.emit("connect");
    });

    await waitFor(() => {
      expect(screen.getByTestId("connection-status")).toHaveTextContent("connected");
      expect(screen.getByTestId("connection-reason")).toHaveTextContent("");
      expect(screen.getByTestId("tick-sim-time")).toHaveTextContent("");
      expect(screen.getByTestId("zone-sim-time")).toHaveTextContent("");
      expect(screen.getByTestId("workforce-tasks")).toHaveTextContent("");
      expect(screen.getByTestId("harvest-count")).toHaveTextContent("0");
    });
  });
});

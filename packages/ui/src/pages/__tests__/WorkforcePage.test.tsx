import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkforcePage } from "@ui/pages/WorkforcePage";
import { resetWorkforceFilters } from "@ui/state/workforce";
import type { IntentClient, IntentSubmissionHandlers } from "@ui/transport";

interface IntentClientStub {
  readonly client: IntentClient;
  readonly submit: ReturnType<typeof vi.fn>;
}

function createIntentClientStub(): IntentClientStub {
  const submit = vi.fn(
    (_intent: Parameters<IntentClient["submit"]>[0], handlers: IntentSubmissionHandlers) => {
      const result = { ok: true, ack: { ok: true } } as const;
      handlers.onResult(result);
      return Promise.resolve(result);
    }
  );

  const client: IntentClient = {
    submit,
    disconnect: vi.fn().mockResolvedValue(undefined)
  } satisfies IntentClient;

  return { client, submit };
}

beforeEach(() => {
  resetWorkforceFilters();
});

const FIRST_CALL = 1;
const SECOND_CALL = 2;
const THIRD_CALL = 3;
const FOURTH_CALL = 4;

describe("WorkforcePage", () => {
  it("renders the HR directory with assignments and activity", () => {
    const { client } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    expect(screen.getByRole("heading", { level: 2, name: /Workforce directory/i })).toBeInTheDocument();

    const directoryList = screen.getByRole("list", { name: /workforce directory entries/i });
    const leonieCard = within(directoryList).getByText("Leonie Krause").closest("li");
    if (!(leonieCard instanceof HTMLElement)) {
      throw new Error("Expected directory entry to render inside a list item");
    }

    const leonieWithin = within(leonieCard);
    expect(leonieWithin.getByText("Cultivation Lead")).toBeInTheDocument();
    expect(leonieWithin.getByText("cultivation")).toBeInTheDocument();
    expect(leonieWithin.getByText("ipm")).toBeInTheDocument();
    expect(leonieWithin.getByText(/Zone assignment/i)).toBeInTheDocument();
    expect(leonieWithin.getByText(/Green Harbor › Vegetative Bay A › Veg A-1/)).toBeInTheDocument();
    expect(leonieWithin.getByText("€32.00/h")).toBeInTheDocument();
    expect(leonieWithin.getByText(/Morale/i).nextElementSibling?.textContent).toContain("86");
    expect(leonieWithin.getByText(/Fatigue/i).nextElementSibling?.textContent).toContain("35");
    expect(leonieWithin.getByText(/45 min overtime/i)).toBeInTheDocument();
    expect(
      leonieWithin.getByText(/Leonie Krause completed vegetative inspection A-1\./i)
    ).toBeInTheDocument();
  });

  it("renders utilization summary and workforce warnings from the read model", () => {
    const { client } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    expect(screen.getByRole("heading", { name: /Roster utilization/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Average utilization 100% \(target 85%\)\./i)
    ).toBeInTheDocument();

    const focusAreaList = screen.getByRole("list", { name: /Workforce focus areas/i });
    expect(
      within(focusAreaList).getByText(/Inspections queue has 1 task\(s\) awaiting staffing\./i)
    ).toBeInTheDocument();

    const warningsList = screen.getByRole("list", { name: /Workforce warnings/i });
    expect(
      within(warningsList).getByText(/Cultivation Lead coverage marked WARNING\./i)
    ).toBeInTheDocument();
    expect(
      within(warningsList).getByText(/Reassign staff or schedule overtime for IPM Specialist\./i)
    ).toBeInTheDocument();
  });

  it("filters directory and timeline entries by zone", async () => {
    const { client } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    fireEvent.change(screen.getByLabelText(/Filter by zone/i), { target: { value: "zone-veg-a-1" } });

    await waitFor(() => {
      expect(screen.getByText("Leonie Krause")).toBeInTheDocument();
      expect(screen.queryByText("Jamal Nguyen")).not.toBeInTheDocument();
    });

    const timeline = screen.getByRole("list", { name: /hr activity timeline/i });
    await waitFor(() => {
      expect(within(timeline).getByText(/Veg inspection/i)).toBeInTheDocument();
      expect(within(timeline).queryByText(/Harvest lot/i)).not.toBeInTheDocument();
    });
  });

  it("displays task queues and dispatches assignment and task intents", async () => {
    const { client, submit } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    const inspectionsSection = screen.getByRole("article", { name: /Inspections tasks/i });
    const inspectionWithin = within(inspectionsSection);

    const assignButton = inspectionWithin.getAllByRole("button", { name: /reassign/i })[0];
    fireEvent.click(assignButton);
    await waitFor(() => {
      expect(submit).toHaveBeenNthCalledWith(
        FIRST_CALL,
        expect.objectContaining({ type: "hr.assign", employeeId: "employee-leonie-krause", target: "zone-veg-a-1" }),
        expect.any(Object)
      );
    });

    fireEvent.click(inspectionWithin.getAllByRole("button", { name: /acknowledge inspection/i })[0]);
    await waitFor(() => {
      expect(submit).toHaveBeenNthCalledWith(
        SECOND_CALL,
        expect.objectContaining({ type: "pest.inspect.start", zoneId: "zone-veg-a-1" }),
        expect.any(Object)
      );
    });

    fireEvent.click(inspectionWithin.getAllByRole("button", { name: /complete inspection/i })[0]);
    await waitFor(() => {
      expect(submit).toHaveBeenNthCalledWith(
        THIRD_CALL,
        expect.objectContaining({ type: "pest.inspect.complete", zoneId: "zone-veg-a-1" }),
        expect.any(Object)
      );
    });

    const maintenanceSection = screen.getByRole("article", { name: /Maintenance tasks/i });
    const maintenanceWithin = within(maintenanceSection);
    fireEvent.click(maintenanceWithin.getByRole("button", { name: /start maintenance/i }));
    await waitFor(() => {
      expect(submit).toHaveBeenNthCalledWith(
        FOURTH_CALL,
        expect.objectContaining({ type: "maintenance.start", deviceId: "device-hvac-pro-12" }),
        expect.any(Object)
      );
    });
  });

  it("renders capacity coverage hints", () => {
    const { client } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    const capacityList = screen.getByRole("list", { name: /HR capacity snapshot/i });
    const ipmCard = within(capacityList).getByText(/IPM Specialist/i).closest("li");
    if (!(ipmCard instanceof HTMLElement)) {
      throw new Error("Expected capacity entry to render inside a list item");
    }

    expect(within(ipmCard).getByText(/Balanced coverage across open tasks\./i)).toBeInTheDocument();
  });

  it("dispatches action panel intents for assignment, inspection, treatment, and maintenance", async () => {
    const { client, submit } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    fireEvent.change(screen.getByLabelText(/Select employee/i), { target: { value: "employee-jamal-nguyen" } });
    fireEvent.change(screen.getByLabelText(/Select assignment target/i), { target: { value: "zone-veg-a-2" } });
    fireEvent.click(screen.getByRole("button", { name: /Dispatch assignment/i }));
    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ type: "hr.assign", employeeId: "employee-jamal-nguyen", target: "zone-veg-a-2" }),
        expect.any(Object)
      );
    });

    fireEvent.change(screen.getByLabelText(/Select zone for inspection or treatment/i), {
      target: { value: "zone-veg-a-1" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Launch treatment/i }));
    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ type: "pest.treat.start", zoneId: "zone-veg-a-1" }),
        expect.any(Object)
      );
    });

    const maintenanceSelect = screen.getByLabelText(/Select maintenance target/i);
    fireEvent.change(maintenanceSelect, { target: { value: "device-hvac-pro-12" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Complete maintenance/i })[0]);
    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ type: "maintenance.complete", deviceId: "device-hvac-pro-12" }),
        expect.any(Object)
      );
    });
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

type UserInteractions = ReturnType<typeof userEvent.setup>;

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

  it("filters directory and timeline entries by zone", async () => {
    const user: UserInteractions = userEvent.setup();
    const { client } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    await user.selectOptions(screen.getByLabelText(/Filter by zone/i), ["zone-veg-a-1"]);

    expect(screen.getByText("Leonie Krause")).toBeInTheDocument();
    expect(screen.queryByText("Jamal Nguyen")).not.toBeInTheDocument();

    const timeline = screen.getByRole("list", { name: /hr activity timeline/i });
    expect(within(timeline).getByText(/Veg inspection/i)).toBeInTheDocument();
    expect(within(timeline).queryByText(/Harvest lot/i)).not.toBeInTheDocument();
  });

  it("displays task queues and dispatches assignment and task intents", async () => {
    const user: UserInteractions = userEvent.setup();
    const { client, submit } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    const inspectionsSection = screen.getByRole("article", { name: /Inspections tasks/i });
    const inspectionWithin = within(inspectionsSection);

    const assignButton = inspectionWithin.getAllByRole("button", { name: /reassign/i })[0];
    await user.click(assignButton);
    expect(submit).toHaveBeenNthCalledWith(
      FIRST_CALL,
      expect.objectContaining({ type: "hr.assign", employeeId: "employee-leonie-krause", target: "zone-veg-a-1" }),
      expect.any(Object)
    );

    await user.click(inspectionWithin.getByRole("button", { name: /acknowledge inspection/i }));
    expect(submit).toHaveBeenNthCalledWith(
      SECOND_CALL,
      expect.objectContaining({ type: "pest.inspect.start", zoneId: "zone-veg-a-1" }),
      expect.any(Object)
    );

    await user.click(inspectionWithin.getByRole("button", { name: /complete inspection/i }));
    expect(submit).toHaveBeenNthCalledWith(
      THIRD_CALL,
      expect.objectContaining({ type: "pest.inspect.complete", zoneId: "zone-veg-a-1" }),
      expect.any(Object)
    );

    const maintenanceSection = screen.getByRole("article", { name: /Maintenance tasks/i });
    const maintenanceWithin = within(maintenanceSection);
    await user.click(maintenanceWithin.getByRole("button", { name: /start maintenance/i }));
    expect(submit).toHaveBeenNthCalledWith(
      FOURTH_CALL,
      expect.objectContaining({ type: "maintenance.start", deviceId: "device-hvac-pro-12" }),
      expect.any(Object)
    );
  });

  it("renders capacity coverage hints", () => {
    const { client } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    const capacityList = screen.getByRole("list", { name: /HR capacity snapshot/i });
    const ipmCard = within(capacityList).getByText(/IPM Specialist/i).closest("li");
    if (!(ipmCard instanceof HTMLElement)) {
      throw new Error("Expected capacity entry to render inside a list item");
    }

    expect(within(ipmCard).getByText(/Understaffed by 1 team member/)).toBeInTheDocument();
  });

  it("dispatches action panel intents for assignment, inspection, treatment, and maintenance", async () => {
    const user: UserInteractions = userEvent.setup();
    const { client, submit } = createIntentClientStub();
    render(<WorkforcePage intentClient={client} />);

    await user.selectOptions(screen.getByLabelText(/Select employee/i), ["employee-jamal-nguyen"]);
    await user.selectOptions(screen.getByLabelText(/Select assignment target/i), ["zone-veg-a-2"]);
    await user.click(screen.getByRole("button", { name: /Dispatch assignment/i }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "hr.assign", employeeId: "employee-jamal-nguyen", target: "zone-veg-a-2" }),
      expect.any(Object)
    );

    await user.selectOptions(screen.getByLabelText(/Select zone for inspection or treatment/i), ["zone-veg-a-1"]);
    await user.click(screen.getByRole("button", { name: /Launch treatment/i }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pest.treat.start", zoneId: "zone-veg-a-1" }),
      expect.any(Object)
    );

    const maintenanceSelect = screen.getByLabelText(/Select maintenance target/i);
    await user.selectOptions(maintenanceSelect, ["device-hvac-pro-12"]);
    await user.click(screen.getByRole("button", { name: /Complete maintenance/i }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "maintenance.complete", deviceId: "device-hvac-pro-12" }),
      expect.any(Object)
    );
  });
});

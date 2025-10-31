import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkforceActionPanel, type WorkforceActionTargetOption } from "../ActionPanel";

const employees = [
  { id: "emp-1", label: "Alice — Gardener" },
  { id: "emp-2", label: "Bob — Technician" }
] as const;

const assignmentTargets: WorkforceActionTargetOption[] = [
  { id: "structure-1", label: "Structure · S1" },
  { id: "room-1", label: "S1 › R1" },
  { id: "zone-1", label: "S1 › R1 › Z1" }
];

const zoneTargets: WorkforceActionTargetOption[] = [
  { id: "zone-1", label: "S1 › R1 › Z1" }
];

const maintenanceTargets: WorkforceActionTargetOption[] = [
  { id: "device-1", label: "Device 1" }
];

describe("WorkforceActionPanel", () => {
  it("fires assignment and hiring callbacks when enabled", () => {
    const onAssign = vi.fn();
    const onScan = vi.fn();
    const onHire = vi.fn();

    render(
      <WorkforceActionPanel
        employees={employees}
        assignmentTargets={assignmentTargets}
        zoneTargets={zoneTargets}
        maintenanceTargets={maintenanceTargets}
        intentsEnabled={true}
        onAssign={onAssign}
        onScanHiringMarket={onScan}
        onHireCandidate={onHire}
        onInspectionStart={vi.fn()}
        onInspectionComplete={vi.fn()}
        onTreatmentStart={vi.fn()}
        onTreatmentComplete={vi.fn()}
        onMaintenanceStart={vi.fn()}
        onMaintenanceComplete={vi.fn()}
      />
    );

    // assign
    fireEvent.change(screen.getByLabelText(/Select employee/i), { target: { value: "emp-1" } });
    fireEvent.change(screen.getByLabelText(/Select assignment target/i), { target: { value: "zone-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Dispatch assignment/i }));
    expect(onAssign).toHaveBeenCalledWith("emp-1", "zone-1");

    // hiring scan
    fireEvent.change(screen.getByLabelText(/Select structure for hiring/i), { target: { value: "structure-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Scan hiring market/i }));
    expect(onScan).toHaveBeenCalledWith("structure-1");

    // hire by candidate id
    fireEvent.change(screen.getByLabelText(/Candidate ID/i), { target: { value: "cand-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Hire/i }));
    expect(onHire).toHaveBeenCalledWith("structure-1", "cand-1");
  });
});



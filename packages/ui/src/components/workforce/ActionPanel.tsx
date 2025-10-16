import { useState, type ReactElement } from "react";
import type { WorkforceAssigneeOption } from "@ui/components/workforce/TaskQueues";

export interface WorkforceActionTargetOption {
  readonly id: string;
  readonly label: string;
}

export interface WorkforceActionPanelProps {
  readonly employees: readonly WorkforceAssigneeOption[];
  readonly assignmentTargets: readonly WorkforceActionTargetOption[];
  readonly zoneTargets: readonly WorkforceActionTargetOption[];
  readonly maintenanceTargets: readonly WorkforceActionTargetOption[];
  readonly intentsEnabled: boolean;
  readonly onAssign: (employeeId: string, targetId: string) => void;
  readonly onInspectionStart: (zoneId: string) => void;
  readonly onInspectionComplete: (zoneId: string) => void;
  readonly onTreatmentStart: (zoneId: string) => void;
  readonly onTreatmentComplete: (zoneId: string) => void;
  readonly onMaintenanceStart: (targetId: string) => void;
  readonly onMaintenanceComplete: (targetId: string) => void;
}

function isActionDisabled(enabled: boolean, ...values: readonly (string | null | undefined)[]): boolean {
  if (!enabled) {
    return true;
  }

  return values.some((value) => !value);
}

export function WorkforceActionPanel({
  employees,
  assignmentTargets,
  zoneTargets,
  maintenanceTargets,
  intentsEnabled,
  onAssign,
  onInspectionStart,
  onInspectionComplete,
  onTreatmentStart,
  onTreatmentComplete,
  onMaintenanceStart,
  onMaintenanceComplete
}: WorkforceActionPanelProps): ReactElement {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedAssignmentTarget, setSelectedAssignmentTarget] = useState<string>("");
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [selectedMaintenanceTarget, setSelectedMaintenanceTarget] = useState<string>("");

  const assignDisabled = isActionDisabled(intentsEnabled, selectedEmployeeId, selectedAssignmentTarget);
  const inspectionDisabled = isActionDisabled(intentsEnabled, selectedZone);
  const maintenanceDisabled = isActionDisabled(intentsEnabled, selectedMaintenanceTarget);

  return (
    <section aria-labelledby="hr-action-panel-heading" className="space-y-4">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Tasking</p>
        <h2 className="text-2xl font-semibold text-text-primary" id="hr-action-panel-heading">
          Workforce action panel
        </h2>
        <p className="text-sm text-text-muted">
          Dispatch assignments and trigger inspections, treatments, or maintenance. Actions reuse the same intents as
          zone and room surfaces.
        </p>
        {!intentsEnabled ? (
          <p className="text-xs text-text-muted">
            Transport base URL not configured. Intent buttons are disabled for safety.
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-border-base bg-canvas-base/70 p-5">
          <h3 className="text-lg font-semibold text-text-primary">Assign / Reassign</h3>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted">
            Employee
            <select
              aria-label="Select employee"
              className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
              value={selectedEmployeeId}
              onChange={(event) => {
                setSelectedEmployeeId(event.currentTarget.value);
              }}
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted">
            Target (structure / room / zone)
            <select
              aria-label="Select assignment target"
              className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
              value={selectedAssignmentTarget}
              onChange={(event) => {
                setSelectedAssignmentTarget(event.currentTarget.value);
              }}
            >
              <option value="">Select target</option>
              {assignmentTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="w-full rounded-lg border border-accent-primary/70 bg-accent-primary/20 px-3 py-2 text-sm font-semibold text-accent-primary"
            onClick={() => {
              onAssign(selectedEmployeeId, selectedAssignmentTarget);
            }}
            disabled={assignDisabled}
            aria-disabled={assignDisabled}
          >
            Dispatch assignment
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-border-base bg-canvas-base/70 p-5">
          <h3 className="text-lg font-semibold text-text-primary">Inspections & Treatments</h3>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted">
            Zone
            <select
              aria-label="Select zone for inspection or treatment"
              className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
              value={selectedZone}
              onChange={(event) => {
                setSelectedZone(event.currentTarget.value);
              }}
            >
              <option value="">Select zone</option>
              {zoneTargets.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2">
            <button
              type="button"
              className="rounded-lg border border-border-base/70 bg-canvas-base px-3 py-2 text-sm text-text-primary transition hover:border-accent-primary hover:text-accent-primary"
              onClick={() => {
                onInspectionStart(selectedZone);
              }}
              disabled={inspectionDisabled}
              aria-disabled={inspectionDisabled}
            >
              Acknowledge inspection
            </button>
            <button
              type="button"
              className="rounded-lg border border-border-base/70 bg-canvas-base px-3 py-2 text-sm text-text-primary transition hover:border-accent-primary hover:text-accent-primary"
              onClick={() => {
                onInspectionComplete(selectedZone);
              }}
              disabled={inspectionDisabled}
              aria-disabled={inspectionDisabled}
            >
              Complete inspection
            </button>
            <button
              type="button"
              className="rounded-lg border border-border-base/70 bg-canvas-base px-3 py-2 text-sm text-text-primary transition hover:border-accent-primary hover:text-accent-primary"
              onClick={() => {
                onTreatmentStart(selectedZone);
              }}
              disabled={inspectionDisabled}
              aria-disabled={inspectionDisabled}
            >
              Launch treatment
            </button>
            <button
              type="button"
              className="rounded-lg border border-border-base/70 bg-canvas-base px-3 py-2 text-sm text-text-primary transition hover:border-accent-primary hover:text-accent-primary"
              onClick={() => {
                onTreatmentComplete(selectedZone);
              }}
              disabled={inspectionDisabled}
              aria-disabled={inspectionDisabled}
            >
              Complete treatment
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border-base bg-canvas-base/70 p-5">
          <h3 className="text-lg font-semibold text-text-primary">Maintenance</h3>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted">
            Device / target
            <select
              aria-label="Select maintenance target"
              className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
              value={selectedMaintenanceTarget}
              onChange={(event) => {
                setSelectedMaintenanceTarget(event.currentTarget.value);
              }}
            >
              <option value="">Select target</option>
              {maintenanceTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2">
            <button
              type="button"
              className="rounded-lg border border-border-base/70 bg-canvas-base px-3 py-2 text-sm text-text-primary transition hover:border-accent-primary hover:text-accent-primary"
              onClick={() => {
                onMaintenanceStart(selectedMaintenanceTarget);
              }}
              disabled={maintenanceDisabled}
              aria-disabled={maintenanceDisabled}
            >
              Start maintenance
            </button>
            <button
              type="button"
              className="rounded-lg border border-border-base/70 bg-canvas-base px-3 py-2 text-sm text-text-primary transition hover:border-accent-primary hover:text-accent-primary"
              onClick={() => {
                onMaintenanceComplete(selectedMaintenanceTarget);
              }}
              disabled={maintenanceDisabled}
              aria-disabled={maintenanceDisabled}
            >
              Complete maintenance
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

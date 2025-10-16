import type { ReactElement } from "react";
import { cn } from "@ui/lib/cn";

export interface WorkforceFilterOption {
  readonly value: string | null;
  readonly label: string;
}

export interface WorkforceDirectoryFiltersProps {
  readonly structures: readonly WorkforceFilterOption[];
  readonly rooms: readonly WorkforceFilterOption[];
  readonly zones: readonly WorkforceFilterOption[];
  readonly roles: readonly WorkforceFilterOption[];
  readonly selectedStructureId: string | null;
  readonly selectedRoomId: string | null;
  readonly selectedZoneId: string | null;
  readonly selectedRole: string | null;
  readonly onStructureChange: (value: string | null) => void;
  readonly onRoomChange: (value: string | null) => void;
  readonly onZoneChange: (value: string | null) => void;
  readonly onRoleChange: (value: string | null) => void;
}

export interface WorkforceDirectoryEntryView {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly hourlyCostLabel: string;
  readonly moralePercent: number;
  readonly fatiguePercent: number;
  readonly skills: readonly string[];
  readonly assignmentLabel: string;
  readonly locationPath: string;
  readonly overtimeMinutes: number;
  readonly recentActivity: string | null;
}

export interface WorkforceDirectoryProps {
  readonly filters: WorkforceDirectoryFiltersProps;
  readonly entries: readonly WorkforceDirectoryEntryView[];
}

function renderFilterOption(option: WorkforceFilterOption): ReactElement {
  return (
    <option key={option.value ?? "all"} value={option.value ?? ""}>
      {option.label}
    </option>
  );
}

function resolveOvertimeLabel(minutes: number): string {
  if (minutes <= 0) {
    return "No overtime";
  }

  return `${minutes.toString()} min overtime`;
}

export function WorkforceDirectory({ filters, entries }: WorkforceDirectoryProps): ReactElement {
  return (
    <section aria-labelledby="hr-directory-heading" className="space-y-4">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">HR</p>
        <h2 className="text-2xl font-semibold text-text-primary" id="hr-directory-heading">
          Workforce directory
        </h2>
        <p className="text-sm text-text-muted">
          Review employee assignments, morale, and recent activity. Use the filters to narrow by structure, room,
          zone, or role.
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted">
          Structure
          <select
            aria-label="Filter by structure"
            className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
            value={filters.selectedStructureId ?? ""}
            onChange={(event) => {
              filters.onStructureChange(event.currentTarget.value || null);
            }}
          >
            {filters.structures.map(renderFilterOption)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted">
          Room
          <select
            aria-label="Filter by room"
            className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
            value={filters.selectedRoomId ?? ""}
            onChange={(event) => {
              filters.onRoomChange(event.currentTarget.value || null);
            }}
          >
            {filters.rooms.map(renderFilterOption)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted">
          Zone
          <select
            aria-label="Filter by zone"
            className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
            value={filters.selectedZoneId ?? ""}
            onChange={(event) => {
              filters.onZoneChange(event.currentTarget.value || null);
            }}
          >
            {filters.zones.map(renderFilterOption)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted">
          Role
          <select
            aria-label="Filter by role"
            className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
            value={filters.selectedRole ?? ""}
            onChange={(event) => {
              filters.onRoleChange(event.currentTarget.value || null);
            }}
          >
            {filters.roles.map(renderFilterOption)}
          </select>
        </label>
      </div>

      <ul className="grid gap-4 lg:grid-cols-2" aria-label="Workforce directory entries">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-4 rounded-xl border border-border-base bg-canvas-base/70 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-text-primary">{entry.name}</p>
                <p className="text-sm text-text-muted">{entry.role}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-text-primary">{entry.hourlyCostLabel}</p>
                <p className="text-xs text-text-muted">Hourly cost</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-accent-muted">
              {entry.skills.map((skill) => (
                <span key={skill} className="rounded-full border border-accent-muted/30 px-2 py-1 uppercase tracking-[0.2em]">
                  {skill}
                </span>
              ))}
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas-raised/50 p-4">
              <p className="text-sm font-semibold text-text-primary">{entry.assignmentLabel}</p>
              <p className="text-xs text-text-muted">{entry.locationPath}</p>
              <p className="mt-2 text-xs text-text-muted">
                {entry.recentActivity ?? "No recent activity recorded."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Morale</p>
                  <p className="font-semibold text-text-primary">{entry.moralePercent}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Fatigue</p>
                  <p className="font-semibold text-text-primary">{entry.fatiguePercent}%</p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                  entry.overtimeMinutes > 0
                    ? "border-accent-warning text-accent-warning"
                    : "border-accent-muted text-accent-muted"
                )}
              >
                {resolveOvertimeLabel(entry.overtimeMinutes)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

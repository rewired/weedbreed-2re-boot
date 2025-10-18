import { useMemo } from "react";
import { create } from "zustand";

import type {
  HrReadModel,
  HrTaskQueue,
  HrTaskQueueEntry
} from "@ui/state/readModels.types";
import { useReadModelStore } from "@ui/state/readModels";
import { useWorkforceKpiTelemetry } from "@ui/state/telemetry";

const WORKFORCE_TARGET_UTILISATION_PERCENT = 85;

export interface WorkforceHeadcountSummary {
  readonly totalTeamMembers: number;
  readonly activeTeamMembers: number;
  readonly unavailableTeamMembers: number;
  readonly openRoles: number;
}

export interface WorkforceRoleMixEntry {
  readonly id: string;
  readonly roleName: string;
  readonly headcount: number;
  readonly percentOfTeam: number;
}

export interface WorkforceUtilizationSummary {
  readonly averageUtilizationPercent: number;
  readonly targetUtilizationPercent: number;
  readonly focusAreas: readonly string[];
  readonly notes: string;
}

export interface WorkforceWarning {
  readonly id: string;
  readonly severity: "info" | "warning" | "critical";
  readonly message: string;
  readonly suggestedAction: string;
}

export interface WorkforceSnapshot {
  readonly headcount: WorkforceHeadcountSummary;
  readonly roleMix: readonly WorkforceRoleMixEntry[];
  readonly utilization: WorkforceUtilizationSummary;
  readonly warnings: readonly WorkforceWarning[];
}

export interface WorkforceFilterSelection {
  readonly structureId: string | null;
  readonly roomId: string | null;
  readonly zoneId: string | null;
  readonly role: string | null;
}

export interface WorkforceFilterStore {
  readonly selection: WorkforceFilterSelection;
  readonly setStructure: (structureId: string | null) => void;
  readonly setRoom: (roomId: string | null) => void;
  readonly setZone: (zoneId: string | null) => void;
  readonly setRole: (role: string | null) => void;
  readonly reset: () => void;
}

function createDefaultFilterSelection(): WorkforceFilterSelection {
  return {
    structureId: null,
    roomId: null,
    zoneId: null,
    role: null
  } satisfies WorkforceFilterSelection;
}

const useWorkforceFilterStore = create<WorkforceFilterStore>((set) => ({
  selection: createDefaultFilterSelection(),
  setStructure: (structureId) => {
    set((state) => ({
      selection: {
        structureId,
        roomId: null,
        zoneId: null,
        role: state.selection.role
      }
    }));
  },
  setRoom: (roomId) => {
    set((state) => ({
      selection: {
        ...state.selection,
        roomId,
        zoneId: null
      }
    }));
  },
  setZone: (zoneId) => {
    set((state) => ({
      selection: {
        ...state.selection,
        zoneId
      }
    }));
  },
  setRole: (role) => {
    set((state) => ({
      selection: {
        ...state.selection,
        role
      }
    }));
  },
  reset: () => {
    set({ selection: createDefaultFilterSelection() });
  }
}));

export type WorkforceSnapshotOverrides = Partial<{
  readonly headcount: Partial<WorkforceHeadcountSummary>;
  readonly roleMix: WorkforceSnapshot["roleMix"];
  readonly utilization: Partial<WorkforceUtilizationSummary>;
  readonly warnings: WorkforceSnapshot["warnings"];
}>;

export function useWorkforceSnapshot(overrides?: WorkforceSnapshotOverrides): WorkforceSnapshot {
  const hr = useReadModelStore((state) => state.snapshot.hr);
  const snapshot = useMemo(() => createWorkforceSnapshot(hr), [hr]);
  const kpiSnapshot = useWorkforceKpiTelemetry();

  const telemetrySnapshot = useMemo(() => {
    if (!kpiSnapshot) {
      return snapshot;
    }

    const averageUtilizationPercent = Math.round(kpiSnapshot.utilization01 * 100);

    return {
      ...snapshot,
      utilization: {
        ...snapshot.utilization,
        averageUtilizationPercent
      }
    } satisfies WorkforceSnapshot;
  }, [snapshot, kpiSnapshot]);

  if (!overrides) {
    return telemetrySnapshot;
  }

  return {
    headcount: { ...telemetrySnapshot.headcount, ...overrides.headcount },
    roleMix: overrides.roleMix ?? telemetrySnapshot.roleMix,
    utilization: { ...telemetrySnapshot.utilization, ...overrides.utilization },
    warnings: overrides.warnings ?? telemetrySnapshot.warnings
  };
}

export function useWorkforceFilters(): WorkforceFilterStore {
  return useWorkforceFilterStore();
}

export function resetWorkforceFilters(): void {
  useWorkforceFilterStore.getState().reset();
}

function createWorkforceSnapshot(hr: HrReadModel): WorkforceSnapshot {
  const headcount = deriveHeadcountSummary(hr);
  const roleMix = deriveRoleMixEntries(hr, headcount.totalTeamMembers);
  const focusAreas = deriveFocusAreas(hr);
  const warnings = deriveWarnings(hr);
  const queuedTasks = countQueuedTasks(hr.taskQueues);

  const utilization: WorkforceUtilizationSummary = {
    averageUtilizationPercent:
      headcount.totalTeamMembers === 0
        ? 0
        : Math.round((headcount.activeTeamMembers / headcount.totalTeamMembers) * 100),
    targetUtilizationPercent: WORKFORCE_TARGET_UTILISATION_PERCENT,
    focusAreas: focusAreas.length > 0 ? focusAreas : ["No active focus areas detected."],
    notes:
      queuedTasks > 0
        ? `${queuedTasks.toString()} task(s) awaiting assignment across workforce queues.`
        : "No queued workforce tasks at this time."
  };

  return { headcount, roleMix, utilization, warnings } satisfies WorkforceSnapshot;
}

function deriveHeadcountSummary(hr: HrReadModel): WorkforceHeadcountSummary {
  const totalTeamMembers = hr.directory.length;
  const unavailableTeamMembers = hr.directory.filter((entry) => entry.fatiguePercent >= 80).length;
  const activeTeamMembers = Math.max(totalTeamMembers - unavailableTeamMembers, 0);
  const openRoles = hr.capacitySnapshot.reduce((sum, entry) => {
    const deficit = entry.queuedTasks - entry.headcount;
    return deficit > 0 ? sum + deficit : sum;
  }, 0);

  return {
    totalTeamMembers,
    activeTeamMembers,
    unavailableTeamMembers,
    openRoles
  } satisfies WorkforceHeadcountSummary;
}

function deriveRoleMixEntries(
  hr: HrReadModel,
  totalTeamMembers: number
): WorkforceRoleMixEntry[] {
  if (totalTeamMembers === 0) {
    return [];
  }

  const roleCounts = new Map<string, number>();
  for (const entry of hr.directory) {
    roleCounts.set(entry.role, (roleCounts.get(entry.role) ?? 0) + 1);
  }

  return Array.from(roleCounts.entries())
    .map(([roleName, headcount]) => ({
      id: `role-${roleName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      roleName,
      headcount,
      percentOfTeam: Math.round((headcount / totalTeamMembers) * 100)
    }))
    .sort((left, right) => left.roleName.localeCompare(right.roleName));
}

function deriveFocusAreas(hr: HrReadModel): readonly string[] {
  const focusAreas: string[] = [];

  for (const queue of hr.taskQueues) {
    const queued = queue.entries.filter((entry) => entry.status === "queued").length;
    if (queued > 0) {
      focusAreas.push(`${queue.title} queue has ${queued.toString()} task(s) awaiting staffing.`);
    }
  }

  return focusAreas;
}

function deriveWarnings(hr: HrReadModel): WorkforceWarning[] {
  const warnings: WorkforceWarning[] = [];

  for (const entry of hr.capacitySnapshot) {
    if (entry.coverageStatus === "ok") {
      continue;
    }

    const severity = entry.coverageStatus === "critical" ? "critical" : "warning";
    const message = `${entry.role} coverage marked ${severity.toUpperCase()}.`;
    const suggestedAction =
      severity === "critical"
        ? `Reassign staff or schedule overtime for ${entry.role}.`
        : `Monitor staffing for ${entry.role} and adjust assignments.`;

    warnings.push({
      id: `warning-${entry.role.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      severity,
      message,
      suggestedAction
    });
  }

  return warnings;
}

function countQueuedTasks(queues: readonly HrTaskQueue[]): number {
  return queues.reduce((sum, queue) => sum + countQueuedEntries(queue.entries), 0);
}

function countQueuedEntries(entries: readonly HrTaskQueueEntry[]): number {
  return entries.reduce((sum, entry) => (entry.status === "queued" ? sum + 1 : sum), 0);
}

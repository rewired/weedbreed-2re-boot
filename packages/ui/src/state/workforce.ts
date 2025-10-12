import { useMemo, useSyncExternalStore } from "react";
import { useWorkforceKpiTelemetry } from "@ui/state/telemetry";

const WORKFORCE_STUB_TOTAL_TEAM_MEMBERS = 28;
const WORKFORCE_STUB_ACTIVE_TEAM_MEMBERS = 24;
const WORKFORCE_STUB_UNAVAILABLE_TEAM_MEMBERS = 3;
const WORKFORCE_STUB_OPEN_ROLES = 2;

const WORKFORCE_ROLE_MIX_CULTIVATION_HEADCOUNT = 12;
const WORKFORCE_ROLE_MIX_CULTIVATION_PERCENT = 43;
const WORKFORCE_ROLE_MIX_HARVEST_HEADCOUNT = 6;
const WORKFORCE_ROLE_MIX_HARVEST_PERCENT = 21;
const WORKFORCE_ROLE_MIX_POST_PROCESSING_HEADCOUNT = 5;
const WORKFORCE_ROLE_MIX_POST_PROCESSING_PERCENT = 18;
const WORKFORCE_ROLE_MIX_FACILITIES_HEADCOUNT = 3;
const WORKFORCE_ROLE_MIX_FACILITIES_PERCENT = 11;
const WORKFORCE_ROLE_MIX_OPERATIONS_HEADCOUNT = 2;
const WORKFORCE_ROLE_MIX_OPERATIONS_PERCENT = 7;

const WORKFORCE_UTILISATION_AVERAGE_PERCENT = 82;
const WORKFORCE_UTILISATION_TARGET_PERCENT = 85;

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

export interface WorkforceStore {
  getSnapshot(): WorkforceSnapshot;
  subscribe(listener: () => void): () => void;
}

const workforceStubSnapshot: WorkforceSnapshot = Object.freeze({
  headcount: Object.freeze({
    totalTeamMembers: WORKFORCE_STUB_TOTAL_TEAM_MEMBERS,
    activeTeamMembers: WORKFORCE_STUB_ACTIVE_TEAM_MEMBERS,
    unavailableTeamMembers: WORKFORCE_STUB_UNAVAILABLE_TEAM_MEMBERS,
    openRoles: WORKFORCE_STUB_OPEN_ROLES
  }),
  roleMix: Object.freeze([
    Object.freeze({
      id: "role-cultivation-technician",
      roleName: "Cultivation technicians",
      headcount: WORKFORCE_ROLE_MIX_CULTIVATION_HEADCOUNT,
      percentOfTeam: WORKFORCE_ROLE_MIX_CULTIVATION_PERCENT
    }),
    Object.freeze({
      id: "role-harvest-specialist",
      roleName: "Harvest specialists",
      headcount: WORKFORCE_ROLE_MIX_HARVEST_HEADCOUNT,
      percentOfTeam: WORKFORCE_ROLE_MIX_HARVEST_PERCENT
    }),
    Object.freeze({
      id: "role-post-processing",
      roleName: "Post-processing",
      headcount: WORKFORCE_ROLE_MIX_POST_PROCESSING_HEADCOUNT,
      percentOfTeam: WORKFORCE_ROLE_MIX_POST_PROCESSING_PERCENT
    }),
    Object.freeze({
      id: "role-facilities",
      roleName: "Facilities & compliance",
      headcount: WORKFORCE_ROLE_MIX_FACILITIES_HEADCOUNT,
      percentOfTeam: WORKFORCE_ROLE_MIX_FACILITIES_PERCENT
    }),
    Object.freeze({
      id: "role-operations",
      roleName: "Operations support",
      headcount: WORKFORCE_ROLE_MIX_OPERATIONS_HEADCOUNT,
      percentOfTeam: WORKFORCE_ROLE_MIX_OPERATIONS_PERCENT
    })
  ]),
  utilization: Object.freeze({
    averageUtilizationPercent: WORKFORCE_UTILISATION_AVERAGE_PERCENT,
    targetUtilizationPercent: WORKFORCE_UTILISATION_TARGET_PERCENT,
    focusAreas: Object.freeze([
      "Vegetative care shifts nearing overtime thresholds",
      "Post-harvest sanitation backlog requires relief coverage"
    ]),
    notes:
      "Placeholder utilisation rollup summarising SEC §4.2 task pipeline hours across cultivation, harvest, and facilities teams."
  }),
  warnings: Object.freeze([
    Object.freeze({
      id: "warning-labour-gap-veg",
      severity: "warning",
      message: "Vegetative care staffing running at 92% of required coverage.",
      suggestedAction: "Schedule float cultivators or approve overtime for the current cycle."
    }),
    Object.freeze({
      id: "warning-maintenance-window",
      severity: "info",
      message: "Preventive maintenance window overlaps with planned harvest prep.",
      suggestedAction: "Coordinate facilities lead to reschedule window after harvest completion."
    })
  ])
});

const workforceStore: WorkforceStore = {
  getSnapshot: () => workforceStubSnapshot,
  subscribe: (listener: () => void) => {
    void listener;
    return () => undefined;
  }
};

export type WorkforceSnapshotOverrides = Partial<{
  readonly headcount: Partial<WorkforceHeadcountSummary>;
  readonly roleMix: WorkforceSnapshot["roleMix"];
  readonly utilization: Partial<WorkforceUtilizationSummary>;
  readonly warnings: WorkforceSnapshot["warnings"];
}>;

export function useWorkforceSnapshot(overrides?: WorkforceSnapshotOverrides): WorkforceSnapshot {
  const snapshot = useSyncExternalStore(
    (listener) => workforceStore.subscribe(listener),
    () => workforceStore.getSnapshot(),
    () => workforceStore.getSnapshot()
  );

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

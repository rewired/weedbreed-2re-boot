import { useMemo, type ReactElement } from "react";
import { HOURS_PER_DAY } from "@engine/constants/simConstants.ts";
import {
  WorkforceDirectory,
  type WorkforceDirectoryEntryView,
  type WorkforceDirectoryFiltersProps,
  type WorkforceFilterOption
} from "@ui/components/workforce/Directory";
import {
  WorkforceActivityTimeline,
  type WorkforceActivityEntryView
} from "@ui/components/workforce/ActivityTimeline";
import {
  WorkforceTaskQueues,
  type WorkforceTaskQueueView,
  type WorkforceAssigneeOption,
  type WorkforceTaskQueueEntryAction
} from "@ui/components/workforce/TaskQueues";
import {
  WorkforceCapacitySnapshot,
  type WorkforceCapacityEntryView
} from "@ui/components/workforce/CapacitySnapshot";
import {
  WorkforceActionPanel,
  type WorkforceActionTargetOption
} from "@ui/components/workforce/ActionPanel";
import { useHRReadModel, useStructureReadModels } from "@ui/lib/readModelHooks";
import { formatCurrency, useShellLocale } from "@ui/lib/locale";
import { useWorkforceFilters } from "@ui/state/workforce";
import type {
  HrActivityEntry,
  HrDirectoryEntry,
  HrTaskQueue,
  HrTaskQueueEntry,
  StructureReadModel,
  WorkforceAssignment
} from "@ui/state/readModels.types";
import type { IntentClient, IntentSubmissionHandlers } from "@ui/transport";

interface AssignmentContext {
  readonly structureId: string | null;
  readonly structureName: string | null;
  readonly roomId: string | null;
  readonly roomName: string | null;
  readonly zoneId: string | null;
  readonly zoneName: string | null;
}

interface ZoneLocation extends AssignmentContext {
  readonly zoneId: string;
}

interface RoomLocation extends AssignmentContext {
  readonly roomId: string;
}

interface StructureLocation {
  readonly structureId: string;
  readonly structureName: string;
}

interface LocationIndex {
  readonly structures: Map<string, StructureLocation>;
  readonly rooms: Map<string, RoomLocation>;
  readonly zones: Map<string, ZoneLocation>;
  readonly devices: Map<string, AssignmentContext>;
}

const DEFAULT_DURATION_LABEL = "Duration 1h";

const HR_ASSIGN_INTENT = "hr.assign" as const;
const PEST_INSPECTION_START_INTENT = "pest.inspect.start" as const;
const PEST_INSPECTION_COMPLETE_INTENT = "pest.inspect.complete" as const;
const PEST_TREATMENT_START_INTENT = "pest.treat.start" as const;
const PEST_TREATMENT_COMPLETE_INTENT = "pest.treat.complete" as const;
const MAINTENANCE_START_INTENT = "maintenance.start" as const;
const MAINTENANCE_COMPLETE_INTENT = "maintenance.complete" as const;

export interface WorkforcePageProps {
  readonly intentClient?: IntentClient | null;
}

function createLocationIndex(structures: readonly StructureReadModel[]): LocationIndex {
  const structureMap = new Map<string, StructureLocation>();
  const roomMap = new Map<string, RoomLocation>();
  const zoneMap = new Map<string, ZoneLocation>();
  const deviceMap = new Map<string, AssignmentContext>();

  for (const structure of structures) {
    structureMap.set(structure.id, { structureId: structure.id, structureName: structure.name });

    for (const device of structure.devices) {
      deviceMap.set(device.id, {
        structureId: structure.id,
        structureName: structure.name,
        roomId: null,
        roomName: null,
        zoneId: null,
        zoneName: null
      });
    }

    for (const room of structure.rooms) {
      roomMap.set(room.id, {
        structureId: structure.id,
        structureName: structure.name,
        roomId: room.id,
        roomName: room.name,
        zoneId: null,
        zoneName: null
      });

      for (const device of room.devices) {
        deviceMap.set(device.id, {
          structureId: structure.id,
          structureName: structure.name,
          roomId: room.id,
          roomName: room.name,
          zoneId: null,
          zoneName: null
        });
      }

      for (const zone of room.zones) {
        zoneMap.set(zone.id, {
          structureId: structure.id,
          structureName: structure.name,
          roomId: room.id,
          roomName: room.name,
          zoneId: zone.id,
          zoneName: zone.name
        });
      }
    }
  }

  return { structures: structureMap, rooms: roomMap, zones: zoneMap, devices: deviceMap } satisfies LocationIndex;
}

function resolveAssignmentContext(
  assignment: WorkforceAssignment,
  index: LocationIndex
): AssignmentContext {
  if (assignment.assignedScope === "structure") {
    const structure = index.structures.get(assignment.targetId);
    if (structure) {
      return {
        structureId: structure.structureId,
        structureName: structure.structureName,
        roomId: null,
        roomName: null,
        zoneId: null,
        zoneName: null
      } satisfies AssignmentContext;
    }

    return {
      structureId: assignment.targetId,
      structureName: assignment.targetId,
      roomId: null,
      roomName: null,
      zoneId: null,
      zoneName: null
    } satisfies AssignmentContext;
  }

  if (assignment.assignedScope === "room") {
    const room = index.rooms.get(assignment.targetId);
    if (room) {
      return {
        structureId: room.structureId,
        structureName: room.structureName,
        roomId: room.roomId,
        roomName: room.roomName,
        zoneId: null,
        zoneName: null
      } satisfies AssignmentContext;
    }

    return {
      structureId: null,
      structureName: null,
      roomId: assignment.targetId,
      roomName: assignment.targetId,
      zoneId: null,
      zoneName: null
    } satisfies AssignmentContext;
  }

  const zone = index.zones.get(assignment.targetId);
  if (zone) {
    return zone;
  }

  return {
    structureId: null,
    structureName: null,
    roomId: null,
    roomName: null,
    zoneId: assignment.targetId,
    zoneName: assignment.targetId
  } satisfies AssignmentContext;
}

function formatLocationPath(context: AssignmentContext, fallback: string): string {
  const segments: string[] = [];
  if (context.structureName) {
    segments.push(context.structureName);
  }
  if (context.roomName) {
    segments.push(context.roomName);
  }
  if (context.zoneName) {
    segments.push(context.zoneName);
  }

  if (segments.length === 0) {
    return fallback;
  }

  return segments.join(" › ");
}

function formatAssignmentLabel(scope: WorkforceAssignment["assignedScope"]): string {
  switch (scope) {
    case "structure":
      return "Structure assignment";
    case "room":
      return "Room assignment";
    case "zone":
    default:
      return "Zone assignment";
  }
}

function formatTickLabel(tick: number): string {
  const day = Math.floor(tick / HOURS_PER_DAY) + 1;
  const hour = tick % HOURS_PER_DAY;
  return `Day ${day.toString()} · Hour ${hour.toString()}`;
}

function matchesLocationFilters(
  context: AssignmentContext,
  selection: ReturnType<typeof useWorkforceFilters>["selection"]
): boolean {
  if (selection.structureId && context.structureId !== selection.structureId) {
    return false;
  }

  if (selection.roomId && context.roomId !== selection.roomId) {
    return false;
  }

  if (selection.zoneId && context.zoneId !== selection.zoneId) {
    return false;
  }

  return true;
}

function buildRoleOptions(directory: readonly HrDirectoryEntry[]): WorkforceFilterOption[] {
  const roles = Array.from(new Set(directory.map((entry) => entry.role))).sort((left, right) => left.localeCompare(right));
  return [{ value: null, label: "All roles" }, ...roles.map((role) => ({ value: role, label: role }))];
}

function buildLatestActivityByEmployee(entries: readonly HrActivityEntry[]): Map<string, HrActivityEntry> {
  const activityMap = new Map<string, HrActivityEntry>();
  for (const entry of entries) {
    if (!entry.assigneeId) {
      continue;
    }
    activityMap.set(entry.assigneeId, entry);
  }
  return activityMap;
}

function resolveTaskContext(
  entry: HrTaskQueueEntry,
  index: LocationIndex
): AssignmentContext {
  if (entry.targetScope === "zone") {
    const zone = index.zones.get(entry.targetId);
    if (zone) {
      return zone;
    }
    return {
      structureId: null,
      structureName: null,
      roomId: null,
      roomName: null,
      zoneId: entry.targetId,
      zoneName: entry.targetId
    } satisfies AssignmentContext;
  }

  if (entry.targetScope === "room") {
    const room = index.rooms.get(entry.targetId);
    if (room) {
      return room;
    }
    return {
      structureId: null,
      structureName: null,
      roomId: entry.targetId,
      roomName: entry.targetId,
      zoneId: null,
      zoneName: null
    } satisfies AssignmentContext;
  }

  const structure = index.structures.get(entry.targetId);
  if (structure) {
    return {
      structureId: structure.structureId,
      structureName: structure.structureName,
      roomId: null,
      roomName: null,
      zoneId: null,
      zoneName: null
    } satisfies AssignmentContext;
  }

  const device = index.devices.get(entry.targetId);
  if (device) {
    return device;
  }

  return {
    structureId: null,
    structureName: null,
    roomId: null,
    roomName: null,
    zoneId: null,
    zoneName: null
  } satisfies AssignmentContext;
}

function resolveScopeLabel(entry: HrTaskQueueEntry, context: AssignmentContext): string {
  const scope = entry.targetScope;
  if (scope === "zone" && context.zoneName) {
    return `Zone · ${context.zoneName}`;
  }
  if (scope === "room" && context.roomName) {
    return `Room · ${context.roomName}`;
  }
  if (scope === "structure" && context.structureName) {
    return `Structure · ${context.structureName}`;
  }
  return `${scope.charAt(0).toUpperCase()}${scope.slice(1)} · ${entry.targetId}`;
}

function buildAssigneeOptions(directory: readonly HrDirectoryEntry[]): WorkforceAssigneeOption[] {
  return directory.map((entry) => ({
    id: entry.id,
    label: `${entry.name} — ${entry.role}`
  }));
}

function buildAssignmentTargets(structures: readonly StructureReadModel[]): WorkforceActionTargetOption[] {
  const targets: WorkforceActionTargetOption[] = [];

  for (const structure of structures) {
    targets.push({ id: structure.id, label: `Structure · ${structure.name}` });

    for (const room of structure.rooms) {
      targets.push({ id: room.id, label: `${structure.name} › ${room.name}` });
      for (const zone of room.zones) {
        targets.push({ id: zone.id, label: `${structure.name} › ${room.name} › ${zone.name}` });
      }
    }
  }

  return targets;
}

function buildZoneTargets(index: LocationIndex): WorkforceActionTargetOption[] {
  return Array.from(index.zones.values(), (zone) => ({
    id: zone.zoneId,
    label: formatLocationPath(zone, zone.zoneName ?? zone.zoneId)
  })).sort((left, right) => left.label.localeCompare(right.label));
}

function buildMaintenanceTargets(index: LocationIndex, taskQueues: readonly HrTaskQueue[]): WorkforceActionTargetOption[] {
  const targets = new Map<string, string>();
  for (const queue of taskQueues) {
    for (const entry of queue.entries) {
      if (entry.type !== "maintenance") {
        continue;
      }
      const context = resolveTaskContext(entry, index);
      const label = formatLocationPath(context, entry.targetId);
      targets.set(entry.targetId, label);
    }
  }

  return Array.from(targets.entries(), ([id, label]) => ({ id, label })).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

export function WorkforcePage({ intentClient = null }: WorkforcePageProps = {}): ReactElement {
  const hr = useHRReadModel();
  const structures = useStructureReadModels();
  const locale = useShellLocale();
  const { selection, setStructure, setRoom, setZone, setRole } = useWorkforceFilters();
  const locationIndex = useMemo(() => createLocationIndex(structures), [structures]);
  const latestActivityByEmployee = useMemo(
    () => buildLatestActivityByEmployee(hr.activityTimeline),
    [hr.activityTimeline]
  );
  const directoryMap = useMemo(() => new Map(hr.directory.map((entry) => [entry.id, entry])), [hr.directory]);

  const roleOptions = useMemo(() => buildRoleOptions(hr.directory), [hr.directory]);
  const structureOptions = useMemo<WorkforceFilterOption[]>(
    () => [{ value: null, label: "All structures" }, ...structures.map((structure) => ({ value: structure.id, label: structure.name }))],
    [structures]
  );

  const rooms = useMemo(() => {
    if (selection.structureId) {
      return structures.find((structure) => structure.id === selection.structureId)?.rooms ?? [];
    }
    return structures.flatMap((structure) => structure.rooms);
  }, [structures, selection.structureId]);

  const roomOptions = useMemo<WorkforceFilterOption[]>(() => {
    const options: WorkforceFilterOption[] = [{ value: null, label: "All rooms" }];
    for (const room of rooms) {
      const parentStructure = structures.find((structure) => structure.rooms.some((candidate) => candidate.id === room.id));
      const label = parentStructure && !selection.structureId ? `${parentStructure.name} — ${room.name}` : room.name;
      options.push({ value: room.id, label });
    }
    return options;
  }, [rooms, structures, selection.structureId]);

  const zones = useMemo(() => {
    if (selection.roomId) {
      return rooms.find((room) => room.id === selection.roomId)?.zones ?? [];
    }
    return rooms.flatMap((room) => room.zones);
  }, [rooms, selection.roomId]);

  const zoneOptions = useMemo<WorkforceFilterOption[]>(() => {
    const options: WorkforceFilterOption[] = [{ value: null, label: "All zones" }];
    for (const zone of zones) {
      const parentRoom = rooms.find((room) => room.zones.some((candidate) => candidate.id === zone.id)) ?? null;
      const parentStructure = structures.find((structure) => structure.rooms.some((candidate) => candidate.id === parentRoom?.id)) ?? null;
      const labelParts: string[] = [];
      if (parentStructure && !selection.structureId) {
        labelParts.push(parentStructure.name);
      }
      if (parentRoom && !selection.roomId) {
        labelParts.push(parentRoom.name);
      }
      labelParts.push(zone.name);
      options.push({ value: zone.id, label: labelParts.join(" — ") });
    }
    return options;
  }, [zones, rooms, structures, selection.structureId, selection.roomId]);

  const directoryFilters: WorkforceDirectoryFiltersProps = {
    structures: structureOptions,
    rooms: roomOptions,
    zones: zoneOptions,
    roles: roleOptions,
    selectedStructureId: selection.structureId,
    selectedRoomId: selection.roomId,
    selectedZoneId: selection.zoneId,
    selectedRole: selection.role,
    onStructureChange: setStructure,
    onRoomChange: setRoom,
    onZoneChange: setZone,
    onRoleChange: setRole
  } satisfies WorkforceDirectoryFiltersProps;

  const directoryEntries = useMemo<WorkforceDirectoryEntryView[]>(() => {
    return hr.directory
      .map((entry) => {
        const context = resolveAssignmentContext(entry.assignment, locationIndex);
        return {
          entry,
          context
        };
      })
      .filter(({ entry, context }) => {
        if (!matchesLocationFilters(context, selection)) {
          return false;
        }
        if (selection.role && entry.role !== selection.role) {
          return false;
        }
        return true;
      })
      .map(({ entry, context }) => {
        const recentActivity = latestActivityByEmployee.get(entry.id);
        return {
          id: entry.id,
          name: entry.name,
          role: entry.role,
          hourlyCostLabel: `${formatCurrency(entry.hourlyCost, locale)}/h`,
          moralePercent: entry.moralePercent,
          fatiguePercent: entry.fatiguePercent,
          skills: entry.skills,
          assignmentLabel: formatAssignmentLabel(entry.assignment.assignedScope),
          locationPath: formatLocationPath(context, entry.assignment.targetId),
          overtimeMinutes: entry.overtimeMinutes,
          recentActivity: recentActivity ? recentActivity.description : null
        } satisfies WorkforceDirectoryEntryView;
      });
  }, [
    hr.directory,
    latestActivityByEmployee,
    selection,
    locale,
    locationIndex
  ]);

  const activityEntries = useMemo<WorkforceActivityEntryView[]>(() => {
    return hr.activityTimeline
      .map((entry) => {
        const assignee = entry.assigneeId ? directoryMap.get(entry.assigneeId) ?? null : null;
        const context = assignee
          ? resolveAssignmentContext(assignee.assignment, locationIndex)
          : ({
              structureId: null,
              structureName: null,
              roomId: null,
              roomName: null,
              zoneId: null,
              zoneName: null
            } satisfies AssignmentContext);
        return { entry, context, assignee };
      })
      .filter(({ assignee, context }) => {
        if (!matchesLocationFilters(context, selection)) {
          return false;
        }
        if (selection.role) {
          if (!assignee) {
            return false;
          }
          return assignee.role === selection.role;
        }
        return true;
      })
      .map(({ entry, context, assignee }) => {
        const scopeLabel = (() => {
          if (entry.scope === "zone" && context.zoneName) {
            return `Zone · ${context.zoneName}`;
          }
          if (entry.scope === "room" && context.roomName) {
            return `Room · ${context.roomName}`;
          }
          if (entry.scope === "structure" && context.structureName) {
            return `Structure · ${context.structureName}`;
          }
          return `${entry.scope.charAt(0).toUpperCase()}${entry.scope.slice(1)}`;
        })();

        const assigneeLabel = assignee ? `Assignee · ${assignee.name}` : null;

        return {
          id: entry.id,
          timestampLabel: formatTickLabel(entry.timestamp),
          title: entry.title,
          description: entry.description,
          scopeLabel,
          assigneeLabel,
          durationLabel: DEFAULT_DURATION_LABEL
        } satisfies WorkforceActivityEntryView;
      });
  }, [
    hr.activityTimeline,
    directoryMap,
    selection,
    locationIndex
  ]);

  const assigneeOptions = useMemo(() => buildAssigneeOptions(hr.directory), [hr.directory]);

  const acknowledgementHandlers: IntentSubmissionHandlers = useMemo(
    () => ({ onResult: () => undefined }),
    []
  );

  const queueViews = useMemo<WorkforceTaskQueueView[]>(() => {
    return hr.taskQueues.map((queue) => ({
      id: queue.id,
      title: queue.title,
      entries: queue.entries
        .map((entry) => {
          const context = resolveTaskContext(entry, locationIndex);
          const assignee = entry.assigneeId ? directoryMap.get(entry.assigneeId) ?? null : null;
          return { entry, context, assignee };
        })
        .filter(({ assignee, context }) => {
          if (!matchesLocationFilters(context, selection)) {
            return false;
          }
          if (selection.role) {
            if (!assignee) {
              return false;
            }
            return assignee.role === selection.role;
          }
          return true;
        })
        .map(({ entry, context, assignee }) => {
          const actions: WorkforceTaskQueueEntryAction[] = [];
          if (entry.type === "inspection") {
            actions.push({
              label: "Acknowledge inspection",
              onClick: () => {
                if (!intentClient) {
                  return;
                }

                void intentClient
                  .submit(
                    { type: PEST_INSPECTION_START_INTENT, zoneId: entry.targetId },
                    acknowledgementHandlers
                  )
                  .catch(() => undefined);
              },
              disabled: !intentClient
            });
            actions.push({
              label: "Complete inspection",
              onClick: () => {
                if (!intentClient) {
                  return;
                }

                void intentClient
                  .submit(
                    { type: PEST_INSPECTION_COMPLETE_INTENT, zoneId: entry.targetId },
                    acknowledgementHandlers
                  )
                  .catch(() => undefined);
              },
              disabled: !intentClient
            });
          } else if (entry.type === "treatment") {
            actions.push({
              label: "Launch treatment",
              onClick: () => {
                if (!intentClient) {
                  return;
                }

                void intentClient
                  .submit(
                    { type: PEST_TREATMENT_START_INTENT, zoneId: entry.targetId },
                    acknowledgementHandlers
                  )
                  .catch(() => undefined);
              },
              disabled: !intentClient
            });
            actions.push({
              label: "Complete treatment",
              onClick: () => {
                if (!intentClient) {
                  return;
                }

                void intentClient
                  .submit(
                    { type: PEST_TREATMENT_COMPLETE_INTENT, zoneId: entry.targetId },
                    acknowledgementHandlers
                  )
                  .catch(() => undefined);
              },
              disabled: !intentClient
            });
          } else if (entry.type === "maintenance") {
            actions.push({
              label: "Start maintenance",
              onClick: () => {
                if (!intentClient) {
                  return;
                }

                void intentClient
                  .submit(
                    { type: MAINTENANCE_START_INTENT, deviceId: entry.targetId },
                    acknowledgementHandlers
                  )
                  .catch(() => undefined);
              },
              disabled: !intentClient
            });
            actions.push({
              label: "Complete maintenance",
              onClick: () => {
                if (!intentClient) {
                  return;
                }

                void intentClient
                  .submit(
                    { type: MAINTENANCE_COMPLETE_INTENT, deviceId: entry.targetId },
                    acknowledgementHandlers
                  )
                  .catch(() => undefined);
              },
              disabled: !intentClient
            });
          }

          return {
            id: entry.id,
            typeLabel: `${entry.type.charAt(0).toUpperCase()}${entry.type.slice(1)}`,
            statusLabel: `Status: ${entry.status.replace(/-/g, " ")}`,
            scopeLabel: resolveScopeLabel(entry, context),
            dueLabel: formatTickLabel(entry.dueTick),
            assigneeId: entry.assigneeId,
            assigneeName: assignee ? assignee.name : null,
            assignable: true,
            onAssign: (assigneeId) => {
              if (!assigneeId) {
                return;
              }
              if (!intentClient) {
                return;
              }

              void intentClient
                .submit(
                  { type: HR_ASSIGN_INTENT, employeeId: assigneeId, target: entry.targetId },
                  acknowledgementHandlers
                )
                .catch(() => undefined);
            },
            actions
          };
        })
    } satisfies WorkforceTaskQueueView));
  }, [
    hr.taskQueues,
    selection,
    locationIndex,
    directoryMap,
    intentClient,
    acknowledgementHandlers
  ]);

  const capacityEntries = useMemo<WorkforceCapacityEntryView[]>(() => {
    return hr.capacitySnapshot.map((entry) => {
      const coverageDelta = entry.headcount - entry.queuedTasks;
      const coverageHint = (() => {
        if (coverageDelta > 0) {
          return `Surplus capacity: ${coverageDelta.toString()} team member(s) available.`;
        }
        if (coverageDelta === 0) {
          return "Balanced coverage across open tasks.";
        }
        return `Understaffed by ${Math.abs(coverageDelta).toString()} team member(s).`;
      })();
      const coverageStatus: WorkforceCapacityEntryView["coverageStatus"] =
        entry.coverageStatus === "block" ? "critical" : entry.coverageStatus;

      return {
        role: entry.role,
        headcount: entry.headcount,
        queuedTasks: entry.queuedTasks,
        coverageStatus,
        coverageHint
      } satisfies WorkforceCapacityEntryView;
    });
  }, [hr.capacitySnapshot]);

  const assignmentTargets = useMemo(() => buildAssignmentTargets(structures), [structures]);
  const zoneTargets = useMemo(() => buildZoneTargets(locationIndex), [locationIndex]);
  const maintenanceTargets = useMemo(
    () => buildMaintenanceTargets(locationIndex, hr.taskQueues),
    [locationIndex, hr.taskQueues]
  );

  return (
    <section aria-label="HR surface" className="flex flex-1 flex-col gap-8">
      <WorkforceDirectory filters={directoryFilters} entries={directoryEntries} />
      <WorkforceActivityTimeline entries={activityEntries} />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <WorkforceTaskQueues queues={queueViews} assignees={assigneeOptions} />
        <WorkforceCapacitySnapshot entries={capacityEntries} />
      </div>
      <WorkforceActionPanel
        employees={assigneeOptions}
        assignmentTargets={assignmentTargets}
        zoneTargets={zoneTargets}
        maintenanceTargets={maintenanceTargets}
        intentsEnabled={Boolean(intentClient)}
        onAssign={(employeeId, targetId) => {
          if (!employeeId || !targetId) {
            return;
          }
          if (!intentClient) {
            return;
          }

          void intentClient
            .submit({ type: HR_ASSIGN_INTENT, employeeId, target: targetId }, acknowledgementHandlers)
            .catch(() => undefined);
        }}
        onInspectionStart={(zoneId) => {
          if (!intentClient) {
            return;
          }

          void intentClient
            .submit({ type: PEST_INSPECTION_START_INTENT, zoneId }, acknowledgementHandlers)
            .catch(() => undefined);
        }}
        onInspectionComplete={(zoneId) => {
          if (!intentClient) {
            return;
          }

          void intentClient
            .submit({ type: PEST_INSPECTION_COMPLETE_INTENT, zoneId }, acknowledgementHandlers)
            .catch(() => undefined);
        }}
        onTreatmentStart={(zoneId) => {
          if (!intentClient) {
            return;
          }

          void intentClient
            .submit({ type: PEST_TREATMENT_START_INTENT, zoneId }, acknowledgementHandlers)
            .catch(() => undefined);
        }}
        onTreatmentComplete={(zoneId) => {
          if (!intentClient) {
            return;
          }

          void intentClient
            .submit({ type: PEST_TREATMENT_COMPLETE_INTENT, zoneId }, acknowledgementHandlers)
            .catch(() => undefined);
        }}
        onMaintenanceStart={(targetId) => {
          if (!intentClient) {
            return;
          }

          void intentClient
            .submit({ type: MAINTENANCE_START_INTENT, deviceId: targetId }, acknowledgementHandlers)
            .catch(() => undefined);
        }}
        onMaintenanceComplete={(targetId) => {
          if (!intentClient) {
            return;
          }

          void intentClient
            .submit({ type: MAINTENANCE_COMPLETE_INTENT, deviceId: targetId }, acknowledgementHandlers)
            .catch(() => undefined);
        }}
      />
    </section>
  );
}

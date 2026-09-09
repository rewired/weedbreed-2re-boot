import { HOURS_PER_DAY } from "@engine/constants/simConstants.ts";
import type { WorkforceFilterOption } from "@ui/components/workforce/Directory";
import type { WorkforceAssigneeOption } from "@ui/components/workforce/TaskQueues";
import type { WorkforceActionTargetOption } from "@ui/components/workforce/ActionPanel";
import { useWorkforceFilters } from "@ui/state/workforce";
import type {
  HrActivityEntry,
  HrDirectoryEntry,
  HrTaskQueue,
  HrTaskQueueEntry,
  StructureReadModel,
  WorkforceAssignment
} from "@ui/state/readModels.types";

export interface AssignmentContext {
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

export interface LocationIndex {
  readonly structures: Map<string, StructureLocation>;
  readonly rooms: Map<string, RoomLocation>;
  readonly zones: Map<string, ZoneLocation>;
  readonly devices: Map<string, AssignmentContext>;
}

export function createLocationIndex(structures: readonly StructureReadModel[]): LocationIndex {
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

export function resolveAssignmentContext(
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

export function formatLocationPath(context: AssignmentContext, fallback: string): string {
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

export function formatAssignmentLabel(scope: WorkforceAssignment["assignedScope"]): string {
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

export function formatTickLabel(tick: number): string {
  const day = Math.floor(tick / HOURS_PER_DAY) + 1;
  const hour = tick % HOURS_PER_DAY;
  return `Day ${day.toString()} · Hour ${hour.toString()}`;
}

export function matchesLocationFilters(
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

export function buildRoleOptions(directory: readonly HrDirectoryEntry[]): WorkforceFilterOption[] {
  const roles = Array.from(new Set(directory.map((entry) => entry.role))).sort((left, right) => left.localeCompare(right));
  return [{ value: null, label: "All roles" }, ...roles.map((role) => ({ value: role, label: role }))];
}

export function buildLatestActivityByEmployee(entries: readonly HrActivityEntry[]): Map<string, HrActivityEntry> {
  const activityMap = new Map<string, HrActivityEntry>();
  for (const entry of entries) {
    if (!entry.assigneeId) {
      continue;
    }
    activityMap.set(entry.assigneeId, entry);
  }
  return activityMap;
}

export function resolveTaskContext(
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

export function resolveScopeLabel(entry: HrTaskQueueEntry, context: AssignmentContext): string {
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

export function buildAssigneeOptions(directory: readonly HrDirectoryEntry[]): WorkforceAssigneeOption[] {
  return directory.map((entry) => ({
    id: entry.id,
    label: `${entry.name} — ${entry.role}`
  }));
}

export function buildAssignmentTargets(structures: readonly StructureReadModel[]): WorkforceActionTargetOption[] {
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

export function buildZoneTargets(index: LocationIndex): WorkforceActionTargetOption[] {
  return Array.from(index.zones.values(), (zone) => ({
    id: zone.zoneId,
    label: formatLocationPath(zone, zone.zoneName ?? zone.zoneId)
  })).sort((left, right) => left.label.localeCompare(right.label));
}

export function buildMaintenanceTargets(index: LocationIndex, taskQueues: readonly HrTaskQueue[]): WorkforceActionTargetOption[] {
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

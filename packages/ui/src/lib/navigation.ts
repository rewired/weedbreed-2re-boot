export interface WorkspaceZoneNavItem {
  id: string;
  name: string;
  cultivationMethod: string;
}

export interface WorkspaceRoomNavItem {
  id: string;
  name: string;
  purpose: string;
  zones: WorkspaceZoneNavItem[];
}

export interface WorkspaceStructureNavItem {
  id: string;
  name: string;
  location: string;
  rooms: WorkspaceRoomNavItem[];
  zones: WorkspaceZoneNavItem[];
}

export const workspaceStructures: WorkspaceStructureNavItem[] = [
  {
    id: "structure-green-harbor",
    name: "Green Harbor",
    location: "Hamburg",
    rooms: [
      {
        id: "room-veg-a",
        name: "Veg Room A",
        purpose: "growroom",
        zones: [
          { id: "zone-veg-a-1", name: "Veg A-1", cultivationMethod: "cm-sea-of-green" },
          { id: "zone-veg-a-2", name: "Veg A-2", cultivationMethod: "cm-screen-of-green" }
        ]
      },
      {
        id: "room-post-process",
        name: "Post-Processing",
        purpose: "storageroom",
        zones: []
      }
    ],
    zones: [
      { id: "zone-veg-a-1", name: "Veg A-1", cultivationMethod: "cm-sea-of-green" },
      { id: "zone-veg-a-2", name: "Veg A-2", cultivationMethod: "cm-screen-of-green" }
    ]
  },
  {
    id: "structure-harvest-hall",
    name: "Harvest Hall",
    location: "North Annex",
    rooms: [
      {
        id: "room-propagation",
        name: "Propagation",
        purpose: "growroom",
        zones: [
          { id: "zone-prop-1", name: "Propagation Bay", cultivationMethod: "basic-soil-pot" }
        ]
      },
      {
        id: "room-drying",
        name: "Drying",
        purpose: "storageroom",
        zones: [
          { id: "zone-drying", name: "Drying Suite", cultivationMethod: "post-harvest" }
        ]
      }
    ],
    zones: [
      { id: "zone-prop-1", name: "Propagation Bay", cultivationMethod: "basic-soil-pot" },
      { id: "zone-drying", name: "Drying Suite", cultivationMethod: "post-harvest" }
    ]
  }
];

export const workspaceTopLevelRoutes = {
  company: { label: "Company overview", path: "/dashboard" },
  structures: { label: "Structures overview", path: "/structures" },
  hr: { label: "Workforce KPIs", path: "/workforce" },
  strains: { label: "Strain library", path: "/strains" }
} as const;

export function buildZonePath(structureId: string, zoneId: string): string {
  return `/structures/${structureId}/zones/${zoneId}`;
}

export function buildRoomPath(structureId: string, roomId: string): string {
  return `/structures/${structureId}/rooms/${roomId}`;
}

export interface ResolvedZoneNavItem {
  structure: WorkspaceStructureNavItem;
  zone: WorkspaceZoneNavItem;
}

export function resolveZoneByParams(
  structureId: string | undefined,
  zoneId: string | undefined
): ResolvedZoneNavItem | undefined {
  if (!structureId || !zoneId) {
    return undefined;
  }

  const structure = workspaceStructures.find((item) => item.id === structureId);

  if (!structure) {
    return undefined;
  }

  const zone = structure.zones.find((item) => item.id === zoneId);

  if (!zone) {
    return undefined;
  }

  return { structure, zone };
}

export interface ResolvedRoomNavItem {
  structure: WorkspaceStructureNavItem;
  room: WorkspaceRoomNavItem;
}

export function resolveRoomByParams(
  structureId: string | undefined,
  roomId: string | undefined
): ResolvedRoomNavItem | undefined {
  if (!structureId || !roomId) {
    return undefined;
  }

  const structure = workspaceStructures.find((item) => item.id === structureId);

  if (!structure) {
    return undefined;
  }

  const room = structure.rooms.find((item) => item.id === roomId);

  if (!room) {
    return undefined;
  }

  return { structure, room };
}

export interface RoomBreadcrumbLink {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

export function buildRoomBreadcrumbs(
  structureId: string,
  structureLabel: string,
  roomId: string,
  roomLabel: string
): RoomBreadcrumbLink[] {
  return [
    { id: "structures", label: workspaceTopLevelRoutes.structures.label, path: workspaceTopLevelRoutes.structures.path },
    { id: structureId, label: structureLabel, path: `/structures/${structureId}` },
    { id: roomId, label: roomLabel, path: buildRoomPath(structureId, roomId) }
  ];
}

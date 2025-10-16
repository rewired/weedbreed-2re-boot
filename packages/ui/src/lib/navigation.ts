export interface WorkspaceZoneNavItem {
  id: string;
  name: string;
  cultivationMethod: string;
}

export interface WorkspaceStructureNavItem {
  id: string;
  name: string;
  location: string;
  zones: WorkspaceZoneNavItem[];
}

export const workspaceStructures: WorkspaceStructureNavItem[] = [
  {
    id: "structure-evergreen-gardens",
    name: "Evergreen Gardens",
    location: "Green District",
    zones: [
      { id: "zone-veg-a", name: "Vegetative A", cultivationMethod: "sea-of-green" },
      { id: "zone-flower-1", name: "Flower Room 1", cultivationMethod: "screen-of-green" }
    ]
  },
  {
    id: "structure-harvest-hall",
    name: "Harvest Hall",
    location: "North Annex",
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

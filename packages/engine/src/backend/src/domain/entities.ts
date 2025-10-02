/**
 * Branded string type representing a UUID v4 identifier.
 */
export type Uuid = string & { readonly __brand: unique symbol };

/**
 * Canonical list of supported room purposes as mandated by SEC §2.1.
 */
export const ROOM_PURPOSES = [
  'growroom',
  'breakroom',
  'laboratory',
  'storageroom',
  'salesroom',
  'workshop'
] as const;

/**
 * Union type of all valid room purposes.
 */
export type RoomPurpose = (typeof ROOM_PURPOSES)[number];

/**
 * Canonical placement scopes for device instances per SEC §2 & §6.
 */
export const DEVICE_PLACEMENT_SCOPES = ['structure', 'room', 'zone'] as const;

/**
 * Union type describing where a device instance may be attached in the world tree.
 */
export type DevicePlacementScope = (typeof DEVICE_PLACEMENT_SCOPES)[number];

/**
 * Canonical lifecycle stages for plants as required by SEC §8.1.
 */
export const PLANT_LIFECYCLE_STAGES = [
  'seedling',
  'vegetative',
  'flowering',
  'harvest-ready'
] as const;

/**
 * Union type describing the lifecycle stage of a plant instance.
 */
export type PlantLifecycleStage = (typeof PLANT_LIFECYCLE_STAGES)[number];

/**
 * Photoperiod phase for a zone indicating the currently active light regime.
 */
export type PhotoperiodPhase = 'vegetative' | 'flowering';

/**
 * Canonical representation of a deterministic light schedule using a 24-hour cycle.
 */
export interface LightSchedule {
  /** Number of hours per day that lights remain on. */
  readonly onHours: number;
  /** Number of hours per day that lights remain off. */
  readonly offHours: number;
  /** Offset in hours from midnight that the light cycle begins. */
  readonly startHour: number;
}

/**
 * Base contract for any entity that participates in the world tree.
 */
export interface DomainEntity {
  /** Unique identifier of the entity (UUID v4). */
  readonly id: Uuid;
  /** Human readable label. */
  readonly name: string;
}

/**
 * Entity mixin that exposes an immutable slug for referencing blueprints.
 */
export interface SluggedEntity {
  /** Immutable slug referencing blueprint or catalog metadata. */
  readonly slug: string;
}

/**
 * Spatial characteristics shared by structures, rooms, and zones.
 */
export interface SpatialEntity {
  /** Floor area expressed in square metres. */
  readonly floorArea_m2: number;
  /** Interior height expressed in metres. */
  readonly height_m: number;
}

/**
 * Geographic location metadata associated with a company headquarters.
 * Essential for SEC-aligned logistics, localisation, and compliance features.
 */
export interface CompanyLocation {
  /** Longitude coordinate expressed in decimal degrees within [-180, 180]. */
  readonly lon: number;
  /** Latitude coordinate expressed in decimal degrees within [-90, 90]. */
  readonly lat: number;
  /** City name describing the headquarters locality. */
  readonly cityName: string;
  /** Country name describing the headquarters locality. */
  readonly countryName: string;
}

/**
 * Canonical device instance model shared across placement scopes.
 */
export interface DeviceInstance extends DomainEntity, SluggedEntity {
  /** Identifier of the blueprint from which this device instance was created. */
  readonly blueprintId: Uuid;
  /** Placement scope describing where the device is attached. */
  readonly placementScope: DevicePlacementScope;
  /** Intrinsic build quality on the canonical [0,1] scale. */
  readonly quality01: number;
  /** Dynamic condition on the canonical [0,1] scale. */
  readonly condition01: number;
  /** Electrical power draw expressed in watts. */
  readonly powerDraw_W: number;
  /** Duty cycle applied during the current tick on the canonical [0,1] scale. */
  readonly dutyCycle01: number;
  /** Useful-work efficiency on the canonical [0,1] scale per SEC §6.1. */
  readonly efficiency01: number;
  /** Maximum sensible heat removal capacity expressed in watts. */
  readonly sensibleHeatRemovalCapacity_W: number;
}

/**
 * Device instance that is mounted directly at the structure scope.
 */
export type StructureDeviceInstance = DeviceInstance & {
  readonly placementScope: 'structure';
};

/**
 * Device instance that is mounted at the room scope.
 */
export type RoomDeviceInstance = DeviceInstance & {
  readonly placementScope: 'room';
};

/**
 * Device instance that is mounted at the zone scope.
 */
export type ZoneDeviceInstance = DeviceInstance & {
  readonly placementScope: 'zone';
};

/**
 * Canonical representation of a plant instance within a zone.
 */
export interface Plant extends DomainEntity, SluggedEntity {
  /** Identifier of the strain blueprint driving this plant. */
  readonly strainId: Uuid;
  /** Lifecycle stage as mandated by SEC §8.1. */
  readonly lifecycleStage: PlantLifecycleStage;
  /** Age of the plant in in-game hours. */
  readonly ageHours: number;
  /** Health indicator on the canonical [0,1] scale. */
  readonly health01: number;
  /** Density-normalised biomass expressed in grams. */
  readonly biomass_g: number;
  /** Identifier of the selected container blueprint. */
  readonly containerId: Uuid;
  /** Identifier of the selected substrate blueprint. */
  readonly substrateId: Uuid;
}

/**
 * Canonical representation of a controllable zone inside a growroom.
 */
export interface Zone extends DomainEntity, SluggedEntity, SpatialEntity {
  /** Identifier of the cultivation method blueprint applied to this zone. */
  readonly cultivationMethodId: Uuid;
  /** Identifier of the irrigation method blueprint applied to this zone. */
  readonly irrigationMethodId: Uuid;
  /** Identifier of the container blueprint chosen for plants in this zone. */
  readonly containerId: Uuid;
  /** Identifier of the substrate blueprint chosen for plants in this zone. */
  readonly substrateId: Uuid;
  /** Light schedule applied to the zone (photoperiod control). */
  readonly lightSchedule: LightSchedule;
  /** Photoperiod phase currently active in the zone. */
  readonly photoperiodPhase: PhotoperiodPhase;
  /** Plant instances located within the zone. */
  readonly plants: readonly Plant[];
  /** Device instances mounted at the zone scope. */
  readonly devices: readonly ZoneDeviceInstance[];
  /** Environmental state describing the zone's well-mixed air mass. */
  readonly environment: ZoneEnvironment;
}

/**
 * Canonical representation of the environmental state maintained for a zone.
 */
export interface ZoneEnvironment {
  /** Dry-bulb air temperature expressed in degrees Celsius. */
  readonly airTemperatureC: number;
}

/**
 * Canonical representation of a physical room contained within a structure.
 */
export interface Room extends DomainEntity, SluggedEntity, SpatialEntity {
  /** Semantic purpose of the room (growroom, laboratory, etc.). */
  readonly purpose: RoomPurpose;
  /** Zones contained within the room. */
  readonly zones: readonly Zone[];
  /** Device instances mounted at the room scope. */
  readonly devices: readonly RoomDeviceInstance[];
}

/**
 * Canonical representation of a structure owned by the company.
 */
export interface Structure extends DomainEntity, SluggedEntity, SpatialEntity {
  /** Rooms contained within the structure. */
  readonly rooms: readonly Room[];
  /** Device instances mounted at the structure scope. */
  readonly devices: readonly StructureDeviceInstance[];
}

/**
 * Canonical representation of the company operating the simulation world.
 */
export interface Company extends DomainEntity, SluggedEntity {
  /** Geographic location of the company headquarters. */
  readonly location: CompanyLocation;
  /** Structures owned and operated by the company. */
  readonly structures: readonly Structure[];
}

/**
 * Canonical representation of the entire simulation world snapshot.
 */
export interface SimulationWorld {
  /** World metadata unique identifier. */
  readonly id: Uuid;
  /** Schema version of the serialized world representation. */
  readonly schemaVersion: string;
  /** Deterministic seed driving the simulation RNG streams. */
  readonly seed: string;
  /** Current simulation time expressed in in-game hours. */
  readonly simTimeHours: number;
  /** Company-centric world tree. */
  readonly company: Company;
}

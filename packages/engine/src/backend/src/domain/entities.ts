import type { HealthState } from './health/pestDisease.ts';
import type { Inventory } from './types/Inventory.ts';
import type { WorkforceState } from './workforce/WorkforceState.ts';
import type { Uuid as SchemaUuid } from './schemas/primitives.ts';

/**
 * Branded string type representing a UUID v4 identifier.
 */
export type Uuid = SchemaUuid;

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

export type DeviceEffectType =
  | 'thermal'
  | 'humidity'
  | 'lighting'
  | 'airflow'
  | 'filtration'
  | 'sensor'
  | 'co2';

export interface ThermalEffectConfig {
  readonly mode: 'heat' | 'cool' | 'auto';
  readonly max_heat_W?: number;
  readonly max_cool_W?: number;
  readonly setpoint_C?: number;
}

export interface HumidityEffectConfig {
  readonly mode: 'humidify' | 'dehumidify';
  readonly capacity_g_per_h: number;
}

export interface LightingEffectConfig {
  readonly ppfd_center_umol_m2s: number;
  readonly photonEfficacy_umol_per_J?: number;
}

export interface Co2EffectConfig {
  readonly target_ppm: number;
  readonly pulse_ppm_per_tick: number;
  readonly safetyMax_ppm: number;
  readonly min_ppm?: number;
  readonly ambient_ppm?: number;
  readonly hysteresis_ppm?: number;
}

export const SENSOR_MEASUREMENT_TYPES = ['temperature', 'humidity', 'ppfd', 'co2'] as const;

export type SensorMeasurementType = (typeof SENSOR_MEASUREMENT_TYPES)[number];

export interface SensorEffectConfig {
  readonly measurementType: SensorMeasurementType;
  readonly noise01: number;
}

export interface AirflowEffectConfig {
  readonly mode: 'recirculation' | 'exhaust' | 'intake';
  readonly airflow_m3_per_h: number;
}

export interface FiltrationEffectConfig {
  readonly filterType: 'carbon' | 'hepa' | 'pre-filter';
  readonly efficiency01: number;
  readonly basePressureDrop_pa: number;
}

export interface DeviceEffectConfigs {
  readonly thermal?: ThermalEffectConfig;
  readonly humidity?: HumidityEffectConfig;
  readonly lighting?: LightingEffectConfig;
  readonly airflow?: AirflowEffectConfig;
  readonly filtration?: FiltrationEffectConfig;
  readonly sensor?: SensorEffectConfig;
  readonly co2?: Co2EffectConfig;
}

export interface DeviceMaintenancePolicy {
  /** Total service life in operating hours before the device reaches end-of-life. */
  readonly lifetimeHours: number;
  /** Planned maintenance interval expressed in operating hours. */
  readonly maintenanceIntervalHours: number;
  /** Deterministic labour demand for a maintenance visit expressed in hours. */
  readonly serviceHours: number;
  /** Deterministic restoration applied to condition01 once service completes. */
  readonly restoreAmount01: number;
  /** Base maintenance cost recognised per operating hour (company credits). */
  readonly baseCostPerHourCc: number;
  /** Incremental maintenance cost per additional 1000 operating hours. */
  readonly costIncreasePer1000HoursCc: number;
  /** Dispatch cost for executing a maintenance visit (company credits). */
  readonly serviceVisitCostCc: number;
  /** Replacement cost sourced from the device price map (company credits). */
  readonly replacementCostCc: number;
  /** Condition threshold that forces an immediate maintenance window. */
  readonly maintenanceConditionThreshold01: number;
}

export interface DeviceMaintenanceWindow {
  /** Inclusive simulation tick when the maintenance window opens. */
  readonly startTick: number;
  /** Exclusive simulation tick when the maintenance window closes. */
  readonly endTick: number;
  /** Deterministic identifier referencing the scheduled maintenance task. */
  readonly taskId: Uuid;
  /** Reason describing why the maintenance window was opened. */
  readonly reason: 'interval' | 'condition';
}

export interface DeviceMaintenanceState {
  /** Total cumulative operating hours accrued by the device. */
  readonly runtimeHours: number;
  /** Operating hours elapsed since the most recent completed maintenance visit. */
  readonly hoursSinceService: number;
  /** Aggregate maintenance expenditure booked against the device (credits). */
  readonly totalMaintenanceCostCc: number;
  /** Number of successfully completed maintenance visits. */
  readonly completedServiceCount: number;
  /** Simulation tick when maintenance was most recently scheduled. */
  readonly lastServiceScheduledTick?: number;
  /** Simulation tick when maintenance most recently completed. */
  readonly lastServiceCompletedTick?: number;
  /** Active maintenance window awaiting execution. */
  readonly maintenanceWindow?: DeviceMaintenanceWindow;
  /** Flag indicating whether replacement is now more economical than maintenance. */
  readonly recommendedReplacement: boolean;
  /** Deterministic policy parameters derived from blueprints + price maps. */
  readonly policy?: DeviceMaintenancePolicy;
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
  /** Effective floor coverage provided by the device expressed in square metres. */
  readonly coverage_m2: number;
  /** Volumetric airflow throughput expressed in cubic metres per hour. */
  readonly airflow_m3_per_h: number;
  /** Maximum sensible heat removal capacity expressed in watts. */
  readonly sensibleHeatRemovalCapacity_W: number;
  /** Explicit enumeration of effects copied from the originating blueprint, when available. */
  readonly effects?: readonly DeviceEffectType[];
  /** Effect-specific configuration payloads copied from the originating blueprint, when available. */
  readonly effectConfigs?: DeviceEffectConfigs;
  /** Deterministic lifecycle state covering degradation, maintenance, and economics. */
  readonly maintenance?: DeviceMaintenanceState;
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
  /** Flag indicating the plant is ready to be harvested during the harvest phase. */
  readonly readyForHarvest?: boolean;
  /** Tick when the plant was harvested; undefined when not yet harvested. */
  readonly harvestedAt_tick?: number;
  /** Terminal status to prevent double harvesting within the same lifecycle. */
  readonly status?: 'active' | 'harvested';
  /** Plant-specific moisture proxy on the canonical [0,1] scale. */
  readonly moisture01?: number;
  /** Plant-specific quality indicator on the canonical [0,1] scale. */
  readonly quality01?: number;
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
  /**
   * Total dry-air mass enclosed by the zone volume, expressed in kilograms.
   *
   * Derived during bootstrap as floor area × height × AIR_DENSITY_KG_PER_M3 so
   * downstream thermodynamics can consume a stable baseline without
   * re-computing volume each tick.
   */
  readonly airMass_kg: number;
  /** Environmental state describing the zone's well-mixed air mass. */
  readonly environment: ZoneEnvironment;
  /**
   * Photosynthetic photon flux density delivered to the zone canopy expressed
   * in µmol·m⁻²·s⁻¹.
   */
  readonly ppfd_umol_m2s: number;
  /**
   * Daily light integral increment accumulated during the current tick
   * expressed in mol·m⁻²·d⁻¹.
   */
  readonly dli_mol_m2d_inc: number;
  /**
   * Nutrient buffer inventory for the zone's substrate expressed in milligrams per nutrient.
   * Updated each tick by the irrigation and nutrients pipeline stage.
   */
  readonly nutrientBuffer_mg: Record<string, number>;
  /**
   * Substrate moisture proxy on the canonical [0,1] scale.
   * Phase 1: Reserved for future moisture control integration.
   */
  readonly moisture01: number;
}

/**
 * Canonical representation of the environmental state maintained for a zone.
 */
export interface ZoneEnvironment {
  /** Dry-bulb air temperature expressed in degrees Celsius. */
  readonly airTemperatureC: number;
  /** Relative humidity on the canonical [0,1] scale. */
  readonly relativeHumidity01: number;
  /** Carbon dioxide concentration expressed in parts per million. */
  readonly co2_ppm: number;
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
  /** Optional classifier describing semantic room class (e.g. room.storage). */
  readonly class?: string;
  /** Free-form tags describing the room. */
  readonly tags?: readonly string[];
  /** Inventory information when the room acts as a storage space. */
  readonly inventory?: Inventory;
}

/**
 * Canonical representation of a structure owned by the company.
 */
export interface StructureTariffOverride {
  readonly price_electricity?: number;
  readonly price_water?: number;
}

export interface Structure extends DomainEntity, SluggedEntity, SpatialEntity {
  /** Rooms contained within the structure. */
  readonly rooms: readonly Room[];
  /** Device instances mounted at the structure scope. */
  readonly devices: readonly StructureDeviceInstance[];
  /** Optional utility tariff override applied to this structure. */
  readonly tariffOverride?: StructureTariffOverride;
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
  /** Workforce directory, task queue, and KPI snapshots. */
  readonly workforce: WorkforceState;
  /** Aggregated health state including pest and disease risk signals. */
  readonly health?: HealthState;
}

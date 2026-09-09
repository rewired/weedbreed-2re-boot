export type CompatibilityStatus = "ok" | "warn" | "block";

import type { EconomyReadModel } from "@ui/state/economyReadModels.types";
import type { BreedingReadModel } from "@ui/state/breedingReadModels.types";
import type { RunSummaryReadModel } from "@ui/state/runSummaryReadModels.types";
export type { EconomyLedgerEntryReadModel, EconomyReadModel } from "@ui/state/economyReadModels.types";

export interface SimulationReadModel {
  readonly simTimeHours: number;
  readonly day: number;
  readonly hour: number;
  readonly tick: number;
  readonly speedMultiplier: number;
  readonly paused: boolean;
  readonly pendingIncidents: readonly SimulationIncidentSummary[];
}

export interface SimulationIncidentSummary {
  readonly id: string;
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "critical";
  readonly raisedAtTick: number;
  readonly status: "active" | "resolved";
  readonly zoneId: string;
  readonly measured: {
    readonly metric: "temperature_C";
    readonly value: number;
  };
  readonly targetBand: {
    readonly min: number;
    readonly max: number;
  };
  readonly consequence: {
    readonly code: "plant_heat_stress";
    readonly affectedPlantCount: number;
    readonly averagePlantHealth01: number | null;
  };
  readonly recommendedIntent: {
    readonly type: "intent.zone.climate.adjust.v1";
    readonly payload: {
      readonly structureId: string;
      readonly zoneId: string;
      readonly target: { readonly temperature_C: number };
    };
  };
  readonly resolvedAtTick: number | null;
}

export interface EconomyTariffReference {
  readonly structureId: string;
  readonly price_electricity: number;
  readonly price_water: number;
}

export interface EconomyTariffsSnapshot {
  readonly price_electricity: number;
  readonly price_water: number;
  readonly structures: readonly EconomyTariffReference[];
}

export interface DeviceSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly class: string;
  readonly placementScope: "structure" | "room" | "zone";
  readonly conditionPercent: number;
  readonly coverageArea_m2: number;
  readonly airflow_m3_per_hour: number;
  readonly powerDraw_kWh_per_hour: number;
  readonly warnings: readonly DeviceWarning[];
}

export interface DeviceWarning {
  readonly id: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "critical";
}

export interface StructureCapacitySummary {
  readonly areaUsed_m2: number;
  readonly areaFree_m2: number;
  readonly volumeUsed_m3: number;
  readonly volumeFree_m3: number;
}

export interface StructureCoverageSummary {
  readonly lightingCoverage01: number;
  readonly hvacCapacity01: number;
  readonly airflowAch: number;
  readonly warnings: readonly StructureWarning[];
}

export interface StructureWarning {
  readonly id: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "critical";
}

export interface StructureKpiSummary {
  readonly energyKwhPerDay: number;
  readonly waterM3PerDay: number;
  readonly labourHoursPerDay: number;
  readonly maintenanceCostPerHour: number;
}

export interface TimelineEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly scope: "structure" | "room" | "zone" | "hr";
  readonly title: string;
  readonly description: string;
  readonly status: "scheduled" | "in-progress" | "completed" | "blocked";
}

export interface ZoneKpiSnapshot {
  readonly healthPercent: number;
  readonly qualityPercent: number;
  readonly stressPercent: number;
  readonly biomass_kg: number;
  readonly growthRatePercent: number;
}

export interface ZonePestStatus {
  readonly activeIssues: number;
  readonly dueInspections: number;
  readonly upcomingTreatments: number;
  readonly nextInspectionTick: number;
  readonly lastInspectionTick: number;
}

export interface ZoneTaskEntry {
  readonly id: string;
  readonly type:
    | "inspection"
    | "treatment"
    | "harvest"
    | "maintenance"
    | "training";
  readonly status: "queued" | "in-progress" | "done";
  readonly assigneeId: string | null;
  readonly scheduledTick: number;
  readonly targetZoneId: string;
}

export interface ZoneReadModel {
  readonly id: string;
  readonly name: string;
  readonly area_m2: number;
  readonly volume_m3: number;
  readonly cultivationMethodId: string;
  readonly irrigationMethodId: string;
  readonly strainId: string;
  readonly maxPlants: number;
  readonly currentPlantCount: number;
  readonly readiness?: ZoneReadiness;
  readonly plants?: readonly ZonePlantProgress[];
  readonly harvestEligibility: ZoneHarvestEligibility;
  readonly sowEligibility?: ZoneSowEligibility;
  readonly strainChoices?: readonly ZoneStrainChoice[];
  readonly kpis: ZoneKpiSnapshot;
  readonly pestStatus: ZonePestStatus;
  readonly devices: readonly DeviceSummary[];
  readonly coverageWarnings: readonly DeviceWarning[];
  readonly climateSnapshot: ZoneClimateSnapshot;
  readonly timeline: readonly TimelineEntry[];
  readonly tasks: readonly ZoneTaskEntry[];
}

export interface ZonePlantProgress {
  readonly id: string;
  readonly strainId: string;
  readonly strainName: string;
  readonly phase: string;
  readonly ageHours: number;
  readonly health01: number;
  readonly biomassKg: number;
  readonly estimatedMaturityAtSimHour: number;
  readonly estimatedRemainingHours: number;
  readonly status: "active" | "harvested";
  readonly harvestReady: boolean;
}

export interface ZoneHarvestEligibility {
  readonly eligible: boolean;
  readonly plantIds: readonly string[];
  readonly reasons: readonly "no-harvest-ready-plants"[];
}

export interface InventoryLotReadModel {
  readonly lotId: string;
  readonly strainId: string;
  readonly strainName: string;
  readonly quality01: number;
  readonly freshWeightKg: number;
  readonly remainingFreshWeightKg: number;
  readonly remainingDryWeightKg: number;
  readonly moisture01: number;
  readonly structureId: string;
  readonly storageRoomId: string;
  readonly source: {
    readonly plantId: string;
    readonly zoneId: string;
    readonly harvestIntentId: string;
  };
  readonly createdAtTick: number;
  readonly salePreview: InventorySalePreviewReadModel | null;
}

/** Authoritative 50% sale quote projected by the facade. */
export interface InventorySalePreviewReadModel {
  readonly fraction01: number;
  readonly soldFreshWeightKg: number;
  readonly soldDryWeightKg: number;
  readonly priceCcPerDryGram: number;
  readonly qualityFactor: number;
  readonly proceedsCc: number;
  readonly balanceBeforeCc: number;
  readonly balanceAfterCc: number;
  readonly cycleContributionMarginAfterCc: number;
}

export interface InventoryReadModel {
  readonly lots: readonly InventoryLotReadModel[];
  readonly totalFreshWeightKg: number;
}

export interface ZoneSowEligibility {
  readonly eligible: boolean;
  readonly reasons: readonly ("zone-not-empty" | "capacity-exhausted" | "missing-prerequisites")[];
  readonly capacityRemaining: number;
}

export interface ZoneStrainChoice {
  readonly strainId: string;
  readonly slug: string;
  readonly name: string;
  readonly seedPriceCc: number;
  readonly eligible: boolean;
  readonly ineligibilityReason: "incompatible-cultivation-method" | null;
}

export interface ZoneClimateSnapshot {
  readonly temperature_C: number;
  readonly relativeHumidity_percent: number;
  readonly co2_ppm: number;
  readonly vpd_kPa: number;
  readonly ach_measured: number;
  readonly ach_target: number;
  readonly status: "ok" | "warn" | "critical";
}

export interface RoomCapacitySummary {
  readonly areaUsed_m2: number;
  readonly areaFree_m2: number;
  readonly volumeUsed_m3: number;
  readonly volumeFree_m3: number;
}

export interface RoomCoverageSummary {
  readonly achCurrent: number;
  readonly achTarget: number;
  readonly climateWarnings: readonly StructureWarning[];
}

export interface RoomReadModel {
  readonly id: string;
  readonly structureId: string;
  readonly name: string;
  readonly purpose: string;
  readonly area_m2: number;
  readonly volume_m3: number;
  readonly capacity: RoomCapacitySummary;
  readonly coverage: RoomCoverageSummary;
  readonly climateSnapshot: RoomClimateSnapshot;
  readonly devices: readonly DeviceSummary[];
  readonly zones: readonly ZoneReadModel[];
  readonly timeline: readonly TimelineEntry[];
}

export interface RoomClimateSnapshot {
  readonly temperature_C: number;
  readonly relativeHumidity_percent: number;
  readonly co2_ppm: number;
  readonly ach: number;
  readonly notes: string;
}

export interface StructureWorkforceSnapshot {
  readonly activeAssignments: readonly WorkforceAssignment[];
  readonly openTasks: number;
  readonly notes: string;
}

export interface WorkforceAssignment {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly role: string;
  readonly assignedScope: "structure" | "room" | "zone";
  readonly targetId: string;
}

export interface StructureReadModel {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly area_m2: number;
  readonly volume_m3: number;
  readonly capacity: StructureCapacitySummary;
  readonly coverage: StructureCoverageSummary;
  readonly kpis: StructureKpiSummary;
  readonly devices: readonly DeviceSummary[];
  readonly rooms: readonly RoomReadModel[];
  readonly workforce: StructureWorkforceSnapshot;
  readonly timeline: readonly TimelineEntry[];
}

export interface HrDirectoryEntry {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly hourlyCost: number;
  readonly moralePercent: number;
  readonly fatiguePercent: number;
  readonly skills: readonly string[];
  readonly assignment: WorkforceAssignment;
  readonly overtimeMinutes: number;
}

export interface HrActivityEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly title: string;
  readonly scope: "structure" | "room" | "zone";
  readonly description: string;
  readonly assigneeId: string | null;
}

export interface HrTaskQueueEntry {
  readonly id: string;
  readonly type: "inspection" | "treatment" | "maintenance" | "harvest";
  readonly targetId: string;
  readonly targetScope: "structure" | "room" | "zone";
  readonly dueTick: number;
  readonly status: "queued" | "assigned" | "in-progress";
  readonly assigneeId: string | null;
}

export interface HrTaskQueue {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly HrTaskQueueEntry[];
}

export interface HrCapacitySnapshot {
  readonly role: string;
  readonly headcount: number;
  readonly queuedTasks: number;
  readonly coverageStatus: CompatibilityStatus;
}

export interface HrReadModel {
  readonly directory: readonly HrDirectoryEntry[];
  readonly activityTimeline: readonly HrActivityEntry[];
  readonly taskQueues: readonly HrTaskQueue[];
  readonly capacitySnapshot: readonly HrCapacitySnapshot[];
}

export interface SeedlingPriceEntry {
  readonly id: string;
  readonly strainId: string;
  readonly pricePerUnit: number;
}

export interface ContainerPriceEntry {
  readonly id: string;
  readonly containerId: string;
  readonly capacityLiters: number;
  readonly pricePerUnit: number;
  readonly serviceLifeCycles: number;
}

export interface SubstratePriceEntry {
  readonly id: string;
  readonly substrateId: string;
  readonly unitPrice_per_L: number;
  readonly densityFactor_L_per_kg: number;
  readonly reuseCycles: number;
}

export interface IrrigationLinePriceEntry {
  readonly id: string;
  readonly irrigationMethodId: string;
  readonly pricePerSquareMeter: number;
}

export interface DevicePriceEntry {
  readonly id: string;
  readonly deviceBlueprintId?: string;
  readonly deviceSlug: string;
  readonly coverageArea_m2: number;
  readonly throughput_m3_per_hour: number;
  readonly capitalExpenditure: number;
}

export interface ZoneReadiness {
  readonly status: "ready" | "missing-prerequisites";
  readonly missingPrerequisites: readonly string[];
}

export interface PriceBookCatalog {
  readonly seedlings: readonly SeedlingPriceEntry[];
  readonly containers: readonly ContainerPriceEntry[];
  readonly substrates: readonly SubstratePriceEntry[];
  readonly irrigationLines: readonly IrrigationLinePriceEntry[];
  readonly devices: readonly DevicePriceEntry[];
}

export type CultivationIrrigationCompatibilityMap = Readonly<
  Record<string, Readonly<Record<string, CompatibilityStatus>>>
>;

export interface StrainCompatibilityEntry {
  readonly cultivation: Readonly<Record<string, CompatibilityStatus>>;
  readonly irrigation: Readonly<Record<string, CompatibilityStatus>>;
}

export type StrainCompatibilityMap = Readonly<Record<string, StrainCompatibilityEntry>>;

export interface CompatibilityMaps {
  readonly cultivationToIrrigation: CultivationIrrigationCompatibilityMap;
  readonly strainToCultivation: StrainCompatibilityMap;
}

export interface ReadModelSnapshot {
  readonly simulation: SimulationReadModel;
  readonly economy: EconomyReadModel;
  readonly structures: readonly StructureReadModel[];
  readonly hr: HrReadModel;
  readonly priceBook: PriceBookCatalog;
  readonly compatibility: CompatibilityMaps;
  readonly inventory: InventoryReadModel;
  readonly breeding: BreedingReadModel;
  readonly runSummary: RunSummaryReadModel;
}

export type FrozenReadModelSnapshot = ReadModelSnapshot;

export type ReadModelStatus = "loading" | "ready" | "error";

export interface ReadModelStoreStatus {
  readonly status: ReadModelStatus;
  readonly lastError: string | null;
  readonly lastUpdatedSimTimeHours: number | null;
  readonly isRefreshing: boolean;
}

export type CompanyTreeWarningSeverity = "info" | "warning" | "critical";

export interface CompanyTreeWarningEnvelope {
  readonly id: string;
  readonly scope: "structure" | "room" | "zone";
  readonly targetId: string | null;
  readonly message: string;
  readonly severity: CompanyTreeWarningSeverity;
}

export interface CompanyTreeZoneCultivationMethod {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

export interface CompanyTreeZoneContainerContext {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly volume_L: number;
  readonly serviceLife_cycles: number;
  readonly unitCost: number;
}

export interface CompanyTreeZoneSubstrateContext {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly unitPrice_per_L: number;
  readonly densityFactor_L_per_kg: number;
}

export interface CompanyTreeZoneStrainContext {
  readonly id: string;
  readonly name: string;
}

export interface CompanyTreeZoneCultivationContext {
  readonly method: CompanyTreeZoneCultivationMethod;
  readonly container: CompanyTreeZoneContainerContext | undefined;
  readonly substrate: CompanyTreeZoneSubstrateContext | undefined;
  readonly strain: CompanyTreeZoneStrainContext | undefined;
  readonly maxPlants: number;
  readonly currentPlantCount: number;
}

export interface CompanyTreeZoneLightingSchedule {
  readonly onHours: number;
  readonly offHours: number;
  readonly startHour: number;
}

export interface CompanyTreeZoneLightingContext {
  readonly schedule: CompanyTreeZoneLightingSchedule | null;
  readonly coveragePercent: number;
  readonly deviceCount: number;
  readonly dutyCycle01: number;
}

export interface CompanyTreeIrrigationMethodContext {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly deliveryType?: string;
}

export interface CompanyTreeZoneIrrigationContext {
  readonly method: CompanyTreeIrrigationMethodContext;
  readonly estimatedWaterDemand_m3_per_day: number;
  readonly labourHoursPerDay: number;
  readonly runoffFraction01?: number;
}

export interface CompanyTreeZoneClimateSnapshot {
  readonly temperature_C: number;
  readonly relativeHumidity_percent: number;
  readonly co2_ppm: number;
  readonly vpd_kPa: number;
  readonly ach_measured: number;
  readonly ach_target: number;
  readonly status: "ok" | "warn" | "critical";
}

export interface CompanyTreeZoneClimateTelemetrySample {
  readonly simTimeHours: number;
  readonly temperature_C: number;
  readonly relativeHumidity_percent: number;
  readonly co2_ppm: number;
  readonly vpd_kPa: number;
  readonly ach: number;
}

export interface CompanyTreeZoneClimate {
  readonly snapshot: CompanyTreeZoneClimateSnapshot;
  readonly telemetry: readonly CompanyTreeZoneClimateTelemetrySample[];
}

export interface CompanyTreeZoneKpis {
  readonly healthPercent: number;
  readonly qualityPercent: number;
  readonly stressPercent: number;
  readonly biomass_kg: number;
  readonly growthRatePercent: number;
}

export interface CompanyTreeZonePestStatus {
  readonly activeIssues: number;
  readonly dueInspections: number;
  readonly upcomingTreatments: number;
  readonly nextInspectionTick: number;
  readonly lastInspectionTick: number;
}

export interface CompanyTreeZoneCoverage {
  readonly lightingCoverage01: number;
  readonly hvacCapacity01: number;
  readonly ach: number;
  readonly achTarget: number;
  readonly warnings: readonly DeviceWarning[];
}

export interface CompanyTreeZoneTask {
  readonly id: string;
  readonly type: "inspection" | "treatment" | "harvest" | "maintenance" | "training";
  readonly status: "queued" | "in-progress" | "done";
  readonly assigneeId: string | null;
  readonly scheduledTick: number;
  readonly targetZoneId: string;
}

export interface CompanyTreeZoneNode {
  readonly id: string;
  readonly name: string;
  readonly area_m2: number;
  readonly volume_m3: number;
  readonly cultivation: CompanyTreeZoneCultivationContext;
  readonly lighting: CompanyTreeZoneLightingContext;
  readonly irrigation: CompanyTreeZoneIrrigationContext;
  readonly kpis: CompanyTreeZoneKpis;
  readonly pestStatus: CompanyTreeZonePestStatus;
  readonly climate: CompanyTreeZoneClimate;
  readonly deviceCoverage: CompanyTreeZoneCoverage;
  readonly devices: readonly DeviceSummary[];
  readonly tasks: readonly CompanyTreeZoneTask[];
  readonly outstandingTaskCount: number;
  readonly warnings: readonly DeviceWarning[];
}

export interface CompanyTreeRoomClimateTelemetrySample {
  readonly simTimeHours: number;
  readonly temperature_C: number;
  readonly relativeHumidity_percent: number;
  readonly co2_ppm: number;
  readonly ach: number;
}

export interface CompanyTreeRoomClimateSnapshot {
  readonly temperature_C: number;
  readonly relativeHumidity_percent: number;
  readonly co2_ppm: number;
  readonly ach: number;
  readonly notes: string;
}

export interface CompanyTreeRoomClimate {
  readonly snapshot: CompanyTreeRoomClimateSnapshot;
  readonly telemetry: readonly CompanyTreeRoomClimateTelemetrySample[];
}

export interface CompanyTreeRoomNode {
  readonly id: string;
  readonly structureId: string;
  readonly name: string;
  readonly purpose: string;
  readonly area_m2: number;
  readonly volume_m3: number;
  readonly capacity: RoomCapacitySummary;
  readonly coverage: RoomCoverageSummary;
  readonly climate: CompanyTreeRoomClimate;
  readonly devices: readonly DeviceSummary[];
  readonly zones: readonly CompanyTreeZoneNode[];
  readonly outstandingTaskCount: number;
  readonly warnings: readonly DeviceWarning[];
}

export interface CompanyTreeStructureTariffs {
  readonly price_electricity: number;
  readonly price_water: number;
}

export interface CompanyTreeStructureNode {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly area_m2: number;
  readonly volume_m3: number;
  readonly capacity: StructureCapacitySummary;
  readonly coverage: StructureCoverageSummary;
  readonly kpis: StructureKpiSummary;
  readonly tariffs: CompanyTreeStructureTariffs;
  readonly devices: readonly DeviceSummary[];
  readonly rooms: readonly CompanyTreeRoomNode[];
  readonly outstandingTaskCount: number;
  readonly warnings: readonly CompanyTreeWarningEnvelope[];
}

export interface CompanyTreeReadModel {
  readonly schemaVersion: string;
  readonly simTime: number;
  readonly companyId: string;
  readonly name: string;
  readonly structures: readonly CompanyTreeStructureNode[];
}

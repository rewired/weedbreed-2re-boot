/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { EngineBootstrapConfig, ParsedCompanyWorld, Room, SimulationWorld, Structure, Zone } from '@wb/engine';
import type { RoomReadModel, ZoneReadModel } from '../readModels/snapshot.js';
import { COMPANY_TREE_SCHEMA_VERSION, STRUCTURE_TARIFFS_SCHEMA_VERSION, type CompanyTreeReadModel, type StructureTariffsReadModel } from '../readModels/api/schemas.js';
import { structureTariffs as createStructureTariffsReadModel } from '@/backend/src/readmodels/economy/structureTariffs.js';
import { computeStructureMetrics } from './readModelMetrics.js';
import { mapStructure, buildStructureLocation } from './readModelSnapshotMappers.js';
import { asReadModelUuid, clampFraction, roundTo, computeZoneCoverageMetrics, mapCultivationMethodContext, mapContainerContext, mapSubstrateContext, resolveZoneStrainContext, normalizeLightSchedule, computeLightingDutyFraction, resolveIrrigation, mapIrrigationMethodContext, computeZoneWaterM3PerDay, computeIrrigationLabourHours, createZoneClimateTelemetrySample, createRoomClimateTelemetrySample, dedupeWarnings, dedupeWarningEnvelopes, createZoneClimateStatusWarning, type CompanyTreeZoneNode, type CompanyTreeRoomNode, type CompanyTreeStructureNode, type CompanyTreeDeviceWarning } from './readModelShared.js';

export function composeZoneNode(
  zone: Zone,
  zoneReadModel: ZoneReadModel,
  simTimeHours: number
): CompanyTreeZoneNode {
  const coverage = computeZoneCoverageMetrics(zone);
  const cultivationMethod = mapCultivationMethodContext(zone);
  const container = mapContainerContext(zone);
  const substrate = mapSubstrateContext(zone);
  const strain = resolveZoneStrainContext(zoneReadModel.strainId);
  const lightingSchedule = normalizeLightSchedule(zone);
  const dutyCycle01 = computeLightingDutyFraction(zone.lightSchedule);
  const irrigationBlueprint = resolveIrrigation(zone.irrigationMethodId) as
    | { runoff?: { defaultFraction?: number } }
    | undefined;
  const irrigationMethod = mapIrrigationMethodContext(zone);
  const irrigationRunoff = irrigationBlueprint?.runoff?.defaultFraction;
  const irrigationWaterPerDay = computeZoneWaterM3PerDay(zone, zoneReadModel.currentPlantCount);
  const irrigationLabourPerDay = computeIrrigationLabourHours(zone, zoneReadModel.currentPlantCount);
  const climateTelemetry = [
    createZoneClimateTelemetrySample(simTimeHours, zoneReadModel.climateSnapshot)
  ] satisfies CompanyTreeZoneNode['climate']['telemetry'];
  const deviceCoverageWarnings = dedupeWarnings<CompanyTreeDeviceWarning>([
    ...coverage.warnings,
    ...zoneReadModel.coverageWarnings
  ]);
  const climateWarning = createZoneClimateStatusWarning(zone.id, zoneReadModel.climateSnapshot);
  const zoneWarnings = dedupeWarnings<CompanyTreeDeviceWarning>([
    ...deviceCoverageWarnings,
    ...(climateWarning ? [climateWarning] : [])
  ]);
  const outstandingTaskCount = zoneReadModel.tasks.reduce(
    (count, task) => (task.status === 'done' ? count : count + 1),
    0
  );

  return {
    id: asReadModelUuid(zoneReadModel.id),
    name: zoneReadModel.name,
    area_m2: roundTo(Math.max(zoneReadModel.area_m2, 0)),
    volume_m3: roundTo(Math.max(zoneReadModel.volume_m3, 0)),
    cultivation: {
      method: cultivationMethod,
      container,
      substrate,
      strain,
      maxPlants: zoneReadModel.maxPlants,
      currentPlantCount: zoneReadModel.currentPlantCount
    },
    lighting: {
      schedule: lightingSchedule,
      coveragePercent: roundTo(Math.min(coverage.lightingCoverage01, 1) * 100, 2),
      deviceCount: zone.devices.length,
      dutyCycle01
    },
    irrigation: {
      method: irrigationMethod,
      estimatedWaterDemand_m3_per_day: roundTo(Math.max(irrigationWaterPerDay, 0)),
      labourHoursPerDay: roundTo(Math.max(irrigationLabourPerDay, 0)),
      runoffFraction01:
        typeof irrigationRunoff === 'number' ? roundTo(clampFraction(irrigationRunoff)) : undefined
    },
    kpis: zoneReadModel.kpis,
    pestStatus: zoneReadModel.pestStatus,
    climate: {
      snapshot: zoneReadModel.climateSnapshot,
      telemetry: climateTelemetry
    },
    deviceCoverage: {
      lightingCoverage01: coverage.lightingCoverage01,
      hvacCapacity01: coverage.hvacCapacity01,
      ach: coverage.airflowAch,
      achTarget: zoneReadModel.climateSnapshot.ach_target,
      warnings: deviceCoverageWarnings
    },
    readiness: zoneReadModel.readiness,
    plants: zoneReadModel.plants as CompanyTreeZoneNode['plants'],
    harvestEligibility: zoneReadModel.harvestEligibility as CompanyTreeZoneNode['harvestEligibility'],
    sowEligibility: zoneReadModel.sowEligibility,
    strainChoices: zoneReadModel.strainChoices as CompanyTreeZoneNode['strainChoices'],
    devices: zoneReadModel.devices as CompanyTreeZoneNode['devices'],
    tasks: zoneReadModel.tasks as CompanyTreeZoneNode['tasks'],
    outstandingTaskCount,
    warnings: zoneWarnings
  } satisfies CompanyTreeZoneNode;
}

export function composeRoomNode(
  structureId: Structure['id'],
  room: Room,
  roomReadModel: RoomReadModel,
  simTimeHours: number
): CompanyTreeRoomNode {
  const zones = room.zones.map((zone, index) =>
    composeZoneNode(zone, roomReadModel.zones[index] as ZoneReadModel, simTimeHours)
  );
  const warnings = dedupeWarnings<CompanyTreeDeviceWarning>([
    ...roomReadModel.coverage.climateWarnings,
    ...zones.flatMap((zone) => zone.warnings)
  ]);
  const outstandingTaskCount = zones.reduce(
    (total, zone) => total + zone.outstandingTaskCount,
    0
  );
  const climateTelemetry = [
    createRoomClimateTelemetrySample(simTimeHours, roomReadModel.climateSnapshot)
  ] satisfies CompanyTreeRoomNode['climate']['telemetry'];

  return {
    id: asReadModelUuid(roomReadModel.id),
    structureId,
    name: roomReadModel.name,
    purpose: roomReadModel.purpose,
    area_m2: roundTo(Math.max(roomReadModel.area_m2, 0)),
    volume_m3: roundTo(Math.max(roomReadModel.volume_m3, 0)),
    capacity: roomReadModel.capacity,
    coverage: roomReadModel.coverage,
    climate: {
      snapshot: roomReadModel.climateSnapshot,
      telemetry: climateTelemetry
    },
    devices: roomReadModel.devices as CompanyTreeRoomNode['devices'],
    zones,
    outstandingTaskCount,
    warnings
  } satisfies CompanyTreeRoomNode;
}

export function mapCompanyTree(
  world: SimulationWorld,
  companyWorld: ParsedCompanyWorld,
  config: EngineBootstrapConfig
): CompanyTreeReadModel {
  const workforce = world.workforce;
  const structureMetrics = world.company.structures.map((structure) => computeStructureMetrics(structure));
  const tariffsReadModel = createStructureTariffsReadModel(world, config.tariffs);
  const tariffByStructure = new Map(
    tariffsReadModel.structures.map((entry) => [entry.structureId, entry.effective])
  );

  const structures = world.company.structures.map((structure, structureIndex) => {
    const metrics = structureMetrics[structureIndex];
    const structureReadModel = mapStructure(structure, companyWorld, workforce, metrics, world);
    const rooms = structure.rooms.map((room, roomIndex) =>
      composeRoomNode(structure.id, room, structureReadModel.rooms[roomIndex] as RoomReadModel, world.simTimeHours)
    );
    const outstandingTaskCount = rooms.reduce(
      (total, room) => total + room.outstandingTaskCount,
      0
    );
    const warningEnvelopes = dedupeWarningEnvelopes([
      ...structureReadModel.coverage.warnings.map((warning) => ({
        id: warning.id,
        scope: 'structure' as const,
        targetId: structure.id,
        message: warning.message,
        severity: warning.severity
      })),
      ...rooms.flatMap((room) =>
        room.warnings.map((warning) => ({
          id: warning.id,
          scope: 'room' as const,
          targetId: room.id,
          message: warning.message,
          severity: warning.severity
        }))
      ),
      ...rooms.flatMap((room) =>
        room.zones.flatMap((zone) =>
          zone.warnings.map((warning) => ({
            id: warning.id,
            scope: 'zone' as const,
            targetId: zone.id,
            message: warning.message,
            severity: warning.severity
          }))
        )
      )
    ]);
    const effectiveTariff = tariffByStructure.get(structure.id);

    return {
      id: structure.id,
      name: structure.name,
      location: buildStructureLocation(structure, companyWorld),
      area_m2: roundTo(Math.max(structureReadModel.area_m2, 0)),
      volume_m3: roundTo(Math.max(structureReadModel.volume_m3, 0)),
      capacity: structureReadModel.capacity,
      coverage: structureReadModel.coverage,
      kpis: structureReadModel.kpis,
      tariffs: {
        price_electricity: roundTo(
          effectiveTariff?.price_electricity ?? tariffsReadModel.rollup.price_electricity
        ),
        price_water: roundTo(effectiveTariff?.price_water ?? tariffsReadModel.rollup.price_water)
      },
      devices: structureReadModel.devices as CompanyTreeStructureNode['devices'],
      rooms,
      outstandingTaskCount,
      warnings: warningEnvelopes
    } satisfies CompanyTreeStructureNode;
  });

  return {
    schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
    simTime: world.simTimeHours,
    companyId: world.company.id,
    name: world.company.name,
    structures
  } satisfies CompanyTreeReadModel;
}

export function mapStructureTariffs(world: SimulationWorld, config: EngineBootstrapConfig): StructureTariffsReadModel {
  const resolved = createStructureTariffsReadModel(world, config.tariffs);

  return {
    schemaVersion: STRUCTURE_TARIFFS_SCHEMA_VERSION,
    simTime: world.simTimeHours,
    electricity_kwh_price: resolved.rollup.price_electricity,
    water_m3_price: resolved.rollup.price_water,
    co2_kg_price: 0,
    currency: null
  } satisfies StructureTariffsReadModel;
}

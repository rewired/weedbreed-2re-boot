/* eslint-disable wb-sim/no-ts-import-js-extension */

import type {
  EngineBootstrapConfig,
  ParsedCompanyWorld,
  SimulationWorld,
  Structure,
  Room,
  Zone,
  DeviceInstance,
  WorkforceWarning,
  WorkforceState
} from '@wb/engine';
import {
  COMPANY_TREE_SCHEMA_VERSION,
  STRUCTURE_TARIFFS_SCHEMA_VERSION,
  WORKFORCE_VIEW_SCHEMA_VERSION,
  type CompanyTreeReadModel,
  type StructureTariffsReadModel,
  type WorkforceViewReadModel
} from '../readModels/api/schemas.js';
import {
  composeReadModelSnapshot,
  type ReadModelSnapshot,
  type StructureReadModel,
  type RoomReadModel,
  type ZoneReadModel,
  type DeviceSummary,
  type EconomyReadModel,
  type SimulationReadModel,
  type HrReadModel,
  type PriceBookCatalog,
  type CompatibilityMaps
} from '../readModels/snapshot.js';
import { structureTariffs as createStructureTariffsReadModel } from '@/backend/src/readmodels/economy/structureTariffs.ts';

interface EngineContext {
  readonly world: SimulationWorld;
  readonly companyWorld: ParsedCompanyWorld;
  readonly config: EngineBootstrapConfig;
}

function toVolume(area_m2: number, height_m: number): number {
  return area_m2 * height_m;
}

function mapZoneDevice(device: DeviceInstance): DeviceSummary {
  const classSlug = device.slug.includes('.') ? device.slug.split('.')[0] : 'device';

  return {
    id: device.id,
    name: device.name,
    slug: device.slug,
    class: classSlug,
    placementScope: device.placementScope,
    conditionPercent: Math.round(device.condition01 * 100),
    coverageArea_m2: device.coverage_m2,
    airflow_m3_per_hour: device.airflow_m3_per_h,
    powerDraw_kWh_per_hour: device.powerDraw_W / 1000,
    warnings: []
  } satisfies DeviceSummary;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function mapZone(zone: Zone): ZoneReadModel {
  const plants = zone.plants;
  const plantCount = plants.length;
  const healthAvg = average(plants.map((plant) => plant.health01)) * 100;
  const qualityAvg = average(plants.map((plant) => plant.quality01 ?? 0)) * 100;
  const stressPercent = 0;
  const biomassKg = plants.reduce((total, plant) => total + plant.biomass_g, 0) / 1000;

  const primaryPlant = plants[0];
  const strainId = primaryPlant?.strainId ?? 'unassigned-strain';

  return {
    id: zone.id,
    name: zone.name,
    area_m2: zone.floorArea_m2,
    volume_m3: toVolume(zone.floorArea_m2, zone.height_m),
    cultivationMethodId: zone.cultivationMethodId,
    irrigationMethodId: zone.irrigationMethodId,
    strainId,
    maxPlants: plantCount,
    currentPlantCount: plantCount,
    kpis: {
      healthPercent: Math.round(healthAvg),
      qualityPercent: Math.round(qualityAvg),
      stressPercent: Math.round(stressPercent),
      biomass_kg: Number.parseFloat(biomassKg.toFixed(2)),
      growthRatePercent: 0
    },
    pestStatus: {
      activeIssues: 0,
      dueInspections: 0,
      upcomingTreatments: 0,
      nextInspectionTick: 0,
      lastInspectionTick: 0
    },
    devices: zone.devices.map(mapZoneDevice),
    coverageWarnings: [],
    climateSnapshot: {
      temperature_C: zone.environment.airTemperatureC,
      relativeHumidity_percent: Math.round(zone.environment.relativeHumidity01 * 100),
      co2_ppm: zone.environment.co2_ppm,
      vpd_kPa: 0,
      ach_measured: 0,
      ach_target: 0,
      status: 'ok'
    },
    timeline: [],
    tasks: []
  } satisfies ZoneReadModel;
}

function mapRoom(structureId: Structure['id'], room: Room): RoomReadModel {
  const zones = room.zones.map(mapZone);
  const zoneAreaTotal = zones.reduce((total, zone) => total + zone.area_m2, 0);
  const zoneVolumeTotal = zones.reduce((total, zone) => total + zone.volume_m3, 0);
  const areaFree = Math.max(room.floorArea_m2 - zoneAreaTotal, 0);
  const volume = toVolume(room.floorArea_m2, room.height_m);
  const volumeFree = Math.max(volume - zoneVolumeTotal, 0);

  const zoneClimates = zones.map((zone) => zone.climateSnapshot);
  const temperature = average(zoneClimates.map((climate) => climate.temperature_C));
  const humidity = average(zoneClimates.map((climate) => climate.relativeHumidity_percent));
  const co2 = average(zoneClimates.map((climate) => climate.co2_ppm));

  return {
    id: room.id,
    structureId,
    name: room.name,
    purpose: room.purpose,
    area_m2: room.floorArea_m2,
    volume_m3: volume,
    capacity: {
      areaUsed_m2: Number.parseFloat(zoneAreaTotal.toFixed(2)),
      areaFree_m2: Number.parseFloat(areaFree.toFixed(2)),
      volumeUsed_m3: Number.parseFloat(zoneVolumeTotal.toFixed(2)),
      volumeFree_m3: Number.parseFloat(volumeFree.toFixed(2))
    },
    coverage: {
      achCurrent: 0,
      achTarget: 0,
      climateWarnings: []
    },
    climateSnapshot: {
      temperature_C: Number.isFinite(temperature) ? Number.parseFloat(temperature.toFixed(2)) : 0,
      relativeHumidity_percent: Number.isFinite(humidity) ? Math.round(humidity) : 0,
      co2_ppm: Number.isFinite(co2) ? Math.round(co2) : 0,
      ach: 0,
      notes: 'Telemetry snapshot unavailable'
    },
    devices: room.devices.map(mapZoneDevice),
    zones,
    timeline: []
  } satisfies RoomReadModel;
}

function buildStructureLocation(structure: Structure, companyWorld: ParsedCompanyWorld): string {
  const companyLocation = companyWorld.location;
  return `${companyLocation.cityName}, ${companyLocation.countryName}`;
}

function mapStructure(structure: Structure, companyWorld: ParsedCompanyWorld, workforce: WorkforceState): StructureReadModel {
  const rooms = structure.rooms.map((room) => mapRoom(structure.id, room));
  const structureZoneArea = rooms.reduce(
    (total, room) => total + room.capacity.areaUsed_m2,
    0
  );
  const structureZoneVolume = rooms.reduce(
    (total, room) => total + room.capacity.volumeUsed_m3,
    0
  );
  const areaFree = Math.max(structure.floorArea_m2 - structureZoneArea, 0);
  const volume = toVolume(structure.floorArea_m2, structure.height_m);
  const volumeFree = Math.max(volume - structureZoneVolume, 0);

  const employeesByStructure = workforce.employees.filter(
    (employee) => employee.assignedStructureId === structure.id
  );

  return {
    id: structure.id,
    name: structure.name,
    location: buildStructureLocation(structure, companyWorld),
    area_m2: structure.floorArea_m2,
    volume_m3: volume,
    capacity: {
      areaUsed_m2: Number.parseFloat(structureZoneArea.toFixed(2)),
      areaFree_m2: Number.parseFloat(areaFree.toFixed(2)),
      volumeUsed_m3: Number.parseFloat(structureZoneVolume.toFixed(2)),
      volumeFree_m3: Number.parseFloat(volumeFree.toFixed(2))
    },
    coverage: {
      lightingCoverage01: 0,
      hvacCapacity01: 0,
      airflowAch: 0,
      warnings: []
    },
    kpis: {
      energyKwhPerDay: 0,
      waterM3PerDay: 0,
      labourHoursPerDay: 0,
      maintenanceCostPerHour: 0
    },
    devices: structure.devices.map(mapZoneDevice),
    rooms,
    workforce: {
      activeAssignments: employeesByStructure.map((employee) => ({
        employeeId: employee.id,
        employeeName: employee.name,
        role: 'structure',
        assignedScope: 'structure',
        targetId: structure.id
      })),
      openTasks: workforce.taskQueue.length,
      notes: employeesByStructure.length > 0 ? 'Active workforce assigned.' : 'No workforce assignments.'
    },
    timeline: []
  } satisfies StructureReadModel;
}

function mapWorkforceWarning(warning: WorkforceWarning) {
  return {
    code: warning.code,
    message: warning.message,
    severity: warning.severity,
    structureId: warning.structureId,
    employeeId: warning.employeeId,
    taskId: warning.taskId
  };
}

function mapWorkforceView(world: SimulationWorld): WorkforceViewReadModel {
  const workforce = world.workforce;
  const roleById = new Map(workforce.roles.map((role) => [role.id, role]));
  const roleCounts = {
    gardener: 0,
    technician: 0,
    janitor: 0
  } as const;
  const mutableCounts: Record<keyof typeof roleCounts, number> = {
    gardener: 0,
    technician: 0,
    janitor: 0
  };

  for (const employee of workforce.employees) {
    const role = roleById.get(employee.roleId);
    switch (role?.slug) {
      case 'gardener':
        mutableCounts.gardener += 1;
        break;
      case 'technician':
        mutableCounts.technician += 1;
        break;
      case 'janitor':
        mutableCounts.janitor += 1;
        break;
      default:
        break;
    }
  }

  const latestKpi = workforce.kpis.at(-1);

  return {
    schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
    simTime: world.simTimeHours,
    headcount: workforce.employees.length,
    roles: {
      gardener: mutableCounts.gardener,
      technician: mutableCounts.technician,
      janitor: mutableCounts.janitor
    },
    kpis: {
      utilization: latestKpi?.utilization01 ?? 0,
      warnings: workforce.warnings.map(mapWorkforceWarning)
    }
  } satisfies WorkforceViewReadModel;
}

function mapCompanyTree(world: SimulationWorld): CompanyTreeReadModel {
  return {
    schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
    simTime: world.simTimeHours,
    companyId: world.company.id,
    name: world.company.name,
    structures: world.company.structures.map((structure) => ({
      id: structure.id,
      name: structure.name,
      rooms: structure.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        zones: room.zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          area_m2: zone.floorArea_m2,
          volume_m3: toVolume(zone.floorArea_m2, zone.height_m)
        }))
      }))
    }))
  } satisfies CompanyTreeReadModel;
}

function mapStructureTariffs(world: SimulationWorld, config: EngineBootstrapConfig): StructureTariffsReadModel {
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

function mapSimulationReadModel(world: SimulationWorld): SimulationReadModel {
  const simTime = world.simTimeHours;
  const day = Math.floor(simTime / 24);
  const hour = Math.floor(simTime % 24);

  return {
    simTimeHours: simTime,
    day,
    hour,
    tick: Math.floor(simTime),
    speedMultiplier: 1,
    pendingIncidents: []
  } satisfies SimulationReadModel;
}

function mapEconomyReadModel(): EconomyReadModel {
  return {
    balance: 0,
    deltaPerHour: 0,
    operatingCostPerHour: 0,
    labourCostPerHour: 0,
    utilitiesCostPerHour: 0
  } satisfies EconomyReadModel;
}

function mapHrReadModel(workforce: WorkforceState): HrReadModel {
  return {
    directory: workforce.employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.roleId,
      hourlyCost: employee.salaryExpectation_per_h,
      moralePercent: Math.round(employee.morale01 * 100),
      fatiguePercent: Math.round(employee.fatigue01 * 100),
      skills: employee.skills.map((skill) => skill.skillKey),
      assignment: {
        employeeId: employee.id,
        employeeName: employee.name,
        role: 'structure',
        assignedScope: 'structure',
        targetId: employee.assignedStructureId
      },
      overtimeMinutes: 0
    })),
    activityTimeline: [],
    taskQueues: [],
    capacitySnapshot: []
  } satisfies HrReadModel;
}

function mapPriceBook(): PriceBookCatalog {
  return {
    seedlings: [],
    containers: [],
    substrates: [],
    irrigationLines: [],
    devices: []
  } satisfies PriceBookCatalog;
}

function mapCompatibility(): CompatibilityMaps {
  return {
    cultivationToIrrigation: {},
    strainToCultivation: {}
  } satisfies CompatibilityMaps;
}

export function createReadModelProviders(context: EngineContext) {
  return {
    async companyTree(): Promise<CompanyTreeReadModel> {
      return mapCompanyTree(context.world);
    },
    async structureTariffs(): Promise<StructureTariffsReadModel> {
      return mapStructureTariffs(context.world, context.config);
    },
    async workforceView(): Promise<WorkforceViewReadModel> {
      return mapWorkforceView(context.world);
    },
    async readModels(): Promise<ReadModelSnapshot> {
      const simulation = mapSimulationReadModel(context.world);
      const economy = mapEconomyReadModel();
      const structures = context.world.company.structures.map((structure) =>
        mapStructure(structure, context.companyWorld, context.world.workforce)
      );
      const hr = mapHrReadModel(context.world.workforce);
      const priceBook = mapPriceBook();
      const compatibility = mapCompatibility();

      return composeReadModelSnapshot({
        simulation,
        economy,
        structures,
        hr,
        priceBook,
        compatibility
      });
    }
  };
}

export type ReadModelProviderFactory = ReturnType<typeof createReadModelProviders>;

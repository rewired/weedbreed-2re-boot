/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { DeviceInstance, EngineBootstrapConfig, SimulationWorld, WorkforceState } from '@wb/engine';
import { HOURS_PER_DAY } from '@engine/constants/time.js';
import { structureTariffs as createStructureTariffsReadModel } from '@/backend/src/readmodels/economy/structureTariffs.js';
import { parseDeviceBlueprint } from '@/backend/src/domain/blueprints/device/parse.js';
import ledVegLightJson from '../../../../data/blueprints/device/lighting/led-veg-light-600.json' with { type: 'json' };
import coolAirSplitJson from '../../../../data/blueprints/device/climate/cool-air-split-3000.json' with { type: 'json' };
import type { CompatibilityMaps, EconomyReadModel, HrReadModel, PriceBookCatalog, SimulationReadModel } from '../readModels/snapshot.js';
import { roundTo, sanitizeZero, resolveContainer, resolveSubstrate, resolveIrrigation, CULTIVATION_BLUEPRINTS, IRRIGATION_BLUEPRINTS, STRAIN_PRICE_MAP, CONSUMABLE_CONTAINER_PRICES, CONSUMABLE_SUBSTRATE_PRICES, DEVICE_PRICE_ENTRIES, type StructureMetrics } from './readModelShared.js';
import { mapSimulationIncidents } from './incidentReadModel.js';

const AVAILABLE_DEVICE_BLUEPRINTS = [
  parseDeviceBlueprint(ledVegLightJson),
  parseDeviceBlueprint(coolAirSplitJson),
] as const;

export interface SimulationPlaybackProjection {
  readonly paused: boolean;
  readonly speedMultiplier: number;
}

export function mapSimulationReadModel(
  world: SimulationWorld,
  playback: SimulationPlaybackProjection = { paused: true, speedMultiplier: 1 },
): SimulationReadModel {
  const simTime = world.simTimeHours;
  const day = Math.floor(simTime / 24);
  const hour = Math.floor(simTime % 24);

  return {
    simTimeHours: simTime,
    day,
    hour,
    tick: Math.floor(simTime),
    speedMultiplier: playback.speedMultiplier,
    paused: playback.paused,
    pendingIncidents: mapSimulationIncidents(world)
  } satisfies SimulationReadModel;
}

export function sumLabourCostPerHour(workforce: WorkforceState): number {
  return workforce.employees.reduce((total, employee) => {
    const rate = employee.salaryExpectation_per_h;
    if (!Number.isFinite(rate) || rate <= 0) {
      return total;
    }

    return total + rate;
  }, 0);
}

export function mapEconomyReadModel(
  world: SimulationWorld,
  structures: readonly StructureMetrics[],
  workforce: WorkforceState,
  tariffs: EngineBootstrapConfig['tariffs']
): EconomyReadModel {
  const totalEnergyPerDay = structures.reduce((sum, metrics) => sum + metrics.energyKwhPerDay, 0);
  const totalWaterPerDay = structures.reduce((sum, metrics) => sum + metrics.waterM3PerDay, 0);
  const energy_per_h = totalEnergyPerDay / HOURS_PER_DAY;
  const water_per_h = totalWaterPerDay / HOURS_PER_DAY;
  const labourCost_per_h = sumLabourCostPerHour(workforce);
  const maintenanceCost_per_h = structures.reduce(
    (sum, metrics) => sum + metrics.maintenanceCostPerHour,
    0
  );
  const energyCost_per_h = energy_per_h * (tariffs.price_electricity ?? 0);
  const waterCost_per_h = water_per_h * (tariffs.price_water ?? 0);
  const utilitiesCost_per_h = energyCost_per_h + waterCost_per_h;
  const operatingCost_per_h = labourCost_per_h + maintenanceCost_per_h + utilitiesCost_per_h;
  const delta_per_h = roundTo(-operatingCost_per_h);
  const delta_per_day = -operatingCost_per_h * HOURS_PER_DAY;
  const dailyDelta_per_h = roundTo(delta_per_day / HOURS_PER_DAY);
  const payrollTotals = workforce.payroll?.totals;
  const balance_per_h = payrollTotals
    ? -roundTo((payrollTotals.totalLaborCost ?? 0) / HOURS_PER_DAY)
    : 0;

  const resolvedTariffs = createStructureTariffsReadModel(world, tariffs);
  const tariffStructures = resolvedTariffs.structures
    .map((entry) => ({
      structureId: entry.structureId,
      price_electricity: entry.effective.price_electricity,
      price_water: entry.effective.price_water
    }))
    .sort((left, right) => left.structureId.localeCompare(right.structureId));
  const ledger = (world.economy?.ledger ?? []).map((entry) => ({
    ...entry,
    ...(entry.metadata ? { metadata: { ...entry.metadata } } : {}),
  }));
  const cycleContributionMarginCc = world.economy
    ? ledger.reduce(
      (margin, entry) => margin + (entry.direction === 'credit' ? entry.amountCc : -entry.amountCc),
      0,
    )
    : null;

  return {
    balanceCc: world.economy?.balanceCc ?? null,
    startingBalanceCc: world.economy?.startingBalanceCc ?? null,
    cycleContributionMarginCc: cycleContributionMarginCc === null
      ? null
      : roundTo(cycleContributionMarginCc, 6),
    ledger,
    balance_per_h: sanitizeZero(balance_per_h),
    delta_per_h: sanitizeZero(delta_per_h),
    dailyDelta_per_h: sanitizeZero(dailyDelta_per_h),
    operatingCost_per_h: roundTo(operatingCost_per_h),
    labourCost_per_h: roundTo(labourCost_per_h),
    maintenanceCost_per_h: roundTo(maintenanceCost_per_h),
    utilitiesCost_per_h: roundTo(utilitiesCost_per_h),
    energy_kwh_per_h: roundTo(energy_per_h, 6),
    water_m3_per_h: roundTo(water_per_h, 6),
    energyCost_per_h: roundTo(energyCost_per_h),
    waterCost_per_h: roundTo(waterCost_per_h),
    tariffs: {
      price_electricity: resolvedTariffs.rollup.price_electricity,
      price_water: resolvedTariffs.rollup.price_water,
      structures: tariffStructures
    }
  } satisfies EconomyReadModel;
}

export function mapHrReadModel(workforce: WorkforceState): HrReadModel {
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

export function mapPriceBook(world: SimulationWorld): PriceBookCatalog {
  const containerIds = new Set<string>();
  const substrateIds = new Set<string>();
  const irrigationIds = new Set<string>();
  const deviceBlueprints = new Map<
    string,
    { slug: string; name: string; class: string; coverage_m2: number; airflow_m3_per_h: number }
  >(
    AVAILABLE_DEVICE_BLUEPRINTS.map((blueprint) => [
      blueprint.id,
      {
        slug: blueprint.slug,
        name: blueprint.name,
        class: blueprint.class,
        coverage_m2: blueprint.coverage_m2 ?? 0,
        airflow_m3_per_h: blueprint.airflow_m3_per_h ?? 0,
      },
    ]),
  );

  function registerDevice(device: DeviceInstance) {
    if (typeof device.blueprintId !== 'string') {
      return;
    }

    if (!deviceBlueprints.has(device.blueprintId)) {
      deviceBlueprints.set(device.blueprintId, {
        slug: device.slug,
        name: device.name,
        class: 'device',
        coverage_m2: Number.isFinite(device.coverage_m2) ? (device.coverage_m2 as number) : 0,
        airflow_m3_per_h: Number.isFinite(device.airflow_m3_per_h)
          ? (device.airflow_m3_per_h as number)
          : 0
      });
    }
  }

  for (const structure of world.company.structures) {
    for (const device of structure.devices) {
      registerDevice(device);
    }

    for (const room of structure.rooms) {
      for (const device of room.devices) {
        registerDevice(device);
      }

      for (const zone of room.zones) {
        containerIds.add(zone.containerId);
        substrateIds.add(zone.substrateId);
        irrigationIds.add(zone.irrigationMethodId);

        for (const device of zone.devices) {
          registerDevice(device);
        }
      }
    }
  }

  const seedlings = Object.entries(STRAIN_PRICE_MAP).map(([strainId, entry]) => ({
    id: `seedling-price-${strainId}`,
    strainId,
    pricePerUnit: roundTo(entry?.seedPrice ?? 0, 2)
  }));

  const containers = Array.from(containerIds).flatMap((id) => {
    const blueprint = resolveContainer(id);
    if (!blueprint) {
      return [];
    }

    const priceEntry = CONSUMABLE_CONTAINER_PRICES[blueprint.slug] as
      | { costPerUnit?: number }
      | undefined;
    const price = priceEntry?.costPerUnit ?? 0;

    return [
      {
        id: `container-price-${blueprint.id}`,
        containerId: blueprint.id,
        capacityLiters: blueprint.volumeInLiters,
        pricePerUnit: roundTo(price, 2),
        serviceLifeCycles: blueprint.reusableCycles ?? 1
      }
    ];
  });

  const substrates = Array.from(substrateIds).flatMap((id) => {
    const blueprint = resolveSubstrate(id);
    if (!blueprint) {
      return [];
    }

    const price =
      blueprint.unitPrice_per_L ??
      (CONSUMABLE_SUBSTRATE_PRICES[blueprint.slug]?.costPerLiter ?? 0);

    return [
      {
        id: `substrate-price-${blueprint.id}`,
        substrateId: blueprint.id,
        unitPrice_per_L: roundTo(price, 4),
        densityFactor_L_per_kg: blueprint.densityFactor_L_per_kg,
        reuseCycles: blueprint.maxCycles
      }
    ];
  });

  const irrigationLines = Array.from(irrigationIds).flatMap((id) => {
    const blueprint = resolveIrrigation(id);
    if (!blueprint) {
      return [];
    }

    return [
      {
        id: `irrigation-price-${blueprint.id}`,
        irrigationMethodId: blueprint.id,
        pricePerSquareMeter: 0
      }
    ];
  });

  const devices = Array.from(deviceBlueprints.entries()).map(([blueprintId, data]) => {
    const priceEntry = DEVICE_PRICE_ENTRIES[blueprintId];
    return {
      id: `device-price-${blueprintId}`,
      deviceBlueprintId: blueprintId,
      deviceSlug: data.slug,
      deviceName: data.name,
      deviceClass: data.class,
      coverageArea_m2: roundTo(data.coverage_m2, 4),
      throughput_m3_per_hour: roundTo(data.airflow_m3_per_h, 4),
      capitalExpenditure: roundTo(priceEntry?.capitalExpenditure ?? 0, 2)
    } satisfies PriceBookCatalog['devices'][number];
  });

  return {
    seedlings,
    containers,
    substrates,
    irrigationLines,
    devices
  } satisfies PriceBookCatalog;
}

export type CultivationBlueprint = (typeof CULTIVATION_BLUEPRINTS)[number];
export type IrrigationBlueprint = (typeof IRRIGATION_BLUEPRINTS)[number];

export function deriveIrrigationStatus(
  cultivation: CultivationBlueprint,
  irrigation: IrrigationBlueprint
): 'ok' | 'warn' | 'block' {
  const compatibilityMethods = Array.isArray(irrigation.compatibility?.methods)
    ? irrigation.compatibility.methods
    : [];
  const aliasKeys = new Set<string>([cultivation.slug]);

  if (typeof cultivation.technique === 'string' && cultivation.technique.length > 0) {
    aliasKeys.add(cultivation.technique);
  }

  let supported = false;

  for (const method of compatibilityMethods) {
    if (aliasKeys.has(method)) {
      supported = true;
      break;
    }
  }

  if (!supported) {
    return 'block';
  }

  const labour = (irrigation as { labor?: { basis?: string } }).labor;

  if (labour?.basis === 'perPlant') {
    return 'warn';
  }

  return 'ok';
}

export function mapCompatibility(): CompatibilityMaps {
  const cultivationEntries = CULTIVATION_BLUEPRINTS.map((cultivation) => {
    const irrigationStatuses = Object.fromEntries(
      IRRIGATION_BLUEPRINTS.map((irrigation) => [
        irrigation.id,
        deriveIrrigationStatus(cultivation, irrigation)
      ])
    );

    return [cultivation.id, irrigationStatuses] as const;
  });

  const strainEntries = Object.keys(STRAIN_PRICE_MAP).map((strainId) => {
    const cultivationStatuses = Object.fromEntries(
      CULTIVATION_BLUEPRINTS.map((cultivation) => [cultivation.id, 'ok' as const])
    );
    const irrigationStatuses = Object.fromEntries(
      IRRIGATION_BLUEPRINTS.map((irrigation) => [irrigation.id, 'ok' as const])
    );

    return [
      strainId,
      {
        cultivation: cultivationStatuses,
        irrigation: irrigationStatuses
      }
    ] as const;
  });

  return {
    cultivationToIrrigation: Object.fromEntries(cultivationEntries),
    strainToCultivation: Object.fromEntries(strainEntries)
  } satisfies CompatibilityMaps;
}

import { describe, expect, it } from 'vitest';

import { FLOAT_TOLERANCE } from '@/backend/src/constants/simConstants';
import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine';
import { applyEconomyAccrual } from '@/backend/src/engine/pipeline/applyEconomyAccrual';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import {
  parseDeviceBlueprint,
  parseDevicePriceMap,
  toDeviceInstanceEffectConfigs,
  type DeviceBlueprint,
  type DevicePriceEntry,
  type SimulationWorld,
  type WorkforcePayrollState,
  type ZoneDeviceInstance,
  type Uuid,
} from '@/backend/src/domain/world';
import type { IrrigationEvent } from '@/backend/src/domain/interfaces/IIrrigationService';
import type { DeviceMaintenanceAccrualState } from '@/backend/src/device/maintenanceRuntime';
import { bankersRound } from '@/backend/src/util/math';
import devicePrices from '../../../../../data/prices/devicePrices.json' with { type: 'json' };
import dryboxBlueprint from '../../../../../data/blueprints/device/climate/drybox-200.json' with { type: 'json' };
import { expectDefined } from '../../util/expectors';

const EPS = FLOAT_TOLERANCE;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const devicePriceMap = parseDevicePriceMap(devicePrices);
const dryboxDeviceBlueprint = parseDeviceBlueprint(dryboxBlueprint);

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function readFiniteNumber(record: UnknownRecord, key: string): number | undefined {
  const candidate = record[key];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
}

function readBlueprintNumber(blueprint: DeviceBlueprint, key: string): number | undefined {
  return readFiniteNumber(blueprint as UnknownRecord, key);
}

function readLimitNumber(blueprint: DeviceBlueprint, key: string): number | undefined {
  const limitsRecord = asRecord((blueprint as UnknownRecord).limits);
  return limitsRecord ? readFiniteNumber(limitsRecord, key) : undefined;
}

function readMaintenanceNumber(
  blueprint: DeviceBlueprint,
  key: 'intervalDays' | 'hoursPerService',
): number | undefined {
  const maintenanceRecord = asRecord((blueprint as UnknownRecord).maintenance);
  return maintenanceRecord ? readFiniteNumber(maintenanceRecord, key) : undefined;
}

interface WorkforceEconomyAccrualState {
  readonly current?: WorkforcePayrollState;
  readonly finalizedDays: readonly WorkforcePayrollState[];
}

interface DeviceMaintenanceEconomyAccrualState {
  readonly current?: DeviceMaintenanceAccrualState;
  readonly finalizedDays: readonly DeviceMaintenanceAccrualState[];
}

interface UtilityAccrualState {
  readonly dayIndex: number;
  readonly hoursAccrued: number;
  readonly energyConsumption_kWh: number;
  readonly energyCostCc: number;
  readonly energyCostCc_per_h: number;
  readonly waterConsumption_m3: number;
  readonly waterCostCc: number;
  readonly waterCostCc_per_h: number;
}

interface UtilityEconomyAccrualState {
  readonly current?: UtilityAccrualState;
  readonly finalizedDays: readonly UtilityAccrualState[];
}

interface CultivationAccrualState {
  readonly dayIndex: number;
  readonly hoursAccrued: number;
  readonly costCc: number;
  readonly costCc_per_h: number;
}

interface CultivationEconomyAccrualState {
  readonly current?: CultivationAccrualState;
  readonly finalizedDays: readonly CultivationAccrualState[];
}

interface EconomyAccrualState {
  readonly workforce?: WorkforceEconomyAccrualState;
  readonly deviceMaintenance?: DeviceMaintenanceEconomyAccrualState;
  readonly utilities?: UtilityEconomyAccrualState;
  readonly cultivation?: CultivationEconomyAccrualState;
}

type EconomyAccrualTestContext = Mutable<EngineRunContext> & {
  economyAccruals?: EconomyAccrualState;
};

function expectDevicePriceEntry(id: string): DevicePriceEntry {
  return expectDefined(devicePriceMap.devicePrices[id]);
}

function createTestDevice(): ZoneDeviceInstance {
  const priceEntry = expectDevicePriceEntry(dryboxDeviceBlueprint.id);
  const lifetimeHours = readBlueprintNumber(dryboxDeviceBlueprint, 'lifetime_h') ?? 26_280;
  const maintenanceIntervalDays = readMaintenanceNumber(dryboxDeviceBlueprint, 'intervalDays') ?? 45;
  const maintenanceServiceHours = readMaintenanceNumber(dryboxDeviceBlueprint, 'hoursPerService') ?? 1;
  const sensibleCapacityW = readLimitNumber(dryboxDeviceBlueprint, 'maxCool_W') ?? 0;
  const { effects, effectConfigs } = toDeviceInstanceEffectConfigs(dryboxDeviceBlueprint);

  return {
    id: '00000000-0000-4000-9000-000000000000' as Uuid,
    slug: dryboxDeviceBlueprint.slug,
    name: dryboxDeviceBlueprint.name,
    blueprintId: dryboxDeviceBlueprint.id as Uuid,
    placementScope: 'zone',
    quality01: 0.9,
    condition01: 1,
    powerDraw_W: dryboxDeviceBlueprint.power_W,
    dutyCycle01: 1,
    efficiency01: dryboxDeviceBlueprint.efficiency01,
    coverage_m2: dryboxDeviceBlueprint.coverage_m2 ?? 0,
    airflow_m3_per_h: dryboxDeviceBlueprint.airflow_m3_per_h ?? 0,
    sensibleHeatRemovalCapacity_W: sensibleCapacityW,
    effects: effects ?? [],
    effectConfigs,
    maintenance: {
      runtimeHours: 0,
      hoursSinceService: 0,
      totalMaintenanceCostCc: 0,
      completedServiceCount: 0,
      lastServiceScheduledTick: undefined,
      lastServiceCompletedTick: undefined,
      maintenanceWindow: undefined,
      recommendedReplacement: false,
      policy: {
        lifetimeHours,
        maintenanceIntervalHours: maintenanceIntervalDays * HOURS_PER_DAY,
        serviceHours: maintenanceServiceHours,
        baseCostPerHourCc: priceEntry.baseMaintenanceCostPerHour,
        costIncreasePer1000HoursCc: priceEntry.costIncreasePer1000Hours,
        serviceVisitCostCc: priceEntry.maintenanceServiceCost,
        replacementCostCc: priceEntry.capitalExpenditure,
        maintenanceConditionThreshold01: 0.4,
        restoreAmount01: 0.3,
      },
    },
  } satisfies ZoneDeviceInstance;
}

function configureWorld(): SimulationWorld {
  const world = createDemoWorld();
  const structure = world.company.structures[0];
  const growroom = structure.rooms[0];
  const zone = growroom.zones[0];

  const cultivationMethodId = '659ba4d7-a5fc-482e-98d4-b614341883ac' as Uuid;
  const containerId = 'd9267b6f-41f3-4e91-95b8-5bd7be381d3f' as Uuid;
  const substrateId = '285041f1-9586-4b43-b55c-0cb76f343037' as Uuid;

  const configuredZone = {
    ...zone,
    cultivationMethodId,
    containerId,
    substrateId,
    devices: [createTestDevice()],
  } satisfies typeof zone;

  growroom.zones = [configuredZone];

  return world;
}

function computeExpectedMaintenance(dayTicks: number): { total: number; perHour: number } {
  const priceEntry = expectDevicePriceEntry(dryboxDeviceBlueprint.id);
  let runtimeHours = 0;
  let totalCost = 0;

  for (let i = 0; i < dayTicks; i += 1) {
    runtimeHours += 1;
    totalCost +=
      priceEntry.baseMaintenanceCostPerHour +
      priceEntry.costIncreasePer1000Hours * (runtimeHours / 1_000);
  }

  return { total: totalCost, perHour: totalCost / dayTicks };
}

describe('economy accrual integration', () => {
  it('aggregates utilities, cultivation, and maintenance costs per day', () => {
    let world = configureWorld();
    const ctx: EconomyAccrualTestContext = { tickDurationHours: 1 };
    const irrigationEvents: readonly IrrigationEvent[] = [
      {
        water_L: 50,
        concentrations_mg_per_L: {} satisfies Record<string, number>,
        targetZoneId: world.company.structures[0].rooms[0].zones[0].id,
      },
    ];

    const totalTicks = 25;

    for (let i = 0; i < totalTicks; i += 1) {
      ctx.irrigationEvents = irrigationEvents;
      const { world: nextWorld } = runTick(world, ctx);
      world = nextWorld;
    }

    const economyState = expectDefined(ctx.economyAccruals);

    const utilities = economyState.utilities;
    expect(utilities?.finalizedDays).toHaveLength(1);

    const utilitiesDay0 = utilities.finalizedDays[0];
    expect(utilitiesDay0.dayIndex).toBe(0);
    expect(utilitiesDay0.hoursAccrued).toBeCloseTo(24, EPS);
    expect(utilitiesDay0.energyConsumption_kWh).toBeCloseTo(7.2, EPS);
    expect(utilitiesDay0.energyCostCc).toBeCloseTo(2.52, EPS);
    expect(utilitiesDay0.energyCostCc_per_h).toBeCloseTo(0.105, EPS);
    expect(utilitiesDay0.waterConsumption_m3).toBeCloseTo(1.2, EPS);
    expect(utilitiesDay0.waterCostCc).toBeCloseTo(2.4, EPS);
    expect(utilitiesDay0.waterCostCc_per_h).toBeCloseTo(0.1, EPS);

    const utilitiesDay1 = utilities.current;
    expect(utilitiesDay1?.dayIndex).toBe(1);
    expect(utilitiesDay1?.hoursAccrued).toBeCloseTo(1, EPS);
    expect(utilitiesDay1?.energyConsumption_kWh).toBeCloseTo(0.3, EPS);
    expect(utilitiesDay1?.energyCostCc_per_h).toBeCloseTo(0.105, EPS);
    expect(utilitiesDay1?.waterConsumption_m3).toBeCloseTo(0.05, EPS);
    expect(utilitiesDay1?.waterCostCc_per_h).toBeCloseTo(0.1, EPS);

    const cultivation = economyState.cultivation;
    expect(cultivation?.finalizedDays).toHaveLength(1);
    const cultivationDay0 = cultivation.finalizedDays[0];
    expect(cultivationDay0.dayIndex).toBe(0);
    expect(cultivationDay0.hoursAccrued).toBeCloseTo(24, EPS);
    expect(cultivationDay0.costCc).toBeCloseTo(240, EPS);
    expect(cultivationDay0.costCc_per_h).toBeCloseTo(10, EPS);

    const cultivationDay1 = cultivation.current;
    expect(cultivationDay1?.dayIndex).toBe(1);
    expect(cultivationDay1?.hoursAccrued).toBeCloseTo(1, EPS);
    expect(cultivationDay1?.costCc).toBeCloseTo(10, EPS);
    expect(cultivationDay1?.costCc_per_h).toBeCloseTo(10, EPS);

    const maintenance = economyState.deviceMaintenance;
    expect(maintenance?.finalizedDays).toHaveLength(1);
    const maintenanceDay0 = maintenance.finalizedDays[0];
    const maintenanceExpectations = computeExpectedMaintenance(24);
    expect(maintenanceDay0.dayIndex).toBe(0);
    expect(maintenanceDay0.hoursAccrued).toBeCloseTo(24, EPS);
    expect(maintenanceDay0.costCc).toBeCloseTo(maintenanceExpectations.total, EPS);
    expect(maintenanceDay0.costCc_per_h).toBeCloseTo(maintenanceExpectations.perHour, EPS);

    const maintenanceDay1 = maintenance.current;
    expect(maintenanceDay1?.dayIndex).toBe(1);
    expect(maintenanceDay1?.hoursAccrued).toBeCloseTo(1, EPS);

    const priceEntry = expectDevicePriceEntry(dryboxDeviceBlueprint.id);
    const dayOneMaintenanceCost =
      priceEntry.baseMaintenanceCostPerHour + priceEntry.costIncreasePer1000Hours * (25 / 1_000);
    expect(maintenanceDay1?.costCc).toBeCloseTo(dayOneMaintenanceCost, EPS);
    expect(maintenanceDay1?.costCc_per_h).toBeCloseTo(dayOneMaintenanceCost, EPS);
  });

  it('rolls workforce payroll daily totals from hourly slices with banker rounding', () => {
    let world = createDemoWorld() as Mutable<SimulationWorld>;
    const ctx: EconomyAccrualTestContext = { tickDurationHours: 1 };
    ctx.economyAccruals = undefined;

    interface PayrollSlice {
      readonly baseMinutes: number;
      readonly otMinutes: number;
      readonly baseCost: number;
      readonly otCost: number;
    }

    const hourlySlices: PayrollSlice[] = Array.from({ length: 24 }, (_, hour) => ({
      baseMinutes: 60,
      otMinutes: hour % 4 === 0 ? 15 : 0,
      baseCost: 12.345 + hour * 0.111,
      otCost: hour % 4 === 0 ? 1.234 + hour * 0.05 : 0,
    }));

    let cumulative = {
      baseMinutes: 0,
      otMinutes: 0,
      baseCost: 0,
      otCost: 0,
      totalLaborCost: 0,
    };

    for (let hour = 0; hour < hourlySlices.length; hour += 1) {
      const slice = hourlySlices[hour];

      cumulative = {
        baseMinutes: cumulative.baseMinutes + slice.baseMinutes,
        otMinutes: cumulative.otMinutes + slice.otMinutes,
        baseCost: cumulative.baseCost + slice.baseCost,
        otCost: cumulative.otCost + slice.otCost,
        totalLaborCost: 0,
      };
      cumulative.totalLaborCost = cumulative.baseCost + cumulative.otCost;

      const currentState: WorkforcePayrollState = {
        dayIndex: 0,
        totals: { ...cumulative },
        byStructure: [],
      } satisfies WorkforcePayrollState;

      (ctx as { __wb_workforcePayrollAccrual?: unknown }).__wb_workforcePayrollAccrual = {
        current: currentState,
      } satisfies { current: WorkforcePayrollState };

      (world).simTimeHours = hour;
      world = applyEconomyAccrual(world, ctx) as Mutable<SimulationWorld>;
    }

    const finalTotals = { ...cumulative };
    const roundedBaseCost = bankersRound(finalTotals.baseCost);
    const roundedOtCost = bankersRound(finalTotals.otCost);
    const roundedTotalCost = bankersRound(roundedBaseCost + roundedOtCost);

    const finalized: WorkforcePayrollState = {
      dayIndex: 0,
      totals: {
        baseMinutes: Math.trunc(finalTotals.baseMinutes),
        otMinutes: Math.trunc(finalTotals.otMinutes),
        baseCost: roundedBaseCost,
        otCost: roundedOtCost,
        totalLaborCost: roundedTotalCost,
      },
      byStructure: [],
    } satisfies WorkforcePayrollState;

    const nextDay: WorkforcePayrollState = {
      dayIndex: 1,
      totals: {
        baseMinutes: 0,
        otMinutes: 0,
        baseCost: 0,
        otCost: 0,
        totalLaborCost: 0,
      },
      byStructure: [],
    } satisfies WorkforcePayrollState;

    (ctx as { __wb_workforcePayrollAccrual?: unknown }).__wb_workforcePayrollAccrual = {
      current: nextDay,
      finalized,
    } satisfies { current: WorkforcePayrollState; finalized: WorkforcePayrollState };

    (world).simTimeHours = hourlySlices.length;
    world = applyEconomyAccrual(world, ctx) as Mutable<SimulationWorld>;

    const workforceAccrual = expectDefined(
      (ctx as {
        economyAccruals?: {
          workforce?: { current?: WorkforcePayrollState; finalizedDays: WorkforcePayrollState[] };
        };
      }).economyAccruals?.workforce
    );

    expect(workforceAccrual.finalizedDays).toHaveLength(1);

    const [day0] = workforceAccrual.finalizedDays;
    expect(day0.dayIndex).toBe(0);

    const sumBaseMinutes = hourlySlices.reduce((total, slice) => total + slice.baseMinutes, 0);
    const sumOtMinutes = hourlySlices.reduce((total, slice) => total + slice.otMinutes, 0);
    expect(day0.totals.baseMinutes).toBe(Math.trunc(sumBaseMinutes));
    expect(day0.totals.otMinutes).toBe(Math.trunc(sumOtMinutes));

    const sumBaseCost = hourlySlices.reduce((total, slice) => total + slice.baseCost, 0);
    const sumOtCost = hourlySlices.reduce((total, slice) => total + slice.otCost, 0);
    const expectedBaseCost = bankersRound(sumBaseCost);
    const expectedOtCost = bankersRound(sumOtCost);
    const expectedTotalCost = bankersRound(expectedBaseCost + expectedOtCost);

    expect(day0.totals.baseCost).toBeCloseTo(expectedBaseCost, EPS);
    expect(day0.totals.otCost).toBeCloseTo(expectedOtCost, EPS);
    expect(day0.totals.totalLaborCost).toBeCloseTo(expectedTotalCost, EPS);

    const current = expectDefined(workforceAccrual.current);
    expect(current.dayIndex).toBe(1);
    expect(current.totals.baseMinutes).toBe(0);
    expect(current.totals.baseCost).toBe(0);
    expect(current.totals.totalLaborCost).toBe(0);
  });
});

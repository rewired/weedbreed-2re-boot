import { HOURS_PER_DAY } from '../../constants/simConstants.ts';
import type { SimulationWorld, WorkforcePayrollState } from '../../domain/world.ts';
import type { EngineRunContext } from '../Engine.ts';
import { consumeWorkforcePayrollAccrual } from './applyWorkforce.ts';
import {
  consumeDeviceMaintenanceAccrual,
  type DeviceMaintenanceAccrualState,
  type DeviceMaintenanceAccrualSnapshot,
} from '../../device/maintenanceRuntime.ts';
import { consumeEconomyUsageRuntime } from '../../economy/runtime.ts';
import { resolveEffectiveTariffs } from '../../economy/tariffs.ts';
import { resolveTickHours } from '../resolveTickHours.ts';
import cultivationMethodPriceMapJson from '../../../../../../../data/prices/cultivationMethodPrices.json' with { type: 'json' };
import { parseCultivationMethodPriceMap } from '../../domain/pricing/cultivationMethodPriceMap.ts';

const cultivationMethodPriceMap = parseCultivationMethodPriceMap(cultivationMethodPriceMapJson);

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

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

interface EconomyAccrualCarrier extends Mutable<EngineRunContext> {
  economyAccruals?: {
    workforce?: WorkforceEconomyAccrualState;
    deviceMaintenance?: DeviceMaintenanceEconomyAccrualState;
    utilities?: UtilityEconomyAccrualState;
    cultivation?: CultivationEconomyAccrualState;
  };
}

function mergeFinalizedDays(
  existing: readonly WorkforcePayrollState[],
  finalized?: WorkforcePayrollState,
): WorkforcePayrollState[] {
  if (!finalized) {
    return [...existing];
  }

  const filtered = existing.filter((entry) => entry.dayIndex !== finalized.dayIndex);
  filtered.push(finalized);
  return filtered.sort((a, b) => a.dayIndex - b.dayIndex);
}

function mergeMaintenanceFinalizedDays(
  existing: readonly DeviceMaintenanceAccrualState[],
  finalized?: DeviceMaintenanceAccrualSnapshot['finalized']
): DeviceMaintenanceAccrualState[] {
  if (!finalized || finalized.length === 0) {
    return [...existing];
  }

  const merged = [...existing];

  for (const entry of finalized) {
    const filtered = merged.filter((item) => item.dayIndex !== entry.dayIndex);
    filtered.push(entry);
    merged.splice(0, merged.length, ...filtered.sort((a, b) => a.dayIndex - b.dayIndex));
  }

  return merged;
}

function mergeUtilityFinalizedDays(
  existing: readonly UtilityAccrualState[],
  finalized?: readonly UtilityAccrualState[],
): UtilityAccrualState[] {
  if (!finalized || finalized.length === 0) {
    return [...existing];
  }

  const merged = [...existing];

  for (const entry of finalized) {
    const filtered = merged.filter((item) => item.dayIndex !== entry.dayIndex);
    filtered.push(entry);
    merged.splice(0, merged.length, ...filtered.sort((a, b) => a.dayIndex - b.dayIndex));
  }

  return merged;
}

function mergeCultivationFinalizedDays(
  existing: readonly CultivationAccrualState[],
  finalized?: readonly CultivationAccrualState[],
): CultivationAccrualState[] {
  if (!finalized || finalized.length === 0) {
    return [...existing];
  }

  const merged = [...existing];

  for (const entry of finalized) {
    const filtered = merged.filter((item) => item.dayIndex !== entry.dayIndex);
    filtered.push(entry);
    merged.splice(0, merged.length, ...filtered.sort((a, b) => a.dayIndex - b.dayIndex));
  }

  return merged;
}

function computeCultivationCostPerHour(world: SimulationWorld): number {
  let total = 0;

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        const entry = cultivationMethodPriceMap.cultivationMethodPrices.get(zone.cultivationMethodId);

        if (entry) {
          total += entry.setupCost_per_h;
        }
      }
    }
  }

  return total;
}

export function applyEconomyAccrual(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const payrollSnapshot = consumeWorkforcePayrollAccrual(ctx);
  const maintenanceSnapshot = consumeDeviceMaintenanceAccrual(ctx);
  const usageSnapshot = consumeEconomyUsageRuntime(ctx);
  const tickHours = resolveTickHours(ctx);
  const cultivationCostPerHour = computeCultivationCostPerHour(world);
  const hasCultivationCost = Number.isFinite(cultivationCostPerHour) && cultivationCostPerHour > 0 && tickHours > 0;

  if (!payrollSnapshot && !maintenanceSnapshot && !usageSnapshot && !hasCultivationCost) {
    return world;
  }

  const currentSimHours = Number.isFinite(world.simTimeHours) ? world.simTimeHours : 0;
  const currentDayIndex = Math.floor(currentSimHours / HOURS_PER_DAY);

  const carrier = ctx as EconomyAccrualCarrier;
  const economyAccruals = carrier.economyAccruals;

  if (payrollSnapshot) {
    const existingWorkforce = economyAccruals.workforce ?? { finalizedDays: [] };
    const workforceFinalized = mergeFinalizedDays(
      existingWorkforce.finalizedDays,
      payrollSnapshot.finalized,
    );

    economyAccruals.workforce = {
      current: payrollSnapshot.current,
      finalizedDays: workforceFinalized,
    } satisfies WorkforceEconomyAccrualState;
  }

  if (maintenanceSnapshot) {
    const existingMaintenance = economyAccruals.deviceMaintenance ?? { finalizedDays: [] };
    let finalizedDays = mergeMaintenanceFinalizedDays(
      existingMaintenance.finalizedDays,
      maintenanceSnapshot.finalized,
    );

    const previousCurrent = existingMaintenance.current;
    const nextCurrent = maintenanceSnapshot.current;

    if (previousCurrent && nextCurrent && previousCurrent.dayIndex !== nextCurrent.dayIndex) {
      const alreadyFinalized = finalizedDays.some((entry) => entry.dayIndex === previousCurrent.dayIndex);

      if (!alreadyFinalized) {
        finalizedDays = mergeMaintenanceFinalizedDays(finalizedDays, [previousCurrent]);
      }
    }

    economyAccruals.deviceMaintenance = {
      current: maintenanceSnapshot.current,
      finalizedDays,
    } satisfies DeviceMaintenanceEconomyAccrualState;
  }

  if (usageSnapshot && tickHours > 0) {
    const tariffs = resolveEffectiveTariffs(ctx);
    const energyCost = usageSnapshot.energyConsumption_kWh * tariffs.price_electricity;
    const waterCost = usageSnapshot.waterVolume_m3 * tariffs.price_water;
    const existingUtilities = economyAccruals.utilities ?? { finalizedDays: [] };
    let finalizedDays = existingUtilities.finalizedDays;
    const previous = existingUtilities.current;

    let nextCurrent: UtilityAccrualState;

    if (previous && previous.dayIndex === currentDayIndex) {
      const nextHours = previous.hoursAccrued + tickHours;
      const totalEnergyConsumption = previous.energyConsumption_kWh + usageSnapshot.energyConsumption_kWh;
      const totalEnergyCost = previous.energyCostCc + energyCost;
      const totalWaterConsumption = previous.waterConsumption_m3 + usageSnapshot.waterVolume_m3;
      const totalWaterCost = previous.waterCostCc + waterCost;

      nextCurrent = {
        dayIndex: currentDayIndex,
        hoursAccrued: nextHours,
        energyConsumption_kWh: totalEnergyConsumption,
        energyCostCc: totalEnergyCost,
        energyCostCc_per_h: nextHours > 0 ? totalEnergyCost / nextHours : 0,
        waterConsumption_m3: totalWaterConsumption,
        waterCostCc: totalWaterCost,
        waterCostCc_per_h: nextHours > 0 ? totalWaterCost / nextHours : 0,
      } satisfies UtilityAccrualState;
    } else {
      if (previous) {
        finalizedDays = mergeUtilityFinalizedDays(finalizedDays, [previous]);
      }

      nextCurrent = {
        dayIndex: currentDayIndex,
        hoursAccrued: tickHours,
        energyConsumption_kWh: usageSnapshot.energyConsumption_kWh,
        energyCostCc: energyCost,
        energyCostCc_per_h: tickHours > 0 ? energyCost / tickHours : 0,
        waterConsumption_m3: usageSnapshot.waterVolume_m3,
        waterCostCc: waterCost,
        waterCostCc_per_h: tickHours > 0 ? waterCost / tickHours : 0,
      } satisfies UtilityAccrualState;
    }

    economyAccruals.utilities = {
      current: nextCurrent,
      finalizedDays,
    } satisfies UtilityEconomyAccrualState;
  }

  if (hasCultivationCost) {
    const costIncrementCc = cultivationCostPerHour * tickHours;
    const existingCultivation = economyAccruals.cultivation ?? { finalizedDays: [] };
    let finalizedDays = existingCultivation.finalizedDays;
    const previous = existingCultivation.current;

    let nextCurrent: CultivationAccrualState;

    if (previous && previous.dayIndex === currentDayIndex) {
      const nextHours = previous.hoursAccrued + tickHours;
      const totalCost = previous.costCc + costIncrementCc;

      nextCurrent = {
        dayIndex: currentDayIndex,
        hoursAccrued: nextHours,
        costCc: totalCost,
        costCc_per_h: nextHours > 0 ? totalCost / nextHours : 0,
      } satisfies CultivationAccrualState;
    } else {
      if (previous) {
        finalizedDays = mergeCultivationFinalizedDays(finalizedDays, [previous]);
      }

      nextCurrent = {
        dayIndex: currentDayIndex,
        hoursAccrued: tickHours,
        costCc: costIncrementCc,
        costCc_per_h: tickHours > 0 ? costIncrementCc / tickHours : 0,
      } satisfies CultivationAccrualState;
    }

    economyAccruals.cultivation = {
      current: nextCurrent,
      finalizedDays,
    } satisfies CultivationEconomyAccrualState;
  }

  carrier.economyAccruals = economyAccruals;

  return world;
}

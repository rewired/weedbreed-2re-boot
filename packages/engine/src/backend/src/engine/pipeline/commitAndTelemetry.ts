import { HOURS_PER_DAY, HOURS_PER_TICK } from '../../constants/simConstants.ts';
import type { SimulationWorld, WorkforcePayrollState } from '../../domain/world.ts';
import { TELEMETRY_TICK_COMPLETED_V1, type TelemetryTickCompletedPayload } from '../../telemetry/topics.ts';
import { hasWorldBeenMutated, type EngineRunContext } from '../Engine.ts';
import { resolveTickHours } from '../resolveTickHours.ts';

interface WorkforceEconomyAccrualState {
  readonly current?: WorkforcePayrollState;
}

interface DeviceMaintenanceEconomyAccrualState {
  readonly current?: { costCc_per_h: number };
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

interface CultivationAccrualState {
  readonly dayIndex: number;
  readonly hoursAccrued: number;
  readonly costCc: number;
  readonly costCc_per_h: number;
}

interface EconomyAccrualsSnapshot {
  readonly workforce?: WorkforceEconomyAccrualState;
  readonly deviceMaintenance?: { current?: DeviceMaintenanceEconomyAccrualState['current'] };
  readonly utilities?: { current?: UtilityAccrualState };
  readonly cultivation?: { current?: CultivationAccrualState };
}

interface EconomyAccrualCarrier extends EngineRunContext {
  readonly economyAccruals?: EconomyAccrualsSnapshot;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function computeLabourCostPerHour(state: WorkforceEconomyAccrualState | undefined): number | undefined {
  const payroll = state?.current;

  if (!payroll) {
    return undefined;
  }

  const baseMinutes = isFiniteNumber(payroll.totals.baseMinutes) ? payroll.totals.baseMinutes : 0;
  const overtimeMinutes = isFiniteNumber(payroll.totals.otMinutes) ? payroll.totals.otMinutes : 0;
  const totalMinutes = baseMinutes + overtimeMinutes;

  if (totalMinutes <= 0) {
    return undefined;
  }

  const totalCost = isFiniteNumber(payroll.totals.totalLaborCost) ? payroll.totals.totalLaborCost : 0;

  if (totalCost <= 0) {
    return undefined;
  }

  const hours = totalMinutes / 60;

  if (hours <= 0) {
    return undefined;
  }

  return totalCost / hours;
}

function computeMaintenanceCostPerHour(
  state: DeviceMaintenanceEconomyAccrualState | undefined,
): number | undefined {
  const rate = state?.current?.costCc_per_h;
  return isFiniteNumber(rate) && rate > 0 ? rate : undefined;
}

function computeCultivationCostPerHour(state: CultivationAccrualState | undefined): number | undefined {
  const rate = state?.costCc_per_h;
  return isFiniteNumber(rate) && rate > 0 ? rate : undefined;
}

function computeUtilityTelemetry(state: UtilityAccrualState | undefined) {
  if (!state) {
    return {} as const;
  }

  const energyCostPerHour = isFiniteNumber(state.energyCostCc_per_h) && state.energyCostCc_per_h > 0
    ? state.energyCostCc_per_h
    : undefined;
  const waterCostPerHour = isFiniteNumber(state.waterCostCc_per_h) && state.waterCostCc_per_h > 0
    ? state.waterCostCc_per_h
    : undefined;

  const hoursAccrued = isFiniteNumber(state.hoursAccrued) && state.hoursAccrued > 0 ? state.hoursAccrued : undefined;

  const energyKwhPerDay =
    hoursAccrued && isFiniteNumber(state.energyConsumption_kWh)
      ? (state.energyConsumption_kWh / hoursAccrued) * HOURS_PER_DAY
      : undefined;

  const waterCubicMetersPerDay =
    hoursAccrued && isFiniteNumber(state.waterConsumption_m3)
      ? (state.waterConsumption_m3 / hoursAccrued) * HOURS_PER_DAY
      : undefined;

  const utilitiesCostPerHour =
    (energyCostPerHour ?? 0) + (waterCostPerHour ?? 0) > 0
      ? (energyCostPerHour ?? 0) + (waterCostPerHour ?? 0)
      : undefined;

  return {
    energyCostPerHour,
    waterCostPerHour,
    energyKwhPerDay,
    waterCubicMetersPerDay,
    utilitiesCostPerHour,
  } as const;
}

function buildTickTelemetryPayload(nextWorld: SimulationWorld, ctx: EngineRunContext): TelemetryTickCompletedPayload {
  const carrier = ctx as EconomyAccrualCarrier;
  const accruals = carrier.economyAccruals;

  const targetTickHours = resolveTickHours(ctx);
  const targetTicksPerHour = targetTickHours > 0 ? 1 / targetTickHours : undefined;
  const actualTicksPerHour = 1 / HOURS_PER_TICK;

  const labourCostPerHour = computeLabourCostPerHour(accruals?.workforce);
  const maintenanceCostPerHour = computeMaintenanceCostPerHour(accruals?.deviceMaintenance);
  const cultivationCostPerHour = computeCultivationCostPerHour(accruals?.cultivation?.current);
  const utilityTelemetry = computeUtilityTelemetry(accruals?.utilities?.current);

  const operatingCostPerHourCandidates = [
    labourCostPerHour,
    maintenanceCostPerHour,
    cultivationCostPerHour,
    utilityTelemetry.utilitiesCostPerHour,
  ].filter((value): value is number => typeof value === 'number');

  const operatingCostPerHour =
    operatingCostPerHourCandidates.length > 0
      ? operatingCostPerHourCandidates.reduce((sum, value) => sum + value, 0)
      : undefined;

  const payload: TelemetryTickCompletedPayload = {
    simTimeHours: nextWorld.simTimeHours,
    targetTicksPerHour,
    actualTicksPerHour,
  };

  if (isFiniteNumber(operatingCostPerHour) && operatingCostPerHour > 0) {
    payload.operatingCostPerHour = operatingCostPerHour;
  }

  if (isFiniteNumber(labourCostPerHour) && labourCostPerHour > 0) {
    payload.labourCostPerHour = labourCostPerHour;
  }

  if (isFiniteNumber(utilityTelemetry.utilitiesCostPerHour) && utilityTelemetry.utilitiesCostPerHour > 0) {
    payload.utilitiesCostPerHour = utilityTelemetry.utilitiesCostPerHour;
  }

  if (isFiniteNumber(utilityTelemetry.energyKwhPerDay) && utilityTelemetry.energyKwhPerDay > 0) {
    payload.energyKwhPerDay = utilityTelemetry.energyKwhPerDay;
  }

  if (isFiniteNumber(utilityTelemetry.energyCostPerHour) && utilityTelemetry.energyCostPerHour > 0) {
    payload.energyCostPerHour = utilityTelemetry.energyCostPerHour;
  }

  if (isFiniteNumber(utilityTelemetry.waterCubicMetersPerDay) && utilityTelemetry.waterCubicMetersPerDay > 0) {
    payload.waterCubicMetersPerDay = utilityTelemetry.waterCubicMetersPerDay;
  }

  if (isFiniteNumber(utilityTelemetry.waterCostPerHour) && utilityTelemetry.waterCostPerHour > 0) {
    payload.waterCostPerHour = utilityTelemetry.waterCostPerHour;
  }

  return payload;
}

export function commitAndTelemetry(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  if (!hasWorldBeenMutated(ctx)) {
    return world;
  }

  const nextWorld = {
    ...world,
    simTimeHours: world.simTimeHours + HOURS_PER_TICK
  } satisfies SimulationWorld;

  const payload = buildTickTelemetryPayload(nextWorld, ctx);
  ctx.telemetry?.emit(TELEMETRY_TICK_COMPLETED_V1, { ...payload });

  return nextWorld;
}

import type { EngineRunContext } from '../engine/Engine.ts';

const economyUsageStore = new WeakMap<EngineRunContext, EconomyUsageRuntimeMutable>();

interface EconomyUsageRuntimeMutable {
  energyConsumption_kWh: number;
  waterVolume_m3: number;
}

function ensureEconomyUsageRuntime(ctx: EngineRunContext): EconomyUsageRuntimeMutable {
  const runtime = economyUsageStore.get(ctx);

  if (runtime) {
    return runtime;
  }

  const freshRuntime: EconomyUsageRuntimeMutable = {
    energyConsumption_kWh: 0,
    waterVolume_m3: 0,
  } satisfies EconomyUsageRuntimeMutable;

  economyUsageStore.set(ctx, freshRuntime);
  return freshRuntime;
}

export interface EconomyUsageSnapshot {
  readonly energyConsumption_kWh: number;
  readonly waterVolume_m3: number;
}

export function accumulateEnergyConsumption(
  ctx: EngineRunContext,
  energy_kWh: number
): void {
  if (!Number.isFinite(energy_kWh) || energy_kWh <= 0) {
    return;
  }

  const runtime = ensureEconomyUsageRuntime(ctx);
  runtime.energyConsumption_kWh += energy_kWh;
}

export function accumulateWaterConsumption(
  ctx: EngineRunContext,
  water_L: number
): void {
  if (!Number.isFinite(water_L) || water_L <= 0) {
    return;
  }

  const runtime = ensureEconomyUsageRuntime(ctx);
  runtime.waterVolume_m3 += water_L / 1_000;
}

/**
 * Retrieves the accumulated economy usage snapshot for the current tick and clears it (SEC §2 isolation).
 */
export function consumeEconomyUsageRuntime(
  ctx: EngineRunContext
): EconomyUsageSnapshot | undefined {
  const runtime = economyUsageStore.get(ctx);

  if (!runtime) {
    return undefined;
  }

  const snapshot: EconomyUsageSnapshot = {
    energyConsumption_kWh: runtime.energyConsumption_kWh,
    waterVolume_m3: runtime.waterVolume_m3
  } satisfies EconomyUsageSnapshot;

  economyUsageStore.delete(ctx);

  return snapshot;
}

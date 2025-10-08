import type { EngineRunContext } from '../engine/Engine.ts';

const ECONOMY_USAGE_CONTEXT_KEY = '__wb_economyUsage' as const;

interface EconomyUsageRuntimeMutable {
  energyConsumption_kWh: number;
  waterVolume_m3: number;
}

type EconomyUsageRuntimeCarrier = EngineRunContext & {
  [ECONOMY_USAGE_CONTEXT_KEY]?: EconomyUsageRuntimeMutable;
};

function ensureEconomyUsageRuntime(ctx: EngineRunContext): EconomyUsageRuntimeMutable {
  const carrier = ctx as EconomyUsageRuntimeCarrier;

  if (!carrier[ECONOMY_USAGE_CONTEXT_KEY]) {
    carrier[ECONOMY_USAGE_CONTEXT_KEY] = {
      energyConsumption_kWh: 0,
      waterVolume_m3: 0
    } satisfies EconomyUsageRuntimeMutable;
  }

  return carrier[ECONOMY_USAGE_CONTEXT_KEY];
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

export function consumeEconomyUsageRuntime(
  ctx: EngineRunContext
): EconomyUsageSnapshot | undefined {
  const carrier = ctx as EconomyUsageRuntimeCarrier;
  const runtime = carrier[ECONOMY_USAGE_CONTEXT_KEY];

  if (!runtime) {
    return undefined;
  }

  const snapshot: EconomyUsageSnapshot = {
    energyConsumption_kWh: runtime.energyConsumption_kWh,
    waterVolume_m3: runtime.waterVolume_m3
  } satisfies EconomyUsageSnapshot;

  delete carrier[ECONOMY_USAGE_CONTEXT_KEY];

  return snapshot;
}

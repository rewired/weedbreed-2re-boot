import { useMemo } from "react";
import { DEFAULT_SIMULATION_CLOCK, deriveSimulationClock } from "@ui/lib/simTime";
import { useEconomyReadModel, useSimulationReadModel } from "@ui/lib/readModelHooks";
import { formatCurrency, useShellLocale } from "@ui/lib/locale";
import type { SupportedLocale } from "@ui/lib/locale";
import { formatRoundedNumber } from "@ui/lib/validation/rounding";
import { useTelemetryTick } from "@ui/state/telemetry";

const FALLBACK_TARGET_TICKS_PER_HOUR = 30;
const FALLBACK_ACTUAL_TICKS_PER_HOUR = 28;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatTickRate(value: number | null | undefined, locale: SupportedLocale): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  const formatted = formatRoundedNumber(value, locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  });

  return `${formatted} ticks/hour`;
}

function formatCurrencyPerHour(value: number | null | undefined, locale: SupportedLocale): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  return `${formatCurrency(value, locale)} /hr`;
}

function formatDailyUsage(value: number | null | undefined, unit: "kWh" | "m³", locale: SupportedLocale): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  const formatted = formatRoundedNumber(value, locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  });

  return `${formatted} ${unit}/day`;
}

function formatRelativeTickDelta(currentTick: number, raisedAtTick: number): string {
  const delta = raisedAtTick - currentTick;
  const sign = delta >= 0 ? "+" : "-";
  const absoluteHours = Math.abs(delta);
  const hours = Math.floor(absoluteHours);
  const minutes = Math.round((absoluteHours - hours) * 60);
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");

  return `T${sign}${paddedHours}:${paddedMinutes}`;
}

export interface DashboardTickRate {
  readonly targetTicksPerHour: string;
  readonly actualTicksPerHour: string;
}

export interface DashboardClockSnapshot {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export interface DashboardCostRollup {
  readonly operatingCostPerHour: string;
  readonly labourCostPerHour: string;
  readonly utilitiesCostPerHour: string;
}

export interface DashboardResourceUsage {
  readonly energyKwhPerDay: string;
  readonly energyCostPerHour: string;
  readonly waterCubicMetersPerDay: string;
  readonly waterCostPerHour: string;
}

export interface DashboardEventSnapshot {
  readonly id: string;
  readonly label: string;
  readonly relativeTime: string;
}

export interface DashboardSnapshot {
  readonly tickRate: DashboardTickRate;
  readonly clock: DashboardClockSnapshot;
  readonly costs: DashboardCostRollup;
  readonly resources: DashboardResourceUsage;
  readonly events: readonly DashboardEventSnapshot[];
}

export function useDashboardSnapshot(): DashboardSnapshot {
  const locale = useShellLocale();
  const tickTelemetry = useTelemetryTick();
  const simulation = useSimulationReadModel();
  const economy = useEconomyReadModel();
  const { operatingCostPerHour, labourCostPerHour, utilitiesCostPerHour } = economy;
  const {
    day: simulationDay,
    hour: simulationHour,
    simTimeHours: simulationSimTimeHours,
    tick: simulationTick,
    pendingIncidents: simulationPendingIncidents
  } = simulation;

  return useMemo(() => {
    const clockFallback = {
      day: simulationDay,
      hour: simulationHour,
      minute: 0
    } satisfies DashboardClockSnapshot;

    const resolvedSimTimeHours = tickTelemetry?.simTimeHours ?? simulationSimTimeHours;
    const clock = deriveSimulationClock(resolvedSimTimeHours, clockFallback ?? DEFAULT_SIMULATION_CLOCK);
    const currentTick = Math.floor(resolvedSimTimeHours ?? simulationTick ?? 0);
    const pendingIncidents = simulationPendingIncidents ?? [];

    return {
      tickRate: {
        targetTicksPerHour: formatTickRate(
          tickTelemetry?.targetTicksPerHour ?? FALLBACK_TARGET_TICKS_PER_HOUR,
          locale
        ),
        actualTicksPerHour: formatTickRate(
          tickTelemetry?.actualTicksPerHour ?? FALLBACK_ACTUAL_TICKS_PER_HOUR,
          locale
        )
      },
      clock,
      costs: {
        operatingCostPerHour: formatCurrencyPerHour(operatingCostPerHour, locale),
        labourCostPerHour: formatCurrencyPerHour(labourCostPerHour, locale),
        utilitiesCostPerHour: formatCurrencyPerHour(utilitiesCostPerHour, locale)
      },
      resources: {
        energyKwhPerDay: formatDailyUsage(tickTelemetry?.energyKwhPerDay, "kWh", locale),
        energyCostPerHour: formatCurrencyPerHour(tickTelemetry?.energyCostPerHour, locale),
        waterCubicMetersPerDay: formatDailyUsage(tickTelemetry?.waterCubicMetersPerDay, "m³", locale),
        waterCostPerHour: formatCurrencyPerHour(tickTelemetry?.waterCostPerHour, locale)
      },
      events: pendingIncidents.map((incident) => ({
        id: incident.id,
        label: incident.message,
        relativeTime: formatRelativeTickDelta(currentTick, incident.raisedAtTick)
      }))
    } satisfies DashboardSnapshot;
  }, [
    labourCostPerHour,
    locale,
    operatingCostPerHour,
    simulationDay,
    simulationHour,
    simulationPendingIncidents,
    simulationSimTimeHours,
    simulationTick,
    tickTelemetry,
    utilitiesCostPerHour
  ]);
}

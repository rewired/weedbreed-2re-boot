import { HOURS_PER_DAY } from "@engine/constants/simConstants.ts";

export interface SimulationClockSnapshot {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

const MINUTES_PER_HOUR = 60;

/* eslint-disable @typescript-eslint/no-magic-numbers */
export const DEFAULT_SIMULATION_CLOCK: SimulationClockSnapshot = Object.freeze({
  day: 12,
  hour: 6,
  minute: 15
});
/* eslint-enable @typescript-eslint/no-magic-numbers */

export function deriveSimulationClock(
  simTimeHours: number | null | undefined,
  fallback: SimulationClockSnapshot
): SimulationClockSnapshot {
  if (typeof simTimeHours !== "number" || !Number.isFinite(simTimeHours)) {
    return fallback;
  }

  const totalHours = Math.max(0, simTimeHours);
  let day = Math.floor(totalHours / HOURS_PER_DAY) + 1;
  let hour = Math.floor(totalHours % HOURS_PER_DAY);
  const fractionalHours = totalHours - Math.floor(totalHours);
  let minute = Math.round(fractionalHours * MINUTES_PER_HOUR);

  if (minute === MINUTES_PER_HOUR) {
    minute = 0;
    hour += 1;
    if (hour === HOURS_PER_DAY) {
      hour = 0;
      day += 1;
    }
  }

  return {
    day,
    hour,
    minute
  } satisfies SimulationClockSnapshot;
}

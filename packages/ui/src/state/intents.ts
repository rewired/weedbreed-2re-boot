import { create } from "zustand";

export interface ZoneLightSchedule {
  readonly onHours: number;
  readonly offHours: number;
  readonly startHour: number;
}

interface IntentState {
  readonly zoneLightSchedules: Map<string, ZoneLightSchedule>;
  readonly recordZoneLightSchedule: (zoneId: string, schedule: ZoneLightSchedule) => void;
}

const createInitialSchedules = () => new Map<string, ZoneLightSchedule>();

const DEFAULT_LIGHT_SCHEDULE: ZoneLightSchedule = Object.freeze({
  onHours: 18,
  offHours: 6,
  startHour: 0
});

const useIntentStore = create<IntentState>((set) => ({
  zoneLightSchedules: createInitialSchedules(),
  recordZoneLightSchedule: (zoneId, schedule) => {
    set((state) => {
      const nextSchedules = new Map(state.zoneLightSchedules);
      nextSchedules.set(zoneId, { ...schedule });
      return { zoneLightSchedules: nextSchedules };
    });
  }
}));

export function recordZoneLightSchedule(zoneId: string, schedule: ZoneLightSchedule): void {
  useIntentStore.getState().recordZoneLightSchedule(zoneId, schedule);
}

export function useZoneLightSchedule(zoneId: string | null | undefined): ZoneLightSchedule {
  return useIntentStore((state) => {
    if (!zoneId) {
      return DEFAULT_LIGHT_SCHEDULE;
    }

    const existing = state.zoneLightSchedules.get(zoneId);
    if (!existing) {
      return DEFAULT_LIGHT_SCHEDULE;
    }

    return existing;
  });
}

export function getZoneLightSchedule(zoneId: string): ZoneLightSchedule {
  const existing = useIntentStore.getState().zoneLightSchedules.get(zoneId);
  return existing ?? DEFAULT_LIGHT_SCHEDULE;
}

export function resetIntentState(): void {
  useIntentStore.setState({
    zoneLightSchedules: createInitialSchedules(),
    recordZoneLightSchedule: useIntentStore.getState().recordZoneLightSchedule
  });
}

export { useIntentStore };

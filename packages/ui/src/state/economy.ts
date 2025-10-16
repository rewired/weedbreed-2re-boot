import { useMemo, useSyncExternalStore } from "react";

const ECONOMY_STUB_BALANCE = 1250000.5;
const ECONOMY_STUB_DELTA_PER_HOUR = 1425.75;

export interface EconomySnapshot {
  readonly balance: number;
  readonly deltaPerHour: number;
}

export interface EconomyStore {
  getSnapshot(): EconomySnapshot;
  subscribe(listener: () => void): () => void;
}

const economyStubSnapshot: EconomySnapshot = Object.freeze({
  balance: ECONOMY_STUB_BALANCE,
  deltaPerHour: ECONOMY_STUB_DELTA_PER_HOUR
});

const economyStore: EconomyStore = {
  getSnapshot: () => economyStubSnapshot,
  subscribe: (listener: () => void) => {
    void listener;
    return () => undefined;
  }
};

export interface EconomySnapshotOverrides {
  readonly balance?: number;
  readonly deltaPerHour?: number;
}

export function useEconomySnapshot(overrides?: EconomySnapshotOverrides): EconomySnapshot {
  const snapshot = useSyncExternalStore(
    (listener) => economyStore.subscribe(listener),
    () => economyStore.getSnapshot(),
    () => economyStore.getSnapshot()
  );

  return useMemo(() => {
    if (!overrides) {
      return snapshot;
    }

    return {
      balance: overrides.balance ?? snapshot.balance,
      deltaPerHour: overrides.deltaPerHour ?? snapshot.deltaPerHour
    } satisfies EconomySnapshot;
  }, [overrides?.balance, overrides?.deltaPerHour, snapshot]);
}

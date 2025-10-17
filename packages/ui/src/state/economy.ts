import { useMemo } from "react";
import { useEconomyReadModel } from "@ui/lib/readModelHooks";

export interface EconomySnapshot {
  readonly balance: number;
  readonly deltaPerHour: number;
}

export interface EconomySnapshotOverrides {
  readonly balance?: number;
  readonly deltaPerHour?: number;
}

export function useEconomySnapshot(overrides?: EconomySnapshotOverrides): EconomySnapshot {
  const economy = useEconomyReadModel();

  return useMemo(() => {
    const baseSnapshot: EconomySnapshot = {
      balance: economy.balance,
      deltaPerHour: economy.deltaPerHour
    };

    if (!overrides) {
      return baseSnapshot;
    }

    return {
      balance: overrides.balance ?? baseSnapshot.balance,
      deltaPerHour: overrides.deltaPerHour ?? baseSnapshot.deltaPerHour
    } satisfies EconomySnapshot;
  }, [
    economy.balance,
    economy.deltaPerHour,
    overrides?.balance,
    overrides?.deltaPerHour
  ]);
}

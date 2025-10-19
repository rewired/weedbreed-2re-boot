import { useMemo } from "react";
import { useEconomyReadModel } from "@ui/lib/readModelHooks";

export interface EconomySnapshot {
  readonly balance_per_h: number;
  readonly delta_per_h: number;
}

export interface EconomySnapshotOverrides {
  readonly balance_per_h?: number;
  readonly delta_per_h?: number;
}

export function useEconomySnapshot(overrides?: EconomySnapshotOverrides): EconomySnapshot {
  const economy = useEconomyReadModel();

  return useMemo(() => {
    const baseSnapshot: EconomySnapshot = {
      balance_per_h: economy.balance_per_h,
      delta_per_h: economy.delta_per_h
    };

    if (!overrides) {
      return baseSnapshot;
    }

    return {
      balance_per_h: overrides.balance_per_h ?? baseSnapshot.balance_per_h,
      delta_per_h: overrides.delta_per_h ?? baseSnapshot.delta_per_h
    } satisfies EconomySnapshot;
  }, [
    economy.balance_per_h,
    economy.delta_per_h,
    overrides?.balance_per_h,
    overrides?.delta_per_h
  ]);
}

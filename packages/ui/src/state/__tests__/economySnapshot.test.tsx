import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useEconomySnapshot } from "@ui/state/economy";
import {
  applyReadModelSnapshot,
  resetReadModelStore
} from "@ui/state/readModels";
import type { EconomySnapshotOverrides } from "@ui/state/economy";
import type { ReadModelSnapshot } from "@ui/state/readModels.types";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";

describe("useEconomySnapshot", () => {
  beforeEach(() => {
    resetReadModelStore();
  });

  it("returns the live economy snapshot by default", () => {
    const { result } = renderHook(() => useEconomySnapshot());

    expect(result.current).toEqual({
      balance_per_h: deterministicReadModelSnapshot.economy.balance_per_h,
      delta_per_h: deterministicReadModelSnapshot.economy.delta_per_h
    });
  });

  it("reflects read-model updates", () => {
    const { result } = renderHook(() => useEconomySnapshot());

    const updatedSnapshot = structuredClone(
      deterministicReadModelSnapshot
    ) as ReadModelSnapshot;
    updatedSnapshot.economy.balance_per_h =
      updatedSnapshot.economy.balance_per_h + 12.5;
    updatedSnapshot.economy.delta_per_h =
      updatedSnapshot.economy.delta_per_h - 0.275;

    act(() => {
      applyReadModelSnapshot(updatedSnapshot);
    });

    expect(result.current).toEqual({
      balance_per_h: updatedSnapshot.economy.balance_per_h,
      delta_per_h: updatedSnapshot.economy.delta_per_h
    });
  });

  it("merges overrides with the live snapshot", () => {
    const baseEconomy = deterministicReadModelSnapshot.economy;
    const initialOverrides: EconomySnapshotOverrides = {
      balance_per_h: baseEconomy.balance_per_h + 7.5
    };

    const { result, rerender } = renderHook(
      ({ overrides }: { overrides: EconomySnapshotOverrides | undefined }) =>
        useEconomySnapshot(overrides),
      { initialProps: { overrides: initialOverrides } }
    );

    expect(result.current).toEqual({
      balance_per_h: initialOverrides.balance_per_h!,
      delta_per_h: baseEconomy.delta_per_h
    });

    const refreshedSnapshot = structuredClone(
      deterministicReadModelSnapshot
    ) as ReadModelSnapshot;
    refreshedSnapshot.economy.balance_per_h =
      refreshedSnapshot.economy.balance_per_h - 3.25;
    refreshedSnapshot.economy.delta_per_h =
      refreshedSnapshot.economy.delta_per_h + 0.18;

    act(() => {
      applyReadModelSnapshot(refreshedSnapshot);
    });

    expect(result.current).toEqual({
      balance_per_h: initialOverrides.balance_per_h!,
      delta_per_h: refreshedSnapshot.economy.delta_per_h
    });

    rerender({ overrides: undefined });

    expect(result.current).toEqual({
      balance_per_h: refreshedSnapshot.economy.balance_per_h,
      delta_per_h: refreshedSnapshot.economy.delta_per_h
    });
  });
});

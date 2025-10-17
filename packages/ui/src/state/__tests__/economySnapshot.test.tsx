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
      balance: deterministicReadModelSnapshot.economy.balance,
      deltaPerHour: deterministicReadModelSnapshot.economy.deltaPerHour
    });
  });

  it("reflects read-model updates", () => {
    const { result } = renderHook(() => useEconomySnapshot());

    const updatedSnapshot = structuredClone(
      deterministicReadModelSnapshot
    ) as ReadModelSnapshot;
    updatedSnapshot.economy.balance = updatedSnapshot.economy.balance + 5000;
    updatedSnapshot.economy.deltaPerHour =
      updatedSnapshot.economy.deltaPerHour - 275;

    act(() => {
      applyReadModelSnapshot(updatedSnapshot);
    });

    expect(result.current).toEqual({
      balance: updatedSnapshot.economy.balance,
      deltaPerHour: updatedSnapshot.economy.deltaPerHour
    });
  });

  it("merges overrides with the live snapshot", () => {
    const baseEconomy = deterministicReadModelSnapshot.economy;
    const initialOverrides: EconomySnapshotOverrides = {
      balance: baseEconomy.balance + 2500
    };

    const { result, rerender } = renderHook(
      ({ overrides }: { overrides: EconomySnapshotOverrides | undefined }) =>
        useEconomySnapshot(overrides),
      { initialProps: { overrides: initialOverrides } }
    );

    expect(result.current).toEqual({
      balance: initialOverrides.balance!,
      deltaPerHour: baseEconomy.deltaPerHour
    });

    const refreshedSnapshot = structuredClone(
      deterministicReadModelSnapshot
    ) as ReadModelSnapshot;
    refreshedSnapshot.economy.balance = refreshedSnapshot.economy.balance - 1250;
    refreshedSnapshot.economy.deltaPerHour =
      refreshedSnapshot.economy.deltaPerHour + 180;

    act(() => {
      applyReadModelSnapshot(refreshedSnapshot);
    });

    expect(result.current).toEqual({
      balance: initialOverrides.balance!,
      deltaPerHour: refreshedSnapshot.economy.deltaPerHour
    });

    rerender({ overrides: undefined });

    expect(result.current).toEqual({
      balance: refreshedSnapshot.economy.balance,
      deltaPerHour: refreshedSnapshot.economy.deltaPerHour
    });
  });
});

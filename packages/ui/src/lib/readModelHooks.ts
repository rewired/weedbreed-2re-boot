import { useMemo } from "react";
import {
  useReadModelStore,
  useReadModelStoreStatus
} from "@ui/state/readModels";
import type {
  CompatibilityMaps,
  EconomyReadModel,
  HrReadModel,
  PriceBookCatalog,
  ReadModelSnapshot,
  ReadModelStoreStatus,
  RoomReadModel,
  SimulationReadModel,
  StructureReadModel,
  ZoneReadModel
} from "@ui/state/readModels.types";

export function useReadModelSnapshot(): ReadModelSnapshot {
  return useReadModelStore((state) => state.snapshot);
}

export function useSimulationReadModel(): SimulationReadModel {
  return useReadModelStore((state) => state.snapshot.simulation);
}

export function useEconomyReadModel(): EconomyReadModel {
  return useReadModelStore((state) => state.snapshot.economy);
}

export function useStructureReadModels(): readonly StructureReadModel[] {
  return useReadModelStore((state) => state.snapshot.structures);
}

export function useStructureReadModel(
  structureId: string | null | undefined
): StructureReadModel | null {
  return useReadModelStore((state) => {
    if (!structureId) {
      return null;
    }

    return state.snapshot.structures.find((structure) => structure.id === structureId) ?? null;
  });
}

export function useRoomReadModel(
  structureId: string | null | undefined,
  roomId: string | null | undefined
): RoomReadModel | null {
  return useReadModelStore((state) => {
    if (!structureId || !roomId) {
      return null;
    }

    const structure = state.snapshot.structures.find((item) => item.id === structureId);

    if (!structure) {
      return null;
    }

    return structure.rooms.find((room) => room.id === roomId) ?? null;
  });
}

export function useZoneReadModel(
  structureId: string | null | undefined,
  roomId: string | null | undefined,
  zoneId: string | null | undefined
): ZoneReadModel | null {
  return useReadModelStore((state) => {
    if (!structureId || !roomId || !zoneId) {
      return null;
    }

    const structure = state.snapshot.structures.find((item) => item.id === structureId);

    if (!structure) {
      return null;
    }

    const room = structure.rooms.find((item) => item.id === roomId);

    if (!room) {
      return null;
    }

    return room.zones.find((zone) => zone.id === zoneId) ?? null;
  });
}

export function useHRReadModel(): HrReadModel {
  return useReadModelStore((state) => state.snapshot.hr);
}

export function usePriceBookCatalog(): PriceBookCatalog {
  return useReadModelStore((state) => state.snapshot.priceBook);
}

export function useCompatibilityMaps(): CompatibilityMaps {
  return useReadModelStore((state) => state.snapshot.compatibility);
}

export function useReadModelStatus(): ReadModelStoreStatus {
  return useReadModelStoreStatus();
}

export function useStructureRooms(
  structureId: string | null | undefined
): readonly RoomReadModel[] {
  const structure = useStructureReadModel(structureId);
  return useMemo(() => structure?.rooms ?? [], [structure]);
}

export function useRoomZones(
  structureId: string | null | undefined,
  roomId: string | null | undefined
): readonly ZoneReadModel[] {
  const room = useRoomReadModel(structureId, roomId);
  return useMemo(() => room?.zones ?? [], [room]);
}

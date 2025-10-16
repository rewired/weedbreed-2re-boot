import { describe, expect, it } from "vitest";
import { AREA_QUANTUM_M2, ROOM_DEFAULT_HEIGHT_M } from "@engine/constants/simConstants.ts";
import type {
  CompatibilityMaps,
  PriceBookCatalog,
  RoomReadModel,
  StructureReadModel,
  ZoneReadModel
} from "@ui/state/readModels.types";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import {
  deriveZoneWizardResult,
  findSeedlingPriceForStrain,
  previewRoomDuplicate,
  previewZoneDuplicate,
  validateRoomAreaUpdate,
  validateRoomCreate,
  validateSowing,
  validateZoneAreaUpdate
} from "@ui/lib/facilityFlows";

function getStructure(): StructureReadModel {
  return deterministicReadModelSnapshot.structures[0];
}

function getRoom(): RoomReadModel {
  return getStructure().rooms[0];
}

function getZone(): ZoneReadModel {
  return getRoom().zones[0];
}

const priceBook: PriceBookCatalog = deterministicReadModelSnapshot.priceBook;
const compatibility: CompatibilityMaps = deterministicReadModelSnapshot.compatibility;

const ROOM_CREATE_TEST_AREA = 50;
const ZONE_WIZARD_TEST_AREA = 20;
const CULTIVATION_DENSITY = 0.25;
const SOW_COUNT = 5;

describe("validateRoomCreate", () => {
  it("produces a valid payload when area and volume fit within structure capacity", () => {
    const structure = getStructure();
    const area = Math.min(structure.capacity.areaFree_m2, ROOM_CREATE_TEST_AREA);
    const result = validateRoomCreate({
      structure,
      name: "Propagation Bay",
      purpose: "growroom",
      area_m2: area,
      height_m: ROOM_DEFAULT_HEIGHT_M
    });

    expect(result.isValid).toBe(true);
    expect(result.payload).toEqual({
      type: "room.create",
      structureId: structure.id,
      name: "Propagation Bay",
      purpose: "growroom",
      area_m2: area,
      height_m: ROOM_DEFAULT_HEIGHT_M
    });
  });

  it("rejects areas exceeding structure free capacity", () => {
    const structure = getStructure();
    const result = validateRoomCreate({
      structure,
      name: "Overflow",
      purpose: "growroom",
      area_m2: structure.capacity.areaFree_m2 + AREA_QUANTUM_M2,
      height_m: ROOM_DEFAULT_HEIGHT_M
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Structure does not have enough free area for the new room.");
  });
});

describe("deriveZoneWizardResult", () => {
  it("calculates max plants and acquisition cost for compatible selections", () => {
    const room = getRoom();
    const area = Math.min(room.capacity.areaFree_m2, ZONE_WIZARD_TEST_AREA);
    const seedlingPrice = findSeedlingPriceForStrain(priceBook, "strain-northern-lights");
    const containerPrice = priceBook.containers[0];
    const substratePrice = priceBook.substrates[0];
    const irrigationLinePrice = priceBook.irrigationLines[0];
    const result = deriveZoneWizardResult({
      room,
      area_m2: area,
      cultivationMethodId: "cm-sea-of-green",
      areaPerPlant_m2: CULTIVATION_DENSITY,
      irrigationMethodId: "ir-drip-inline",
      seedlingPrice,
      containerPrice,
      substratePrice,
      irrigationLinePrice,
      compatibility
    });

    expect(result.isValid).toBe(true);
    expect(result.maxPlants).toBe(Math.floor(area / CULTIVATION_DENSITY));
    expect(result.acquisitionCost).toBeGreaterThan(0);
    expect(result.payload).toEqual({
      type: "zone.create",
      structureId: deterministicReadModelSnapshot.structures[0].id,
      roomId: room.id,
      area_m2: area,
      cultivationMethodId: "cm-sea-of-green",
      irrigationMethodId: "ir-drip-inline",
      maxPlants: result.maxPlants
    });
  });

  it("blocks incompatible irrigation selections", () => {
    const room = getRoom();
    const result = deriveZoneWizardResult({
      room,
      area_m2: Math.min(room.capacity.areaFree_m2, ZONE_WIZARD_TEST_AREA),
      cultivationMethodId: "cm-sea-of-green",
      areaPerPlant_m2: CULTIVATION_DENSITY,
      irrigationMethodId: "ir-ebb-flow",
      seedlingPrice: priceBook.seedlings[0],
      containerPrice: priceBook.containers[0],
      substratePrice: priceBook.substrates[0],
      irrigationLinePrice: priceBook.irrigationLines[0],
      compatibility
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Irrigation method is incompatible with the selected cultivation method."
    );
    expect(result.payload).toBeNull();
  });
});

describe("validateSowing", () => {
  it("approves sowing when zone is empty and compatibility is ok", () => {
    const zone = { ...getZone(), currentPlantCount: 0, maxPlants: 10 };
    const seedlingPrice = findSeedlingPriceForStrain(priceBook, zone.strainId);
    const result = validateSowing({
      zone,
      strainId: zone.strainId,
      count: SOW_COUNT,
      compatibility,
      seedlingPrice
    });

    expect(result.isValid).toBe(true);
    expect(result.payload).toEqual({
      type: "plants.sow",
      zoneId: zone.id,
      strainId: zone.strainId,
      count: SOW_COUNT
    });
    expect(result.totalCost).toBe(
      seedlingPrice?.pricePerUnit ? seedlingPrice.pricePerUnit * SOW_COUNT : 0
    );
  });

  it("blocks sowing when zone contains plants", () => {
    const zone = getZone();
    const result = validateSowing({
      zone,
      strainId: zone.strainId,
      count: 1,
      compatibility,
      seedlingPrice: findSeedlingPriceForStrain(priceBook, zone.strainId)
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Zone must be empty before sowing new plants.");
  });
});

describe("previewRoomDuplicate", () => {
  it("calculates device capital expenditure without cloning plants", () => {
    const baseStructure = getStructure();
    const room = getRoom();
    const structure = {
      ...baseStructure,
      capacity: {
        ...baseStructure.capacity,
        areaFree_m2: room.area_m2 * 2,
        volumeFree_m3: room.volume_m3 * 2
      }
    };
    const result = previewRoomDuplicate({
      structure,
      room,
      copies: 1,
      priceBook
    });

    expect(result.isValid).toBe(true);
    expect(result.clonedPlantCount).toBe(0);
    expect(result.deviceCapitalExpenditure).toBeGreaterThanOrEqual(0);
    expect(result.payload).toEqual({
      type: "room.duplicate",
      sourceRoomId: room.id,
      structureId: structure.id,
      copies: 1
    });
  });

  it("requires sufficient free structure capacity", () => {
    const structure = getStructure();
    const room = getRoom();
    const result = previewRoomDuplicate({
      structure,
      room,
      copies: Math.ceil((structure.capacity.areaFree_m2 + AREA_QUANTUM_M2) / room.area_m2),
      priceBook
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Structure does not have enough free area for the duplicates."
    );
  });
});

describe("previewZoneDuplicate", () => {
  it("applies compatibility checks and zero plant cloning", () => {
    const structure = getStructure();
    const zone = getZone();
    const baseRoom = getRoom();
    const room = {
      ...baseRoom,
      capacity: {
        ...baseRoom.capacity,
        areaFree_m2: zone.area_m2 * 2
      }
    };
    const result = previewZoneDuplicate({
      structure,
      room,
      zone,
      copies: 1,
      priceBook,
      compatibility
    });

    expect(result.isValid).toBe(true);
    expect(result.clonedPlantCount).toBe(0);
    expect(result.payload).toEqual({
      type: "zone.duplicate",
      sourceZoneId: zone.id,
      roomId: room.id,
      structureId: structure.id,
      copies: 1
    });
  });

  it("fails when room lacks free area", () => {
    const structure = getStructure();
    const room = getRoom();
    const zone = getZone();
    const result = previewZoneDuplicate({
      structure,
      room,
      zone,
      copies: Math.ceil((room.capacity.areaFree_m2 + AREA_QUANTUM_M2) / zone.area_m2),
      priceBook,
      compatibility
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Room does not have enough free area for the duplicates.");
  });
});

describe("validateRoomAreaUpdate", () => {
  it("validates area updates against structure capacity", () => {
    const structure = getStructure();
    const room = getRoom();
    const nextArea = room.area_m2 + AREA_QUANTUM_M2;
    const result = validateRoomAreaUpdate({ structure, room, nextArea_m2: nextArea });

    expect(result.isValid).toBe(true);
    expect(result.payload).toEqual({
      type: "room.setArea",
      roomId: room.id,
      structureId: structure.id,
      area_m2: nextArea
    });
    expect(result.nextVolume_m3).toBeGreaterThan(0);
  });

  it("blocks updates that exceed available volume", () => {
    const structure = getStructure();
    const room = getRoom();
    const excessiveArea = structure.capacity.areaFree_m2 + room.area_m2 + AREA_QUANTUM_M2;
    const result = validateRoomAreaUpdate({ structure, room, nextArea_m2: excessiveArea });

    expect(result.isValid).toBe(false);
  });
});

describe("validateZoneAreaUpdate", () => {
  it("updates zone area and recalculates max plants", () => {
    const room = getRoom();
    const zone = getZone();
    const nextArea = zone.area_m2 + AREA_QUANTUM_M2;
    const result = validateZoneAreaUpdate({
      room,
      zone,
      nextArea_m2: nextArea,
      areaPerPlant_m2: CULTIVATION_DENSITY
    });

    expect(result.isValid).toBe(true);
    expect(result.maxPlants).toBe(Math.floor(nextArea / CULTIVATION_DENSITY));
    expect(result.payload).toEqual({
      type: "zone.setArea",
      zoneId: zone.id,
      roomId: room.id,
      structureId: deterministicReadModelSnapshot.structures[0].id,
      area_m2: nextArea,
      maxPlants: result.maxPlants
    });
  });

  it("blocks updates that reduce max plants below current count", () => {
    const room = getRoom();
    const zone = { ...getZone(), currentPlantCount: 10, area_m2: ZONE_WIZARD_TEST_AREA };
    const nextArea = AREA_QUANTUM_M2;
    const result = validateZoneAreaUpdate({
      room,
      zone,
      nextArea_m2: nextArea,
      areaPerPlant_m2: 1
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Updated zone would not accommodate existing plants.");
  });
});
